import moment, { userNow } from '../../utils/dayjs';
import { getLoggedInUser } from '../../services/authService';
import { attachmentTypeForFormat } from './messageCenterHelpers';

/**
 * Pure render/logic helpers for the In-App Mail conversation list — direct ports of
 * the string/date/name builders in the legacy
 * `care-team-communication/in.app.mail.conversation.list.js` (InAppMailConversationList).
 * Kept framework-free so the JSX components stay declarative.
 */

/** Legacy list page size (data-start-index steps by this). */
export const PAGE_SIZE = 25;

/** Legacy utility.dateTimeFormats subset used by the list date renderer. */
const FMT = { MDY_12H: 'MM-DD-YYYY hh:mm A', MDY: 'MM-DD-YYYY', _12H: 'hh:mm A' };

/**
 * Folder rail — order + labels + exact folder glyphs from in-app-mail-conversation-list.jsp.
 * `code` is the backend conversation-type. `countKey` maps to the /inAppMail/count
 * response field shown as a badge (Inbox shows UNREAD, Drafts shows DRAFTS).
 */
export const FOLDERS = [
    { code: 'INBOX', label: 'Inbox', countKey: 'UNREAD', viewBox: '0 0 24 24', path: 'M19,15H15A3,3 0 0,1 12,18A3,3 0 0,1 9,15H5V5H19M19,3H5C3.89,3 3,3.9 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19V5A2,2 0 0,0 19,3Z' },
    { code: 'DRAFTS', label: 'Drafts', countKey: 'DRAFTS', viewBox: '0 -960 960 960', path: 'M240-80q-33 0-56.5-23.5T160-160v-640q0-33 23.5-56.5T240-880h320l240 240v480q0 33-23.5 56.5T720-80H240Zm280-520v-200H240v640h480v-440H520ZM240-800v200-200 640-640Z' },
    { code: 'SENT', label: 'Sent', countKey: null, viewBox: '0 -960 960 960', path: 'M120-160v-640l760 320-760 320Zm80-120 474-200-474-200v140l240 60-240 60v140Zm0 0v-400 400Z' },
    { code: 'STARRED', label: 'Starred', countKey: null, viewBox: '0 -960 960 960', path: 'm354-287 126-76 126 77-33-144 111-96-146-13-58-136-58 135-146 13 111 97-33 143ZM233-120l65-281L80-590l288-25 112-265 112 265 288 25-218 189 65 281-247-149-247 149Zm247-350Z' },
    { code: 'TRASH', label: 'Trash', countKey: null, viewBox: '0 -960 960 960', path: 'M280-120q-33 0-56.5-23.5T200-200v-520h-40v-80h200v-40h240v40h200v80h-40v520q0 33-23.5 56.5T680-120H280Zm400-600H280v520h400v-520ZM360-280h80v-360h-80v360Zm160 0h80v-360h-80v360ZM280-720v520-520Z' },
];

/**
 * getActionDetailsBasedOnStatus — bulk action-bar buttons keyed by data-status-change-type.
 * Each yields the exact { statusCode, statusFlag } sent to /business/message/status-update
 * plus the confirmation copy shown before applying.
 */
export const ACTION_BY_STATUS = {
    TRASH: { statusCode: 'TRASH', statusFlag: 'Y', confirmationContent: 'Do you want to move the mail to trash?' },
    RESTORE_TRASH: { statusCode: 'TRASH', statusFlag: 'N', confirmationContent: 'Do you want to restore the selected trash list?' },
    PERMTRASH: { statusCode: 'PERMTRASH', statusFlag: 'Y', confirmationContent: 'Do you want to delete the mail permanently?' },
    STARD: { statusCode: 'STARD', statusFlag: 'Y', confirmationContent: 'Do you want to star the mail?' },
    UNSTARD: { statusCode: 'STARD', statusFlag: 'N', confirmationContent: 'Do you want to unstar the mail?' },
    READ: { statusCode: 'READ', statusFlag: 'Y', confirmationContent: 'Do you want to change as marked as read?' },
    UNREAD: { statusCode: 'READ', statusFlag: 'N', confirmationContent: 'Do you want to change as marked as unread?' },
};

