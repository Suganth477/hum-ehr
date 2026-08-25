import { useEffect, useMemo, useRef, useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Dialog } from 'primereact/dialog';
import Swal from 'sweetalert2';
import { fetchMailDetails, updateMailStatus } from '../../services/inAppMailService';
import { useNotify } from '../../context/NotificationContext';
import { SkeletonList } from '../../components/common/ContentLoader';
import { Glyph, ReadDot, StarIcon } from './InAppMailGlyphs';
import InAppMailCompose from './InAppMailCompose';
import {
    formatThreadDate, threadRecipients, selfDistribution, fileNameSliceForLabel,
    attachmentIconDesc, PREVIEWABLE_FORMATS, composePrefill,
} from './inAppMailHelpers';

const swalTheme = Swal.mixin({
    customClass: { popup: 'iam-swal-popup', title: 'iam-swal-title', confirmButton: 'iam-swal-confirm', cancelButton: 'iam-swal-cancel' },
    buttonsStyling: false,
});

// Reply / Reply All / Forward buttons (legacy in-app-mail-reply-forward-btn-container).
const ReplyBar = ({ onReply }) => (
    <div className="iam-reply-bar">
        <button type="button" className="iam-reply-btn" title="Reply" onClick={() => onReply('REPLY')}>
            <Glyph viewBox="0 0 24 24" width={22} height={22} fill="#000" path="M10 9V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
            <span>Reply</span>
        </button>
        <button type="button" className="iam-reply-btn" title="Reply All" onClick={() => onReply('REPLYALL')}>
            <Glyph viewBox="0 0 24 24" width={22} height={22} fill="#000" path="M7 8V5l-7 7 7 7v-3l-4-4 4-4zm6 1V5l-7 7 7 7v-4.1c5 0 8.5 1.6 11 5.1-1-5-4-10-11-11z" />
            <span>Reply All</span>
        </button>
        <button type="button" className="iam-reply-btn" title="Forward" onClick={() => onReply('FORWD')}>
            <Glyph viewBox="0 0 24 24" width={22} height={22} fill="#000" path="M12 8V4l8 8-8 8v-4H4V8z" />
            <span>Forward</span>
        </button>
    </div>
);

// One attachment chip — click to preview (image/video) or download (everything else).
const Attachment = ({ file, onPreview }) => {
    const format = (file.fileFormat || '').toLowerCase();
    const icon = attachmentIconDesc(format, 0);
    const previewable = PREVIEWABLE_FORMATS.includes(format);
    const onClick = () => {
        if (previewable) {
            onPreview(file);
            return;
        }
        const a = document.createElement('a');
        a.href = file.fileUrl;
        a.download = file.fileName || '';
        document.body.appendChild(a);
        a.click();
        a.remove();
    };
    return (
        <div className="iam-attachment" role="button" title={['doc', 'docx', 'pdf'].includes(format) ? 'Click to download' : 'Click to preview'} onClick={onClick}>
            {['jpeg', 'png', 'jpg'].includes(format)
                ? <img src={file.fileUrl} alt={file.fileName} className="iam-attachment-thumb" />
                : icon && <Glyph viewBox={icon.viewBox} path={icon.path} width={40} height={40} fill="grey" />}
            <div className="iam-attachment-name">{file.fileName ? fileNameSliceForLabel(file.fileName, format) : 'No file Name'}</div>
            <div className="iam-attachment-size">{file.fileSize} KB</div>
        </div>
    );
};

/**
 * In-App Mail thread reader (legacy InAppMailEachFullConversationMessage). Fetches a full
 * conversation via /inAppMail/details; the newest message is expanded and the rest are
 * collapsed one-liners (click to toggle). Per message: From/To/Cc, read-dot + star + delete;
 * body; attachments (image/video → preview dialog, others → download); Reply / Reply All /
 * Forward. Head: back, delete-whole-conversation, and prev/next-conversation navigation over
 * the current list page. Compose (reply/forward + inline drafts) arrives in P4.
 */
