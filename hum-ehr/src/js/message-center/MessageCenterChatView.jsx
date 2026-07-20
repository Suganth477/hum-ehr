import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { useInfiniteQuery, useQueryClient } from '@tanstack/react-query';
import { Dialog } from 'primereact/dialog';
import {
    fetchUserMessages, saveChatMessage, checkFirstTimeUser,
    fetchOldMessagesForMigration, encryptOldMessages, updateUnreadMessageCount, fetchNotificationCount,
} from '../../services/messageCenterService';
import {
    mapChatMessage, uploadFileFormat, attachmentTypeForFormat, base64ToBlobUrl, attachmentMimeType,
} from './messageCenterHelpers';
import { startAudioRecorder, blobToBase64 } from './audioRecorder';
import { SkeletonList } from '../../components/common/ContentLoader';
import { useNotify } from '../../context/NotificationContext';
import { LegacyIcon } from '../../components/common/CustomIcons';

const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024; // legacy "Attachment Max(10MB)"
const MAX_RECORD_SECONDS = 30; // legacy auto-stops recording after 30s

const formatDuration = (totalSeconds) => {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

// accept strings per attachment kind (legacy chat.jsp data-file-type)
const ATTACH_KINDS = [
    { key: 'image', label: 'Photo', accept: 'image/*' },
    { key: 'video', label: 'Video', accept: 'video/*' },
    { key: 'document', label: 'Document', accept: 'application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/pdf' },
];

const HIPAA_DOC_NOTE = 'The document contains patient health record information. I am aware of the HIPAA Privacy Rule and take full responsibility to ensure that there is no HIPAA violation.\nPlease make use of Microsoft Word to open the files with .doc and .docx extensions.';

/** FileReader → data URL (legacy utility.convertUploadFileInputBase64Format). */
const readAsDataUrl = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
});

/**
 * One rendered chat bubble (text + IMG/VIDEO/AUDIO/DOCU), mirroring
 * decryptedMessageBasedOnAttachment. P6: inline media (IMG/AUDIO) blob URLs are
 * built lazily via IntersectionObserver only when the bubble scrolls into view,
 * and revoked on unmount — so off-screen media is never decoded and object URLs
 * never leak. VIDEO/DOCU are buttons that build a blob on demand (preview/download).
 */