/**
 * Which bulk action buttons show for a folder (legacy checkBoxChangeActionToShowActionICon +
 * the head template). Star/unstar/read/unread always show; trash-vs-permanent-delete and
 * restore depend on the folder. Returned in the head's left-to-right order.
 */
export const bulkActionsForFolder = (folder) => {
    const isTrashOrDrafts = folder === 'TRASH' || folder === 'DRAFTS';
    const actions = [];
    if (isTrashOrDrafts)
        actions.push('PERMTRASH');
    else
        actions.push('TRASH');
    if (folder === 'TRASH')
        actions.push('RESTORE_TRASH');
    actions.push('STARD', 'UNSTARD', 'READ', 'UNREAD');
    return actions;
};

/**
 * moveMailToTrashOrMoveToInbox — the per-row trash/restore icon. In Trash the restore
 * icon un-trashes (TRASH/N) and the permanent icon deletes (PERMTRASH/Y); Drafts deletes
 * permanently; every other folder moves to trash (TRASH/Y).
 * @param {string} folder                conversation-type of the current list.
 * @param {'Y'|'N'} isMailTrash          row's data-is-mail-trash.
 * @param {boolean} isPermanentIcon      true for the permanent-delete glyph, false for the trash/restore glyph.
 */
export const rowTrashParams = (folder, isMailTrash, isPermanentIcon) => ({
    statusCode: isPermanentIcon ? 'PERMTRASH' : 'TRASH',
    statusFlag: isPermanentIcon ? 'Y' : (isMailTrash === 'N' ? 'Y' : 'N'),
});

/**
 * conversationNameListForListConversation — recipient display: dedupe the distribution
 * list by user, drop the logged-in user, title-case each name, join with ", ".
 */
export const recipientNames = (distributionList = []) => {
    const selfId = getLoggedInUser()?.userId;
    const unique = Object.values(distributionList.reduce((acc, curr) => {
        acc[curr.distributionUserId] = curr;
        return acc;
    }, {}));
    return unique
        .filter((each) => each.distributionUserId !== selfId)
        .map((item) => (item.distributorName || '')
            .split(' ')
            .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
            .join(' '))
        .join(', ');
};

/** constructNameForMailList — names truncate at 20 chars with an ellipsis. */
export const truncateName = (names = '') => (names.length <= 20 ? names : `${names.slice(0, 20)}...`);

/** The logged-in user's distributionId(s) for a mail — the ids sent in messageDetailsIdList. */
export const rowDistributionIds = (distributionList = []) => {
    const selfId = getLoggedInUser()?.userId;
    return distributionList
        .filter((each) => each.distributionUserId === selfId)
        .map((each) => each.distributionId);
};

/**
 * subjectAndMainMessageJoinBasedOnLength — the subject + snippet cell. Returns structured
 * pieces for JSX instead of an HTML string. A very long subject (>=100) is shown alone,
 * truncated; otherwise subject + thread count + a DRAFTS tag + a trimmed body snippet.
 */
export const subjectSnippet = (subjectName = '', mainMessage = '', mailCount = 0, mailIsRead = 'Y', mailStatus = '') => {
    const subjectLen = subjectName.length;
    const body = mainMessage || '';
    if (subjectLen >= 100) {
        return {
            longSubject: true,
            unread: mailIsRead === 'N',
            subject: subjectName.slice(0, 100),
            ellipsis: subjectLen >= 100,
        };
    }
    const budget = 100 - (subjectLen === 0 ? 13 : subjectLen);
    return {
        longSubject: false,
        unread: mailIsRead === 'N',
        subject: subjectName || '(No Subject)',
        count: mailCount || 0,
        isDraft: mailStatus === 'DRAFTS',
        snippet: body.slice(0, budget),
        ellipsis: ((subjectLen === 0 ? 13 : subjectLen) + body.length) >= 100,
    };
};

