import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
    fetchDirectMessageConversation, updateDirectMessageStatus, downloadDirectMessageAttachment,
} from '../../services/directAddressService';
import { useNotify } from '../../context/NotificationContext';
import { useOpenPatientChart } from '../../hooks/useOpenPatientChart';
import { SkeletonList } from '../../components/common/ContentLoader';
import { LegacyIcon } from '../../components/common/CustomIcons';
import DirectAddressCompose from './DirectAddressCompose';
import {
    formatConversationDate, formatPatientDobIso, titleCase, mimeForFormat,
    DRAFT_STATUS, SILENT_STATUS_CODES, ERROR_STATUS_CODES, ARCHIVED_VISIBILITY,
} from './directAddressHelpers';
import { base64ToBlob } from '../../utils/commonUtility';

/** File-type glyph for an attachment chip (legacy getFileIconsBasedOnFileType). */
const attachmentIcon = (fileFormat = '') => {
    switch (fileFormat) {
        case 'pdf':
        case 'application/pdf':
            return 'fa-file-pdf';
        case 'xml':
        case 'application/xml':
            return 'fa-file-code';
        default:
            return 'fa-file';
    }
};

/**
 * Direct Address conversation reader (legacy EhrDirectMessageIndividualConversation).
 *
 * Shows every sent message in a thread — parties, date, subject, body, the linked
 * patient (click to open their chart), the transport status when it is worth
 * showing, and the attachments (click to download). Each message carries
 * Archive/Unarchive and Reply; replying opens the composer inline beneath it, and
 * any draft already written against a message reopens in place.
 *
 * Opening the thread marks the message that was clicked as read.
 */