const InAppMailThread = ({ parentMailId, siblings = [], recordsTotal = 0, folder, patientId = null, onBack }) => {
    const { notifySuccess, notifyError } = useNotify();
    const queryClient = useQueryClient();
    const [current, setCurrent] = useState(parentMailId);
    const [expandedIds, setExpandedIds] = useState(() => new Set());
    const [reply, setReply] = useState(null);        // { mailId, type } — P4 placeholder
    const [preview, setPreview] = useState(null);     // { fileUrl, fileName, fileFormat }
    const initRef = useRef(null);

    // Opening a different mail from the list re-seeds the current conversation.
    useEffect(() => { setCurrent(parentMailId); }, [parentMailId]);

    const isTrash = folder === 'TRASH';
    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['inAppMailDetails', current, isTrash],
        queryFn: () => fetchMailDetails(current, isTrash),
        enabled: current != null,
    });

    useEffect(() => {
        if (isError) {
            console.error('Failed to get in app mail conversation.', error);
            notifyError(error?.message || 'Failed to get in app mail conversation.');
        }
    }, [isError, error, notifyError]);

    const messages = useMemo(() => data?.data?.inAppMailResponse || [], [data]);

    // Expand the newest message when entering a conversation; keep user toggles on refetch.
    useEffect(() => {
        if (messages.length && initRef.current !== current) {
            initRef.current = current;
            setExpandedIds(new Set([messages[messages.length - 1].mailId]));
            setReply(null);
        }
    }, [messages, current]);

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['inAppMailDetails'] });
        queryClient.invalidateQueries({ queryKey: ['inAppMailList'] });
        queryClient.invalidateQueries({ queryKey: ['inAppMailCount'] });
    };

    const statusMutation = useMutation({
        mutationFn: (params) => updateMailStatus(params),
        onSuccess: (_res, variables) => {
            invalidate();
            if (variables.successMessage)
                notifySuccess(variables.successMessage);
            if (variables.backAfter)
                onBack?.();
        },
        onError: (err) => { console.error('Failed to change status.', err); notifyError('Failed to change status.'); },
    });

    const idx = siblings.indexOf(current);
    const goPrev = () => { if (idx > 0) setCurrent(siblings[idx - 1]); };
    const goNext = () => { if (idx > -1 && idx < siblings.length - 1) setCurrent(siblings[idx + 1]); };

    const toggleExpand = (mailId) => setExpandedIds((prev) => {
        const next = new Set(prev);
        if (next.has(mailId))
            next.delete(mailId);
        else
            next.add(mailId);
        return next;
    });

    const toggleRead = (msg, self) => statusMutation.mutate({
        statusCode: 'READ', statusFlag: self.isRead === 'N' ? 'Y' : 'N', messageDetailsIdList: self.ids,
        successMessage: `Mail marked as ${self.isRead === 'N' ? 'read' : 'unread'}`,
    });
    const toggleStar = (msg, self) => statusMutation.mutate({
        statusCode: 'STARD', statusFlag: self.isStarred === 'Y' ? 'N' : 'Y', messageDetailsIdList: self.ids,
        successMessage: `Mail ${self.isStarred === 'Y' ? 'Unstarred' : 'Starred'} Successfully`,
    });

    const deleteMessage = async (self) => {
        const confirm = await swalTheme.fire({ title: 'Move to trash', text: 'Are you sure about move the mail to trash?', showCancelButton: true, confirmButtonText: 'Yes', cancelButtonText: 'No' });
        if (!confirm.isConfirmed)
            return;
        statusMutation.mutate({
            statusCode: isTrash ? 'PERMTRASH' : 'TRASH', statusFlag: 'Y', messageDetailsIdList: self.ids,
            successMessage: isTrash ? 'Mail Deleted Permanently' : 'Mail moved to trash',
            backAfter: messages.length <= 1,
        });
    };

    const deleteConversation = async () => {
        const confirm = await swalTheme.fire({ title: 'Move to trash', text: 'Are you sure about move the mail to trash?', showCancelButton: true, confirmButtonText: 'Yes', cancelButtonText: 'No' });
        if (!confirm.isConfirmed)
            return;
        const ids = messages.flatMap((m) => selfDistribution(m.distributionList).ids);
        statusMutation.mutate({
            statusCode: (isTrash || folder === 'DRAFTS') ? 'PERMTRASH' : 'TRASH', statusFlag: 'Y', messageDetailsIdList: ids,
            successMessage: (isTrash || folder === 'DRAFTS') ? 'Mail Deleted Permanently' : 'Mail moved to trash',
            backAfter: true,
        });
    };

    const subject = messages[0]?.subjectName || 'No Subject';

    return (<div className="iam-thread">
      <div className="iam-thread-head">
        <div className="iam-thread-head-left">
          <button type="button" className="iam-icon-btn" title="Back to list" onClick={onBack}>
            <Glyph viewBox="0 0 24 24" width={22} height={22} fill="#000" path="M20,11V13H8L13.5,18.5L12.08,19.92L4.16,12L12.08,4.08L13.5,5.5L8,11H20Z" />
          </button>
          {!patientId && (
            <button type="button" className="iam-icon-btn" title="Move to trash" onClick={deleteConversation} disabled={!messages.length || statusMutation.isPending}>
              <Glyph viewBox="0 -960 960 960" width={20} height={20} fill="#000" path="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z" />
            </button>
          )}
        </div>
        <div className="iam-thread-head-right">
          <button type="button" className="iam-icon-btn" title="Previous Conversation" onClick={goPrev} disabled={idx <= 0}>
            <Glyph viewBox="0 -960 960 960" width={22} height={22} fill="#000" path="M560-240 320-480l240-240 56 56-184 184 184 184-56 56Z" />
          </button>
          <span className="iam-thread-count">{idx > -1 ? `${idx + 1} - ${recordsTotal}` : ''}</span>
          <button type="button" className="iam-icon-btn" title="Next Conversation" onClick={goNext} disabled={idx < 0 || idx >= siblings.length - 1}>
            <Glyph viewBox="0 -960 960 960" width={22} height={22} fill="#000" path="M504-480 320-664l56-56 240 240-240 240-56-56 184-184Z" />
          </button>
        </div>
      </div>

      <div className="iam-thread-body custom-scrollbar">
        {isLoading && <div className="p-3"><SkeletonList rows={5} /></div>}
        {!isLoading && (
          <>
            <div className="iam-thread-subject">
              <span>{subject}</span> <span className="iam-mail-count">{messages.length}</span>
            </div>
            {messages.map((msg) => {
              const self = selfDistribution(msg.distributionList);
              const { to, cc } = threadRecipients(msg.distributionList, msg.personName);
              const initial = (msg.personName || '').charAt(0).toUpperCase();
              const expanded = expandedIds.has(msg.mailId);
              const isDraft = msg.mailStatus === 'DRAFTS';

              return (
                <div key={msg.mailId} className="iam-message">
                  {isDraft ? (
                    <div className="iam-draft-message">
                      <div className="iam-draft-tag">DRAFT</div>
                      <InAppMailCompose
                        variant="inline"
                        sendType={msg.mailResponseTypeCode || 'ORGINL'}
                        parentMessageId={msg.parentMailId === 0 ? null : msg.parentMailId}
                        messageId={msg.mailId}
                        isDraft
                        draftDistributionList={msg.distributionList}
                        patientId={patientId}
                        prefill={composePrefill({ sendType: 'ORGINL', mailId: msg.mailId, allMessages: messages })}
                        onDone={() => onBack?.()}
                        onClose={() => onBack?.()} />
                    </div>
                  ) : expanded ? (
                    <div className="iam-message-full">
                      <div className="iam-message-header">
                        <div className="iam-message-from">
                          <span className="iam-avatar">{initial}</span>
                          <span role="button" title="Mark as read/unread" onClick={() => toggleRead(msg, self)}><ReadDot read={self.isRead === 'Y'} /></span>
                          <div className="iam-message-parties">
                            <div><span className="iam-party-label">From:</span> <span className="text-capitalize">{msg.personName}</span></div>
                            <div><span className="iam-party-label">To:</span> <span className="text-capitalize">{to}</span></div>
                            {!!cc && <div><span className="iam-party-label">Cc:</span> <span className="text-capitalize">{cc}</span></div>}
                          </div>
                        </div>
                        <div className="iam-message-meta">
                          <span className="iam-message-date">{formatThreadDate(msg.mailDateTime)}</span>
                          {!patientId && (
                            <button type="button" className="iam-icon-btn" title="Move to trash" onClick={() => deleteMessage(self)}>
                              <Glyph viewBox="0 -960 960 960" width={17} height={17} fill="#000" path="M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z" />
                            </button>
                          )}
                          <span role="button" title="Star" onClick={() => toggleStar(msg, self)}><StarIcon starred={self.isStarred === 'Y'} /></span>
                        </div>
                      </div>
                      <div className="iam-message-body" role="button" title="Collapse" onClick={() => toggleExpand(msg.mailId)} style={{ whiteSpace: 'pre-wrap' }}>{msg.messageBodyText}</div>
                      {!!msg.fileDetails?.length && (
                        <div className="iam-message-attachments">
                          {msg.fileDetails.map((f, i) => <Attachment key={i} file={f} onPreview={setPreview} />)}
                        </div>
                      )}
                      {reply?.mailId === msg.mailId
                        ? (<InAppMailCompose
                            variant="inline"
                            sendType={reply.type}
                            parentMessageId={current}
                            patientId={patientId}
                            prefill={composePrefill({ sendType: reply.type, mailId: msg.mailId, allMessages: messages })}
                            onDone={() => setReply(null)}
                            onClose={() => setReply(null)} />)
                        : <ReplyBar onReply={(type) => setReply({ mailId: msg.mailId, type })} />}
                    </div>
                  ) : (
                    <div className="iam-message-collapsed" role="button" onClick={() => toggleExpand(msg.mailId)}>
                      <span className="iam-avatar">{initial}</span>
                      <span title="Mark as read/unread" onClick={(e) => { e.stopPropagation(); toggleRead(msg, self); }}><ReadDot read={self.isRead === 'Y'} /></span>
                      <span className="iam-collapsed-name text-capitalize"><b>{(msg.personName || '').slice(0, 15)}{(msg.personName || '').length > 15 ? '...' : ''}</b></span>
                      <span className="iam-collapsed-snippet text-muted">{(msg.messageBodyText || '').substring(0, 110)}{(msg.messageBodyText || '').length >= 110 ? '...' : ''}</span>
                      <span className="iam-collapsed-date">{formatThreadDate(msg.mailDateTime)}</span>
                      <span title="Star" onClick={(e) => { e.stopPropagation(); toggleStar(msg, self); }}><StarIcon starred={self.isStarred === 'Y'} /></span>
                    </div>
                  )}
                </div>
              );
            })}
          </>
        )}
      </div>

      <Dialog header={`In-App Mail ${preview?.fileFormat ? preview.fileFormat.toUpperCase() : ''} Preview`} visible={!!preview}
        style={{ width: '80vw', maxWidth: 900 }} onHide={() => setPreview(null)} dismissableMask>
        {preview && (
          <div className="iam-preview-body">
            <p className="iam-preview-name">{preview.fileName}</p>
            {['jpeg', 'png', 'jpg'].includes((preview.fileFormat || '').toLowerCase())
              ? <img src={preview.fileUrl} alt={preview.fileName} className="iam-preview-media" />
              : <video src={preview.fileUrl} controls className="iam-preview-media" />}
          </div>
        )}
      </Dialog>
    </div>);
};
export default InAppMailThread;