/**
 * constructTimeForConversationList — today → time only, same calendar year → "MMM DD",
 * else "MM/DD/YYYY". Legacy compares against the logged-in user's current date.
 */
export const formatListDate = (dateAndTime) => {
    if (!dateAndTime)
        return '';
    const today = userNow().format(FMT.MDY);
    const created = moment(dateAndTime, FMT.MDY_12H).format(FMT.MDY);
    if (today === created)
        return moment(dateAndTime, FMT.MDY_12H).format(FMT._12H);
    if (today.split('-')[2] === created.split('-')[2])
        return moment(dateAndTime, FMT.MDY_12H).format('MMM DD');
    return moment(dateAndTime, FMT.MDY_12H).format('MM/DD/YYYY');
};

/**
 * svgIconBasedOnFileFormat — attachment glyph descriptor. Multiple attachments show a
 * paperclip; otherwise an image/video/pdf/doc glyph by format. Returns null when there is
 * nothing to show (matches the legacy empty-string default). Exact paths from legacy.
 */
export const attachmentIconDesc = (fileFormat = '', count = 1) => {
    if (count > 1)
        return { viewBox: '0 -960 960 960', path: 'M728-326q0 103-72.175 174.5t-175 71.5Q378-80 305.5-151.5 233-223 233-326v-380q0-72.5 51.5-123.25T408-880q72 0 123.5 50.75T583-706v360q0 42-30 72t-72.5 30q-42.5 0-72.5-29.673-30-29.672-30-72.327v-370h60v370q0 17 12.5 29.5t30.64 12.5q18.139 0 30-12.5Q523-329 523-346v-360q0-48-33.5-81t-81.711-33q-48.212 0-81.5 33.06Q293-753.88 293-706v380q0 78 54.971 132T481-140q77.917 0 132.458-54Q668-248 668-326v-390h60v390Z' };
    switch ((fileFormat || '').toLowerCase()) {
        case 'jpeg':
        case 'png':
        case 'jpg':
            return { viewBox: '0 0 24 24', path: 'M8.5,13.5L11,16.5L14.5,12L19,18H5M21,19V5C21,3.89 20.1,3 19,3H5A2,2 0 0,0 3,5V19A2,2 0 0,0 5,21H19A2,2 0 0,0 21,19Z' };
        case 'mp4':
        case 'quicktime':
        case 'mov':
            return { viewBox: '0 0 24 24', path: 'M17,10.5V7A1,1 0 0,0 16,6H4A1,1 0 0,0 3,7V17A1,1 0 0,0 4,18H16A1,1 0 0,0 17,17V13.5L21,17.5V6.5L17,10.5Z' };
        case 'pdf':
            return { viewBox: '0 -960 960 960', path: 'M360-460h40v-80h40q17 0 28.5-11.5T480-580v-40q0-17-11.5-28.5T440-660h-80v200Zm40-120v-40h40v40h-40Zm120 120h80q17 0 28.5-11.5T640-500v-120q0-17-11.5-28.5T600-660h-80v200Zm40-40v-120h40v120h-40Zm120 40h40v-80h40v-40h-40v-40h40v-40h-80v200ZM320-240q-33 0-56.5-23.5T240-320v-480q0-33 23.5-56.5T320-880h480q33 0 56.5 23.5T880-800v480q0 33-23.5 56.5T800-240H320Zm0-80h480v-480H320v480ZM160-80q-33 0-56.5-23.5T80-160v-560h80v560h560v80H160Zm160-720v480-480Z' };
        case 'doc':
        case 'docx':
            return { viewBox: '0 0 24 24', path: 'M13,9H18.5L13,3.5V9M6,2H14L20,8V20A2,2 0 0,1 18,22H6C4.89,22 4,21.1 4,20V4C4,2.89 4.89,2 6,2M15,18V16H6V18H15M18,14V12H6V14H18Z' };
        default:
            return null;
    }
};