const ChatBubble = ({ msg, scrollRootRef, onPreview, onDocDownload, onMediaLoad }) => {
    const att = msg.attachment;
    const liRef = useRef(null);
    const [blobUrl, setBlobUrl] = useState('');

    useEffect(() => {
        if (!att || !att.base64 || (att.type !== 'IMG' && att.type !== 'AUDIO')) return undefined;
        const node = liRef.current;
        if (!node) return undefined;
        let url = '';
        const build = () => {
            if (url) return;
            url = base64ToBlobUrl(att.base64, attachmentMimeType(att.type, att.fileFormat));
            setBlobUrl(url);
        };
        const io = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) { build(); io.disconnect(); }
        }, { root: scrollRootRef?.current || null, rootMargin: '250px' });
        io.observe(node);
        return () => { io.disconnect(); if (url) URL.revokeObjectURL(url); };
    }, [att, scrollRootRef]);

    return (<li ref={liRef} className={msg.status} data-message-status={msg.status} data-message-id={msg.messageId}>
      {msg.dayHeaderShown && <div className="mc-chat-day-header">{msg.dayHeader}</div>}
      <div className="mc-chat-bubble">
        {att && (<div className="mb-1">
          {att.type === 'IMG' && (
            blobUrl
              ? <img src={blobUrl} alt="attachment" className="mc-chat-img" onLoad={onMediaLoad} onClick={() => onPreview({ ...att, status: msg.status })}/>
              : <div className="mc-chat-img mc-chat-media-loading"/>
          )}
          {att.type === 'VIDEO' && (
            <button type="button" className="mc-chat-media-btn" title="Preview Video" onClick={() => onPreview({ ...att, status: msg.status })}>
              <svg height="60" width="100" viewBox="0 0 24 24"><path fill={msg.status === 'sent' ? '#0b7' : '#333'} d="M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z"/></svg>
            </button>
          )}
          {att.type === 'AUDIO' && (
            blobUrl
              ? <audio className="mc-chat-audio-player" controls controlsList="nodownload" preload="metadata" src={blobUrl}/>
              : <div className="mc-chat-audio-player mc-chat-media-loading"/>
          )}
          {att.type === 'DOCU' && att.fileFormat === 'pdf' && (
            <button type="button" className="mc-chat-media-btn" title="Preview Document" onClick={() => onPreview({ ...att, status: msg.status })}>
              <svg height="60" width="100" viewBox="0 -960 960 960" fill={msg.status === 'sent' ? '#0b7' : '#333'}><path d="M320-240q-33 0-56.5-23.5T240-320v-480q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H320Zm0-80h480v-480H320v480ZM160-80q-33 0-56.5-23.5T80-160v-560h80v560h560v80H160Z"/></svg>
            </button>
          )}
          {att.type === 'DOCU' && (att.fileFormat === 'doc' || att.fileFormat === 'docx') && (
            <button type="button" className="mc-chat-media-btn" title="Download Document" onClick={() => onDocDownload(att)}>
              <svg height="60" width="100" viewBox="0 0 24 24"><path fill={msg.status === 'sent' ? '#0b7' : '#333'} d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M15.2,20H13.8L12,13.2L10.2,20H8.8L6.6,11H8.1L9.5,17.8L11.3,11H12.6L14.4,17.8L15.8,11H17.3L15.2,20M13,9V3.5L18.5,9H13Z"/></svg>
            </button>
          )}
          <div className="mc-chat-time text-end">{msg.time}</div>
        </div>)}
        {msg.text && (<div>
          <span className="mc-chat-text">{msg.text}</span>
          <div className="mc-chat-time">{msg.time}</div>
        </div>)}
      </div>
    </li>);
};

/**
 * Individual conversation view (legacy EhrTextMessageCenterIndividualViewChat).
 *
 * P3: message history is a TanStack useInfiniteQuery (cached per user, deduped,
 * scroll-up pagination via fetchNextPage). A one-time preamble (first-time key →
 * migrate → encrypt) gates the query with `ready`. Sends/mark-read use the cache.
 * P6: attachment blobs are decoded lazily + revoked by ChatBubble.
 */