const DirectAddressConversation = ({ directAddress, messageId, parentMessageId, onBack }) => {
    const { notifySuccess, notifyError, notify } = useNotify();
    const queryClient = useQueryClient();
    const openPatientChart = useOpenPatientChart();
    const [replyForMessageId, setReplyForMessageId] = useState(null);
    const markedReadRef = useRef(null);

    const { data, isLoading, isError, error } = useQuery({
        queryKey: ['directMessageConversation', parentMessageId],
        queryFn: () => fetchDirectMessageConversation(parentMessageId),
        enabled: parentMessageId != null,
    });

    useEffect(() => {
        if (isError) {
            console.error('failed to get direct message details.', error);
            notifyError(error?.message || 'failed to get direct message details. Please try again.');
            onBack?.();
        }
    }, [isError, error, notifyError, onBack]);

    // Mark the opened message read (fire-and-forget, exactly once per message).
    useEffect(() => {
        if (!messageId || markedReadRef.current === messageId)
            return;
        markedReadRef.current = messageId;
        updateDirectMessageStatus({ directMessageIdList: [messageId], isRead: 'Y' })
            .then(() => queryClient.invalidateQueries({ queryKey: ['directMessageList'] }))
            .catch((err) => console.error('Failed to mark the direct message as read.', err));
    }, [messageId, queryClient]);

    const conversation = data?.status === 'success' ? data.data : null;
    const messages = useMemo(() => conversation?.messages || [], [conversation]);
    const sentMessages = useMemo(() => messages.filter((m) => m.status !== DRAFT_STATUS), [messages]);
    const draftMessages = useMemo(() => messages.filter((m) => m.status === DRAFT_STATUS), [messages]);

    /**
     * Which message each draft hangs under: the one it answers, or — when that
     * message is not part of this thread's rendered list — the newest message.
     */
    const draftsByAnchor = useMemo(() => {
        const anchors = new Map();
        if (!sentMessages.length)
            return anchors;
        const lastId = sentMessages[sentMessages.length - 1].messageId;
        draftMessages.forEach((draft) => {
            const anchored = sentMessages.some((m) => m.messageId === draft.parentMessageId);
            const key = anchored ? draft.parentMessageId : lastId;
            anchors.set(key, [...(anchors.get(key) || []), draft]);
        });
        return anchors;
    }, [sentMessages, draftMessages]);

    const archiveMutation = useMutation({
        mutationFn: ({ id, isArchived }) => updateDirectMessageStatus({ directMessageIdList: [id], isArchived }),
        onSuccess: (response) => {
            if (response?.status === 'success') {
                notifySuccess(response.data);
                onBack?.();
                return;
            }
            if (response?.status === 'warning') {
                notify({ severity: 'warn', summary: 'Warning', detail: response.data });
                return;
            }
            notifyError('Failed to archive message. Please try again later');
        },
        onError: (err) => {
            console.error('Failed to archive message.', err);
            notifyError('Failed to archive message. Please try again later');
        },
    });

    const downloadAttachment = async (attachment) => {
        try {
            const response = await downloadDirectMessageAttachment(attachment.attachmentId);
            if (response?.status !== 'success' || !response.data?.file)
                throw new Error(response?.data || 'Failed to Download File. Please Try Again Later.');
            // The API returns the file base64-encoded inside the JSON envelope.
            const blob = base64ToBlob(response.data.file, mimeForFormat(attachment.fileFormat));
            const link = document.createElement('a');
            link.href = URL.createObjectURL(blob);
            link.download = attachment.fileName || 'attachment';
            document.body.appendChild(link);
            link.click();
            link.remove();
            URL.revokeObjectURL(link.href);
        }
        catch (err) {
            console.error('Failed to download the direct message attachment.', err);
            notifyError(err?.message || 'Failed to Download File. Please Try Again Later.');
        }
    };

    const openPatient = async (patientId) => {
        try {
            await openPatientChart(patientId);
        }
        catch (err) {
            console.error('Failed to open the patient chart.', err);
            notifyError(err?.message || 'Failed to open the patient chart.');
        }
    };

    if (isLoading)
        return <div className="eda-conversation p-3"><SkeletonList rows={5} /></div>;

    return (<div className="eda-conversation">
      <div className="eda-conversation-body custom-scrollbar">
        {sentMessages.map((message) => {
          const drafts = draftsByAnchor.get(message.messageId) || [];
          const replyOpen = replyForMessageId === message.messageId;
          const archived = message.visibilityCode === ARCHIVED_VISIBILITY;
          const showStatus = !SILENT_STATUS_CODES.includes(message.status) && !!message.statusDescription;
          return (
            <div key={message.messageId} className="eda-message">
              <div className="eda-message-head">
                <span className="eda-avatar"><LegacyIcon icon="fa-user" /></span>
                <div className="eda-message-parties">
                  <span className="fw-bold">{`To: ${message.recipientAddress || ''}`}</span>
                  <span>{`From: ${message.senderAddress || ''}`}</span>
                </div>
                <span className="eda-message-date">{formatConversationDate(message.messageDate)}</span>
              </div>

              <div className="eda-message-subject">{message.subject || '(no subject)'}</div>
              <div className="eda-message-body">{message.body}</div>

              {!!message.patientId && (
                <div className="eda-message-patient" role="button" onClick={() => openPatient(message.patientId)}>
                  <LegacyIcon icon="fa-user" className="me-1" />
                  <span className="eda-message-patient-name">{titleCase(message.patientName)}</span>
                  <span className="ms-1">{formatPatientDobIso(message.patientDob)}</span>
                  <span className="eda-open-chart ms-2">(Open Chart)</span>
                </div>
              )}

              {showStatus && (
                <div className={`eda-message-status ${ERROR_STATUS_CODES.includes(message.status) ? 'eda-status-error' : ''}`}>
                  {message.statusDescription}
                </div>
              )}

              {message.attachments?.length > 0 && (
                <div className="eda-message-attachments">
                  <div className="eda-attachments-title">{`${message.attachments.length} Attachments`}</div>
                  <div className="eda-attachments-row">
                    {message.attachments.map((attachment) => (
                      <div key={attachment.attachmentId} className="eda-attachment-chip" role="button"
                        title="Download attachment" onClick={() => downloadAttachment(attachment)}>
                        <LegacyIcon icon={attachmentIcon(attachment.fileFormat)} className="eda-attachment-icon me-2" />
                        <span className="eda-attachment-name">{attachment.fileName}</span>
                        <LegacyIcon icon="mdi-download" className="eda-attachment-download ms-2" />
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {!replyOpen && !drafts.length && (
                <div className="eda-message-actions">
                  <button type="button" className="eda-message-action" onClick={() => setReplyForMessageId(message.messageId)}>
                    <LegacyIcon icon="fa-reply" className="eda-action-glyph" />
                    <span className="eda-action-label">Reply</span>
                  </button>
                  <button type="button" className="eda-message-action" disabled={archiveMutation.isPending}
                    onClick={() => archiveMutation.mutate({ id: message.messageId, isArchived: archived ? 'N' : 'Y' })}>
                    <LegacyIcon icon="fa-box-archive" className="eda-action-glyph" />
                    <span className="eda-action-label">{archived ? 'Unarchive' : 'Archive'}</span>
                  </button>
                </div>
              )}

              {/* A draft already written against this message reopens in place. */}
              {drafts.map((draft) => (
                <div key={draft.messageId} className="eda-inline-compose">
                  <DirectAddressCompose
                    directAddress={directAddress}
                    variant="inline"
                    messageId={draft.messageId}
                    relationMessageId={draft.parentMessageId}
                    parentMessageId={parentMessageId}
                    draftDetails={draft}
                    threadSubject={conversation?.subject}
                    onClose={onBack} />
                </div>
              ))}

              {replyOpen && (
                <div className="eda-inline-compose">
                  <DirectAddressCompose
                    directAddress={directAddress}
                    variant="inline"
                    relationMessageId={messageId}
                    parentMessageId={parentMessageId}
                    replyToMessage={messages.find((m) => m.messageId === parseInt(parentMessageId, 10)) || message}
                    threadSubject={conversation?.subject}
                    onClose={onBack}
                    onDiscard={() => setReplyForMessageId(null)} />
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>);
};
export default DirectAddressConversation;