// ---- thread reader (InAppMailEachFullConversationMessage) helpers ----

/** Full-conversation timestamp — legacy "ddd, MMM D [at] h:mm A". */
export const formatThreadDate = (dateTime) => (dateTime ? moment(dateTime, FMT.MDY_12H).format('ddd, MMM D [at] h:mm A') : '');

/**
 * To / Cc name lists for a message header — every distributor except the sender,
 * split by the CC flag (legacy toPersonNameList / ccPersonNameList).
 */
export const threadRecipients = (distributionList = [], personName = '') => ({
    to: distributionList
        .filter((p) => p.distributorName !== personName && p.distributionUserInCCFlag === 'N')
        .map((p) => p.distributorName).join(', '),
    cc: distributionList
        .filter((p) => p.distributorName !== personName && p.distributionUserInCCFlag === 'Y')
        .map((p) => p.distributorName).join(', '),
});

/**
 * The logged-in user's per-message state: their distributionId(s) (for read/star/delete)
 * plus their read + starred flags for this message.
 */
export const selfDistribution = (distributionList = []) => {
    const selfId = getLoggedInUser()?.userId;
    const mine = distributionList.filter((e) => e.distributionUserId === selfId);
    return {
        ids: mine.map((e) => e.distributionId),
        isStarred: mine.map((e) => e.mailIsStarred)[0],
        isRead: mine.map((e) => e.mailIsRead)[0],
    };
};

/** fileNameSliceForLabel — keep names ≤23 chars; otherwise trim to 18 + ellipsis + format. */
export const fileNameSliceForLabel = (fileName = '', fileFormat = '') => {
    if (fileName.length <= 23)
        return fileName;
    const parts = fileName.split('.');
    parts.pop();
    return `${parts.join('.').slice(0, 18)}...${fileFormat}`;
};

/** Formats the browser can preview inline (image/video); others are downloaded. */
export const PREVIEWABLE_FORMATS = ['jpg', 'jpeg', 'png', 'mp4', 'quicktime', 'mov'];

// ---- compose (InAppMailComposeMessageSend) helpers ----

/** Compose attachment limits (legacy: 5 files, 10 MB each, these formats). */
export const COMPOSE_MAX_FILES = 5;
export const COMPOSE_MAX_SIZE_MB = 10;
export const COMPOSE_ALLOWED_MIME = [
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf', 'image/jpg', 'image/jpeg', 'image/png', 'video/mp4', 'video/mov', 'video/quicktime',
];

const mapTag = (d) => ({ distributionUserId: d.distributionUserId, distributorName: d.distributorName, distributionId: d.distributionId });

/** setSubjectValueInComposeContainer — prepend Re:/Fwd: unless the subject already carries it. */
const subjectWithPrefix = (subject = '', prefix) => ((subject || '').split(':')[0] === prefix ? subject : `${prefix}: ${subject}`);

/**
 * Reply / Reply All / Forward / draft prefill (legacy setToCcInputValueForComposeContainer
 * + setSubjectValueInComposeContainer + the FORWD/DRAFTS body+file load). `allMessages` is
 * the fetched thread (InAppMailEachFullConversationMessage.saveEachMailData); `mailId` is the
 * specific message being acted on. Returns tag lists + subject/body + existing attachments.
 */
