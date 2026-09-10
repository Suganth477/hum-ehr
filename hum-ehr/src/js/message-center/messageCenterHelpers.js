import moment, { userNow } from '../../utils/dayjs';
import { getLoggedInUser } from '../../services/authService';

/** Legacy utility.dateTimeFormats used across the chat renderers. */
export const FMT = { MDY_12H: 'MM-DD-YYYY hh:mm A', MDY: 'MM-DD-YYYY', _12H: 'hh:mm A' };

export const loggedInUserId = () => getLoggedInUser()?.userId;

/**
 * dateAndTimeForIndividualMessageInDashBoard — dashboard last-message time:
 * today → time (hh:mm A), yesterday → "Yesterday", else "MMM DD, YYYY".
 */
export const dashboardLastMessageTime = (messageDateTime) => {
    if (!messageDateTime) return '';
    const today = userNow().format(FMT.MDY);
    const yesterday = userNow().subtract(1, 'day').format(FMT.MDY);
    const created = moment(messageDateTime, FMT.MDY_12H).format(FMT.MDY);
    if (today === created) return moment(messageDateTime, FMT.MDY_12H).format(FMT._12H);
    if (yesterday === created) return 'Yesterday';
    return moment(messageDateTime, FMT.MDY_12H).format('MMM DD, YYYY');
};

/**
 * getAppropriateDateForMessage — per-message header label + time.
 * Returns { timestamp (Today/Yesterday/date), time (hh:mm A) }.
 */
export const appropriateMessageDate = (messageDateTime) => {
    const today = userNow().format(FMT.MDY);
    const yesterday = userNow().subtract(1, 'day').format(FMT.MDY);
    const created = moment(messageDateTime, FMT.MDY_12H).format(FMT.MDY);
    const time = moment(messageDateTime, FMT.MDY_12H).format(FMT._12H);
    let timestamp;
    if (today === created) timestamp = 'Today';
    else if (yesterday === created) timestamp = 'Yesterday';
    else timestamp = moment(messageDateTime, FMT.MDY_12H).format('MMM DD, YYYY');
    const dateKey = moment(messageDateTime, FMT.MDY_12H).format('YYYY-MM-DD');
    return { timestamp, time, dateKey };
};

/**
 * Normalize a raw dashboard record into the shape the list row + chat view need.
 * Mirrors recentChatUserNameWithLastMessage's author/distributor branching exactly.
 */
export const mapRecentChatUser = (messageDetails) => {
    const meId = loggedInUserId();
    const { messageAuthorId, distributorFullName, authorFullName } = messageDetails;
    const isMessageSent = messageAuthorId === meId;
    const name = isMessageSent ? distributorFullName : authorFullName;
    const splitName = (name || '').split(' ');
    const lastName = splitName[splitName.length - 1];

    const user = isMessageSent
        ? {
            userId: messageDetails.distributionUserId,
            userGender: messageDetails.distributorGenderCodeDesc,
            userDob: messageDetails.distributorDob,
            userName: messageDetails.distributorFullName,
            userRole: messageDetails.distributionUserRoleDesc,
            userPersonId: messageDetails.distributorPersonId,
        }
        : {
            userId: messageDetails.messageAuthorId,
            userGender: messageDetails.authorGenderCodeDesc,
            userDob: messageDetails.authorDob,
            userName: messageDetails.authorFullName,
            userRole: messageDetails.authorUserRoleDesc,
            userPersonId: messageDetails.authorPersonId,
        };

    return {
        name: name || '',
        firstName: name || '',
        lastName: lastName || '',
        initials: `${(name || '?').charAt(0)}${(lastName || '?').charAt(0)}`.toUpperCase(),
        userId: user.userId || '',
        userName: user.userName || '',
        userRole: user.userRole || '',
        userDob: user.userDob || '',
        userGender: user.userGender || '',
        userPersonId: user.userPersonId || '',
        isMessageSent,
        isMessageSentFlag: messageDetails.isMessageSentFlag || '',
        isDeactivated: messageDetails.isMessageSentFlag === 'N',
        attachmentType: messageDetails.attachmentType || '',
        decryptedMessage: messageDetails.decryptedMessage || '',
        unReadMessage: messageDetails.unReadMessage || 0,
        messageDateTime: messageDetails.messageDateTime || '',
        lastMessageTime: dashboardLastMessageTime(messageDetails.messageDateTime),
    };
};