const MessageCenterChatView = ({ user, onMessageSent }) => {
    const { notifyError, notify } = useNotify();
    const queryClient = useQueryClient();
    const selectedUserId = user?.userId;

    const [ready, setReady] = useState(false); // preamble (key/migrate/encrypt) complete
    const [deactivated, setDeactivated] = useState(user?.isMessageSentFlag === 'N');
    const [input, setInput] = useState('');
    const [sending, setSending] = useState(false);
    const [preview, setPreview] = useState(null);
    const [previewUrl, setPreviewUrl] = useState('');
    const [attachment, setAttachment] = useState(null); // staged outgoing file
    const [attachMenuOpen, setAttachMenuOpen] = useState(false);
    const [recording, setRecording] = useState(false);
    const [elapsed, setElapsed] = useState(0); // recording seconds
    const [stagedAudio, setStagedAudio] = useState(null); // recorded voice message pending send

    const historyRef = useRef(null);
    const pinBottomRef = useRef(true); // keep newest in view until the user scrolls up
    const isPrependRef = useRef(false); // next render prepends older messages
    const prevScrollHeightRef = useRef(0);
    const markedUnreadRef = useRef(new Set()); // messageDetailsIds already marked read
    const fileInputRef = useRef(null);
    const recorderRef = useRef(null); // active audio-recorder controller
    const waveCanvasRef = useRef(null);
    const audioTimerRef = useRef(null);

    const stopRecordTimer = () => { if (audioTimerRef.current) { clearInterval(audioTimerRef.current); audioTimerRef.current = null; } };
    const clearStagedAudio = () => setStagedAudio((prev) => {
        if (prev?.blobUrl) URL.revokeObjectURL(prev.blobUrl);
        return null;
    });

    // Preamble on user change: first-time key → migration fetch → encrypt → enable the query.
    useEffect(() => {
        if (!selectedUserId) { setReady(false); return undefined; }
        let ignore = false;
        setReady(false);
        setDeactivated(user?.isMessageSentFlag === 'N');
        setInput('');
        setAttachment(null);
        setAttachMenuOpen(false);
        stopRecordTimer();
        if (recorderRef.current) { recorderRef.current.cancel(); recorderRef.current = null; }
        setRecording(false);
        setElapsed(0);
        clearStagedAudio();
        pinBottomRef.current = true;
        markedUnreadRef.current = new Set();
        (async () => {
            try {
                await checkFirstTimeUser(selectedUserId).catch(() => {});
                if (ignore) return;
                const migration = await fetchOldMessagesForMigration(user?.userPersonId).catch(() => null);
                if (ignore) return;
                if (migration?.status === 'success' && migration.data?.data?.length) {
                    await encryptOldMessages(migration, selectedUserId).catch(() => {});
                    if (ignore) return;
                }
                setReady(true);
            }
            catch (error) { console.error('Failed to open conversation.', error); }
        })();
        return () => { ignore = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [selectedUserId]);

    const {
        data, isError, error, fetchNextPage, hasNextPage, isFetchingNextPage,
    } = useInfiniteQuery({
        queryKey: ['chatMessages', selectedUserId],
        enabled: ready && !!selectedUserId,
        initialPageParam: 0,
        queryFn: ({ pageParam }) => fetchUserMessages({ userId: selectedUserId, start: pageParam }),
        getNextPageParam: (lastPage, allPages) => {
            const loaded = allPages.reduce((sum, page) => sum + (page?.data?.length || 0), 0);
            const total = lastPage?.totalCount || 0;
            return total > loaded ? loaded : undefined;
        },
    });

    useEffect(() => {
        if (isError) {
            console.error('Failed to fetch the encrypted message for selected user.', error);
            notifyError(error?.message || 'Failed to fetch the encrypted message for selected user. Please try again.');
        }
    }, [isError, error, notifyError]);

    // Pages arrive newest-first (newest block first). Flatten to chronological
    // oldest→newest (reverse page order + reverse within each page), add day headers.
    const messages = useMemo(() => {
        if (!data) return null;
        const ordered = [...data.pages].reverse()
            .flatMap((page) => (page?.data || []).slice().reverse().map(mapChatMessage));
        const seen = new Set();
        return ordered.map((message) => {
            const dayHeaderShown = !seen.has(message.dateKey);
            if (dayHeaderShown) seen.add(message.dateKey);
            return { ...message, dayHeaderShown };
        });
    }, [data]);

    // Deactivated state comes from the first (start=0) page.
    useEffect(() => {
        const firstPage = data?.pages?.[0];
        if (firstPage) setDeactivated(firstPage.isMessageSentFlag === 'N');
    }, [data]);

    // Mark newly-seen unread received messages as read (once each).
    useEffect(() => {
        if (!messages) return;
        const unread = messages
            .filter((m) => m.isUnread && m.messageDetailsId && !markedUnreadRef.current.has(m.messageDetailsId))
            .map((m) => m.messageDetailsId);
        if (!unread.length) return;
        unread.forEach((id) => markedUnreadRef.current.add(id));
        updateUnreadMessageCount(unread)
            .then((res) => {
                if (res?.status === 'success') { onMessageSent?.(); fetchNotificationCount().catch(() => {}); }
            })
            .catch((err) => console.error('Failed to update unread count.', err));
    }, [messages, onMessageSent]);

    // Scroll: initial load / after-send → bottom; older-page prepend → preserve position.
    useLayoutEffect(() => {
        const el = historyRef.current;
        if (!el || !messages) return;
        if (isPrependRef.current) {
            el.scrollTop = el.scrollHeight - prevScrollHeightRef.current;
            isPrependRef.current = false;
        }
        else if (pinBottomRef.current) {
            el.scrollTop = el.scrollHeight;
        }
    }, [messages]);

    const handleMediaLoad = () => {
        if (pinBottomRef.current && historyRef.current) historyRef.current.scrollTop = historyRef.current.scrollHeight;
    };

    const onHistoryScroll = (event) => {
        const el = event.target;
        // stay pinned only while near the bottom (unpin once the user scrolls up)
        pinBottomRef.current = el.scrollHeight - el.clientHeight - el.scrollTop < 40;
        if (el.scrollTop === 0 && hasNextPage && !isFetchingNextPage) {
            prevScrollHeightRef.current = el.scrollHeight;
            isPrependRef.current = true;
            fetchNextPage();
        }
    };

    // Own the recorder lifecycle: start capture once recording begins (the waveform
    // canvas is mounted by the time this effect runs) and a 1s timer; tear down on stop.
    useEffect(() => {
        if (!recording) return undefined;
        let active = true;
        startAudioRecorder(waveCanvasRef.current).then((controller) => {
            if (!active) { controller.cancel(); return; }
            recorderRef.current = controller;
        }).catch((err) => {
            if (!active) return;
            console.error('Failed to start audio recording.', err);
            notifyError('Please allow microphone access to record audio.');
            setRecording(false);
        });
        const timer = setInterval(() => setElapsed((prev) => prev + 1), 1000);
        audioTimerRef.current = timer;
        return () => { active = false; clearInterval(timer); audioTimerRef.current = null; };
    }, [recording, notifyError]);

    // Tear down mic + timer if the view unmounts mid-recording.
    useEffect(() => () => {
        if (audioTimerRef.current) clearInterval(audioTimerRef.current);
        if (recorderRef.current) { recorderRef.current.cancel(); recorderRef.current = null; }
    }, []);

    // Build the preview-modal blob from base64 on open (or use the staged dataUri); revoke on close.
    useEffect(() => {
        if (!preview) { setPreviewUrl(''); return undefined; }
        if (preview.dataUri) { setPreviewUrl(preview.dataUri); return undefined; }
        const url = base64ToBlobUrl(preview.base64, attachmentMimeType(preview.type, preview.fileFormat));
        setPreviewUrl(url);
        return () => { if (url) URL.revokeObjectURL(url); };
    }, [preview]);

    // Open the native file dialog for a given attachment kind (Photo/Video/Document).
    const openFilePicker = (accept) => {
        setAttachMenuOpen(false);
        if (fileInputRef.current) {
            fileInputRef.current.value = ''; // allow re-selecting the same file
            fileInputRef.current.accept = accept;
            fileInputRef.current.click();
        }
    };

    // Read the picked file, derive its format/type, and stage it for sending (legacy getFileDetails).
    const onFileSelected = async (event) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (file.size > MAX_ATTACHMENT_BYTES) {
            notifyError('Attachment exceeds the 10 MB limit. Please choose a smaller file.');
            event.target.value = '';
            return;
        }
        try {
            const dataUri = await readAsDataUrl(file);
            const base64 = String(dataUri).split(',')[1] || '';
            const fileTypeGroup = (file.type || '').split('/')[0]; // image | video | application
            const extension = file.name.includes('.') ? file.name.split('.').pop() : '';
            const fileFormat = uploadFileFormat(fileTypeGroup, extension);
            const attachmentType = attachmentTypeForFormat(fileFormat, 1);
            if (!attachmentType) {
                notifyError('Unsupported file type. Allowed: image, video, PDF, or Word document.');
                event.target.value = '';
                return;
            }
            setAttachment({
                file: base64,
                dataUri,
                fileFormat,
                fileSize: Math.ceil(file.size / 1024), // KB, matching legacy
                fileTypeGroup,
                fileName: file.name,
                attachmentType,
            });
        }
        catch (error) {
            console.error('Failed to read the selected attachment.', error);
            notifyError('Failed to read the selected file. Please try again.');
        }
    };

    const clearAttachment = () => { setAttachment(null); if (fileInputRef.current) fileInputRef.current.value = ''; };

    // "Save recording" (check): stop capture, encode WAV, stage it for sending.
    const finishRecording = useCallback(async () => {
        if (audioTimerRef.current) { clearInterval(audioTimerRef.current); audioTimerRef.current = null; }
        const controller = recorderRef.current;
        recorderRef.current = null;
        setRecording(false);
        if (!controller) return;
        try {
            const blob = controller.stop();
            const base64 = await blobToBase64(blob);
            setStagedAudio({ base64, sizeKB: Math.ceil(blob.size / 1024), blobUrl: URL.createObjectURL(blob) });
        }
        catch (error) { console.error('Failed to finalize the recording.', error); notifyError('Failed to save the recording. Please try again.'); }
    }, [notifyError]);

    const startRecording = () => {
        if (deactivated || sending || attachment || stagedAudio || recording) return;
        setElapsed(0);
        setRecording(true); // the effect above starts the recorder once the canvas is mounted
    };

    // "Delete audio" (trash): stop capture and discard.
    const cancelRecording = () => {
        stopRecordTimer();
        const controller = recorderRef.current;
        recorderRef.current = null;
        setRecording(false);
        setElapsed(0);
        if (controller) controller.cancel();
    };

    // Auto-stop at the 30s cap (legacy audioRecordTimerFunction).
    useEffect(() => {
        if (recording && elapsed >= MAX_RECORD_SECONDS) finishRecording();
    }, [recording, elapsed, finishRecording]);

    // After sending, drop back to the newest page and refetch it (keeps data visible — no skeleton flash).
    const reloadFromStart = useCallback(async () => {
        pinBottomRef.current = true;
        markedUnreadRef.current = new Set();
        queryClient.setQueryData(['chatMessages', selectedUserId], (old) => (
            old ? { pages: old.pages.slice(0, 1), pageParams: old.pageParams.slice(0, 1) } : old
        ));
        await queryClient.refetchQueries({ queryKey: ['chatMessages', selectedUserId] });
    }, [queryClient, selectedUserId]);

    const handleSend = async () => {
        const message = input.trim();
        if ((!message && !attachment && !stagedAudio) || deactivated || sending) return;
        let fileDetails = [];
        let attachmentType = null;
        if (stagedAudio) {
            fileDetails = [{ file: stagedAudio.base64, fileFormat: 'wav', fileSize: stagedAudio.sizeKB, thumbnail: 'TEST', encryptedFileFormat: 'txt' }];
            attachmentType = 'AUDIO';
        }
        else if (attachment) {
            fileDetails = [{ file: attachment.file, fileFormat: attachment.fileFormat, fileSize: attachment.fileSize, thumbnail: 'TEST', encryptedFileFormat: 'txt' }];
            attachmentType = attachment.attachmentType;
        }
        setSending(true);
        try {
            const response = await saveChatMessage({ message, fileDetails, attachmentType, selectedUserId });
            if (response?.status === 'success') {
                setInput('');
                clearAttachment();
                clearStagedAudio();
                onMessageSent?.();
                await reloadFromStart();
            }
            else notifyError('Failed to send the message. Please try again.');
        }
        catch (error) { console.error('Failed to send chat message.', error); notifyError(error?.message || 'Failed to send the message. Please try again.'); }
        finally { setSending(false); }
    };

    // Preview the staged (outgoing) attachment in the same modal used for received media.
    const previewStagedAttachment = () => {
        if (!attachment) return;
        setPreview({ type: attachment.attachmentType, fileFormat: attachment.fileFormat, dataUri: attachment.dataUri, status: 'sent' });
    };

    // Build a one-off blob to download a received Word document (revoked shortly after).
    const handleDocDownload = (att) => {
        const url = base64ToBlobUrl(att.base64, attachmentMimeType(att.type, att.fileFormat));
        const link = document.createElement('a');
        link.href = url;
        link.download = 'attachment_download';
        link.click();
        link.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);
        notify?.({ severity: 'info', summary: 'Document', detail: HIPAA_DOC_NOTE });
    };

    const initials = `${(user?.firstName || '?')[0] || ''}${(user?.lastName || '?')[0] || ''}`.toUpperCase();

    return (<div className="mc-chat-view">
      <div className="mc-chat-view-header">
        <span className="mc-chat-header-initials text-uppercase">{initials}</span>
        <div className="text-capitalize">
          <span className="fw-semibold" style={{ color: '#526172' }}>{user?.userName}</span>
          {user?.userRole && <span style={{ fontSize: 13, color: '#828a95', marginLeft: 4 }}>({user.userRole})</span>}
          {deactivated && <span className="mc-chat-deactivated-note ms-1">(Deactivated)</span>}
        </div>
      </div>

      <ul className="mc-chat-history custom-scrollbar" ref={historyRef} onScroll={onHistoryScroll}>
        {isFetchingNextPage && <li className="py-1"><SkeletonList rows={1}/></li>}
        {messages === null && <li><SkeletonList rows={5}/></li>}
        {(messages || []).map((msg) => (
          <ChatBubble key={`${msg.messageId}_${msg.messageDetailsId}`} msg={msg} scrollRootRef={historyRef}
            onPreview={setPreview} onDocDownload={handleDocDownload} onMediaLoad={handleMediaLoad}/>
        ))}
      </ul>

      <div className="mc-chat-composer">
        {deactivated && <div className="text-muted small">This user is deactivated. Messaging is disabled.</div>}

        {!deactivated && recording && (
          <div className="mc-chat-audio-recording">
            <button type="button" className="mc-chat-audio-delete" title="Delete Audio" onClick={cancelRecording}>
              <LegacyIcon icon="mdi-delete"/>
            </button>
            <span className="mc-chat-audio-timer">{formatDuration(elapsed)}</span>
            <canvas ref={waveCanvasRef} width={200} height={30} className="mc-chat-audio-wave"/>
            <button type="button" className="mc-chat-audio-save" title="Save Recording" onClick={finishRecording}>
              <LegacyIcon icon="mdi-check"/>
            </button>
          </div>
        )}

        {!deactivated && !recording && stagedAudio && (
          <div className="mc-chat-audio-staged">
            <button type="button" className="mc-chat-attach-remove" title="Delete Audio" onClick={clearStagedAudio} disabled={sending}>
              <LegacyIcon icon="mdi-delete"/>
            </button>
            <audio className="mc-chat-audio-player" controls controlsList="nodownload" src={stagedAudio.blobUrl}/>
            <button type="button" className="mc-chat-send-btn" title="Send Voice Message" disabled={sending} onClick={handleSend}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#fff" viewBox="0 0 12 12">
                <path d="M3.13844 5.4375L1.54235 2.24766L8.9861 5.4375H3.13844ZM3.13844 6.5625H8.9861L1.54235 9.75234L3.1361 6.5625H3.13844ZM1.04547 0.810939C0.757191 0.68672 0.419691 0.757032 0.204066 0.984376C-0.0115594 1.21172 -0.0607782 1.55391 0.0798468 1.83516L2.1611 6L0.0798468 10.1648C-0.0607782 10.4461 -0.0115594 10.7859 0.204066 11.0156C0.419691 11.2453 0.754847 11.3133 1.04547 11.1914L11.5455 6.69141C11.822 6.57422 12.0002 6.30234 12.0002 6.00234C12.0002 5.70234 11.822 5.43047 11.5455 5.31328L1.04547 0.813283V0.810939Z"/>
              </svg>
            </button>
          </div>
        )}

        {!deactivated && !recording && !stagedAudio && (<>
          {attachment && (
            <div className="mc-chat-attach-preview">
              <button type="button" className="mc-chat-attach-chip" title="Preview attachment" onClick={previewStagedAttachment}>
                {attachment.fileTypeGroup === 'image'
                  ? <img src={attachment.dataUri} alt="preview" className="mc-chat-attach-thumb"/>
                  : <LegacyIcon icon={attachment.fileTypeGroup === 'video' ? 'mdi-play-circle-outline' : 'mdi-file-document-outline'} className="mc-chat-attach-icon"/>}
                <span className="mc-chat-attach-name">{attachment.fileName}</span>
              </button>
              <button type="button" className="mc-chat-attach-remove" title="Remove file" onClick={clearAttachment} disabled={sending}>
                <LegacyIcon icon="mdi-close"/>
              </button>
            </div>
          )}
          <div className="mc-chat-textarea-wrapper">
            <div className="mc-chat-attach-menu-wrap">
              <button type="button" className="mc-chat-attach-btn" title="Attachment Max(10MB)"
                disabled={sending || !!attachment} onClick={() => setAttachMenuOpen((open) => !open)}>
                <LegacyIcon icon="mdi-paperclip"/>
              </button>
              {attachMenuOpen && (
                <ul className="mc-chat-attach-menu">
                  {ATTACH_KINDS.map((kind) => (
                    <li key={kind.key}>
                      <button type="button" onClick={() => openFilePicker(kind.accept)}>{kind.label}</button>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button type="button" className="mc-chat-attach-btn" title="Record Audio"
              disabled={sending || !!attachment} onClick={startRecording}>
              <LegacyIcon icon="mdi-microphone"/>
            </button>
            <textarea className="form-control mc-chat-textarea custom-scrollbar"
              placeholder={attachment ? 'Attachment ready to send' : 'Enter the text message'}
              maxLength={250} value={input} onChange={(e) => setInput(e.target.value)} disabled={sending || !!attachment}/>
            <button type="button" className="mc-chat-send-btn" title="Send Message" disabled={(!input.trim() && !attachment) || sending} onClick={handleSend}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" fill="#fff" viewBox="0 0 12 12">
                <path d="M3.13844 5.4375L1.54235 2.24766L8.9861 5.4375H3.13844ZM3.13844 6.5625H8.9861L1.54235 9.75234L3.1361 6.5625H3.13844ZM1.04547 0.810939C0.757191 0.68672 0.419691 0.757032 0.204066 0.984376C-0.0115594 1.21172 -0.0607782 1.55391 0.0798468 1.83516L2.1611 6L0.0798468 10.1648C-0.0607782 10.4461 -0.0115594 10.7859 0.204066 11.0156C0.419691 11.2453 0.754847 11.3133 1.04547 11.1914L11.5455 6.69141C11.822 6.57422 12.0002 6.30234 12.0002 6.00234C12.0002 5.70234 11.822 5.43047 11.5455 5.31328L1.04547 0.813283V0.810939Z"/>
              </svg>
            </button>
          </div>
          <input ref={fileInputRef} type="file" className="d-none" onChange={onFileSelected}/>
        </>)}
      </div>

      <Dialog visible={!!preview} onHide={() => setPreview(null)} header="Attachment" style={{ width: '60vw' }} breakpoints={{ '992px': '95vw' }} dismissableMask>
        {preview && preview.type === 'IMG' && <img src={previewUrl} alt="Preview" style={{ maxWidth: '100%', maxHeight: '70vh', display: 'block', margin: '0 auto', objectFit: 'contain' }}/>}
        {preview && preview.type === 'VIDEO' && <video controls controlsList="nodownload" style={{ width: '100%', maxHeight: '70vh' }}><source src={previewUrl} type="video/mp4"/></video>}
        {preview && preview.type === 'DOCU' && preview.fileFormat === 'pdf' && <iframe title="Document Preview" src={`${previewUrl}#toolbar=0`} style={{ width: '100%', height: '70vh', border: 'none' }}/>}
      </Dialog>
    </div>);
};
export default MessageCenterChatView;