export const composePrefill = ({ sendType, mailId, allMessages = [] }) => {
    const selfId = getLoggedInUser()?.userId;
    const source = allMessages.find((m) => m.mailId === mailId) || allMessages[0] || {};
    const threadSubject = allMessages[0]?.subjectName || '';
    const activeBy = (list, ccFlag) => (list || []).filter((e) => e.distributionUserInCCFlag === ccFlag
        && e.distributionUserId !== selfId && e.distributorIsActive === 'Y');
    let to = [];
    let cc = [];
    let subject = '';
    let body = '';
    let files = [];

    if (sendType === 'REPLY') {
        to = source.mailAuthourId === selfId
            ? activeBy(source.distributionList, 'N')
            : (source.distributionList || []).filter((e) => e.distributionUserId === source.mailAuthourId);
        subject = subjectWithPrefix(threadSubject, 'Re');
    } else if (sendType === 'REPLYALL') {
        const all = allMessages.flatMap((m) => m.distributionList || []);
        const unique = Object.values(all.reduce((acc, curr) => { acc[curr.distributionUserId] = curr; return acc; }, {}));
        to = unique.filter((e) => e.distributionUserId !== selfId && e.distributionUserInCCFlag === 'N' && e.distributorIsActive === 'Y');
        cc = unique.filter((e) => e.distributionUserId !== selfId && e.distributionUserInCCFlag === 'Y' && e.distributorIsActive === 'Y');
        subject = subjectWithPrefix(threadSubject, 'Re');
    } else if (sendType === 'FORWD') {
        subject = subjectWithPrefix(threadSubject, 'Fwd');
        body = source.messageBodyText || '';
        files = source.fileDetails || [];
    } else { // ORGINL — draft edit
        to = activeBy(source.distributionList, 'N');
        cc = activeBy(source.distributionList, 'Y');
        subject = source.subjectName || '';
        body = source.messageBodyText || '';
        files = source.fileDetails || [];
    }
    return {
        to: to.map(mapTag),
        cc: cc.map(mapTag),
        subject,
        body,
        files: (files || []).map((f) => ({ ...f, existing: f.attachmentId != null })),
    };
};

/**
 * UserDistributionIds — the messageDistribution payload. New/reply/forward: the sender (To,
 * flag N) plus every tag with its To/Cc flag. Draft: reuse the saved distribution objects for
 * the sender and for any tag whose user + CC-flag is unchanged (preserving distributionId),
 * else a fresh entry.
 */
export const buildMessageDistribution = ({ toTags = [], ccTags = [], isDraft = false, draftDistributionList = [] }) => {
    const selfId = getLoggedInUser()?.userId;
    const tags = [...toTags.map((t) => ({ ...t, cc: 'N' })), ...ccTags.map((t) => ({ ...t, cc: 'Y' }))];
    if (!isDraft) {
        return [
            { distributionUserId: selfId, distributionUserInCCFlag: 'N' },
            ...tags.map((t) => ({ distributionUserId: t.distributionUserId, distributionUserInCCFlag: t.cc })),
        ];
    }
    const arr = [];
    const selfObj = draftDistributionList.find((e) => e.distributionUserId === selfId);
    if (selfObj)
        arr.push(selfObj);
    tags.forEach((t) => {
        const existing = draftDistributionList.find((e) => e.distributionUserId === t.distributionUserId);
        if (existing && existing.distributionUserInCCFlag === t.cc)
            arr.push(existing);
        else
            arr.push({ distributionUserId: t.distributionUserId, distributionUserInCCFlag: t.cc });
    });
    return arr;
};

/**
 * fileDetailsListForInAppMail — a newly-picked file carries its base64 + metadata; an existing
 * (already-uploaded) attachment carries only its attachmentId.
 */
export const buildFileDetails = (files = []) => files.map((f) => {
    if (f.existing || f.attachmentId != null)
        return { attachmentId: f.attachmentId };
    return {
        file: f.encoded,
        fileFormat: f.fileFormat,
        fileSize: f.fileSize,
        messageAttachmentTypeCode: attachmentTypeForFormat(f.fileFormat, 1),
        fileName: f.fileName,
    };
});

/** Map a /inAppMail/contact result row to a recipient tag. */
export const contactToTag = (contact) => ({ distributionUserId: contact.userId, distributorName: contact.fullName });