/** Attachment last-message label for the list row (legacy displayMessageAttachmentTypeIcon). */
export const attachmentPreviewLabel = (attachmentType, isMessageSent) => {
    const status = isMessageSent ? 'Sent' : 'Received';
    switch (attachmentType) {
        case 'DOCU': return `Document ${status}`;
        case 'VIDEO': return `Video ${status}`;
        case 'AUDIO': return `Voice Message ${status}`;
        case 'IMG': return `Photo ${status}`;
        default: return '';
    }
};

/** Legacy fileFormattedMIMEType. */
export const attachmentMimeType = (attachmentType, fileFormat) => {
    switch (attachmentType) {
        case 'IMG': return 'image/jpeg';
        case 'VIDEO': return 'video/mp4';
        case 'AUDIO': return 'audio/wave';
        case 'DOCU': return fileFormat === 'pdf' ? 'application/pdf' : 'application/doc';
        default: return 'application/octet-stream';
    }
};

/** Legacy EhrCareTeamCommunicationUserList.getFileType — normalize an upload to a fileFormat. */
export const uploadFileFormat = (fileTypeGroup, extension) => {
    const ext = (extension || '').toLowerCase();
    if (fileTypeGroup === 'image') return 'jpeg';
    if (fileTypeGroup === 'video') return 'mp4';
    if (fileTypeGroup === 'application' && ext === 'pdf') return 'pdf';
    if (fileTypeGroup === 'application' && (ext === 'doc' || ext === 'docx')) return 'doc';
    if (fileTypeGroup === 'audio') return 'wav';
    return '';
};

/** Legacy utility._getAttachmentType — fileFormat + presence → attachmentType. */
export const attachmentTypeForFormat = (fileFormat, fileLength = 0) => {
    const fmt = fileFormat ? fileFormat.toLowerCase() : '';
    if (fileLength === 0) return null;
    if (['jpeg', 'jpg', 'png'].includes(fmt)) return 'IMG';
    if (fmt === 'mp4') return 'VIDEO';
    if (['pdf', 'docx', 'doc'].includes(fmt)) return 'DOCU';
    if (fmt === 'wav') return 'AUDIO';
    return null;
};

/** base64 (raw or data-URI) → Blob URL. Mirrors commonUtilityObject.base64ToBlobUrl usage. */
export const base64ToBlobUrl = (base64, mimeType) => {
    if (!base64) return '';
    const raw = base64.startsWith('data:') ? (base64.split(',')[1] || '') : base64;
    try {
        const byteChars = atob(raw);
        const byteNumbers = new Array(byteChars.length);
        for (let i = 0; i < byteChars.length; i += 1) byteNumbers[i] = byteChars.charCodeAt(i);
        return URL.createObjectURL(new Blob([new Uint8Array(byteNumbers)], { type: mimeType }));
    }
    catch (error) {
        console.error('Failed to build blob URL from base64.', error);
        return '';
    }
};

/**
 * Normalize a raw chat message record into what the bubble component renders.
 * Mirrors renderChatUserHistoryDetails + decryptedMessageBasedOnAttachment:
 * sent/received by author, per-message date header key, and (for attachments)
 * the decrypted base64 payload. The blob URL is built lazily by the bubble when
 * it scrolls into view (and revoked on unmount) — see P6 — so off-screen media
 * is never decoded and object URLs don't leak. Also flags unread messages
 * (received + isReadFlag 'N') so the caller can mark them read.
 */
export const mapChatMessage = (record) => {
    const meId = loggedInUserId();
    const {
        messageId, messageAuthorId, messageDateTime, decryptedTextMessage, attachmentType,
        distributionUserId, isReadFlag, attachmentDecryptedData, distributorFullName,
        fileDetails, messageDetailsId,
    } = record;
    const status = meId === messageAuthorId ? 'sent' : 'received';
    const isUnread = meId === distributionUserId && isReadFlag === 'N';
    // Legacy keys the attachment off fileDetails.length (renderChatUserHistoryDetails
    // line 465) and reads the format from fileDetails[0]. The decrypted media base64
    // arrives inline on each record (attachmentDecryptedData) — no separate media fetch.
    const hasAttachment = Array.isArray(fileDetails) && fileDetails.length > 0;
    const fileFormat = (hasAttachment ? fileDetails[0].fileFormat : '') || '';
    const { timestamp, time, dateKey } = appropriateMessageDate(messageDateTime);

    let attachment = null;
    if (hasAttachment) {
        attachment = {
            type: attachmentType,
            fileFormat,
            base64: attachmentDecryptedData || '',
        };
    }
    return {
        messageId,
        messageDetailsId,
        status,
        isUnread,
        text: decryptedTextMessage || '',
        time,
        dayHeader: timestamp,
        dateKey,
        distributorFullName: distributorFullName || '',
        attachment,
    };
};
