import moment from '../../utils/dayjs';
import { getLoggedInUser } from '../../services/authService';

/**
 * Pure render/logic helpers for the Direct Address (Direct Secure Messaging) surface —
 * direct ports of the string/date/param builders in the legacy
 * `hum-js/message-center/ehr.message.center.js` (EhrDirectAdressMainElement,
 * EhrDirectAdressMessagesList, EhrDirectMessageIndividualConversation,
 * EhrDirectAddressComposeDirectMessage). Kept framework-free so the JSX stays declarative.
 */

/** Legacy utility.dateTimeFormats subset used by the direct-message renderers. */
const FMT = { MDY: 'MM-DD-YYYY', MDY_12H: 'MM-DD-YYYY hh:mm A', YMD: 'YYYY-MM-DD' };

/**
 * Shared query key for the user's direct-address list: the Message Center shell
 * reads it to decide whether the Direct Inbox tab shows at all, and the surface
 * itself reads the same cache entry, so it is fetched once.
 */
export const DIRECT_ADDRESS_LIST_KEY = ['directAddressList'];

/**
 * The care group the mailbox belongs to, for the send payload's `careGroupId`.
 *
 * Legacy reads it straight off the server-rendered `<body data-group-id>`
 * (`ehr-layout.jsp` stamps `userLoginDetails.getCareGroupId()`), so under
 * JSP↔React coexistence — where the React bundle is served inside that same
 * layout — the attribute is the authoritative source and is read first here.
 *
 * TODO(backend): standalone React (`index.html`) has no such attribute, and the
 * `X-Auth-Token` JWT carries no careGroupId/groupId claim (verified against the
 * staging token: sub, userId, roleCode, humRoleCode, timezone, loggedInPhysicianId,
 * loggedInClinicianId, the admin flags, auditLogUUID, exp/iat/jti — no care group).
 * So outside coexistence this resolves to null. Confirm with the backend whether
 * /direct/message/send derives the care group from the token (the legacy Java login
 * controller also posts a null careGroupId), or expose it on the login response /
 * as a JWT claim and read it here.
 */
export const getCareGroupId = () => {
    const fromLayout = typeof document !== 'undefined' ? document.body?.dataset?.groupId : null;
    if (fromLayout)
        return fromLayout;
    const user = getLoggedInUser();
    return user?.careGroupId ?? user?.groupId ?? null;
};

// ---- mailbox (direct address) selection ----

/**
 * constructDirectAddressListDropDownAndConversationList — flatten the
 * /direct/address response into one selectable list: the user's own physician
 * direct address first (when they have one), then every facility address.
 * @param {{physicianDirect?: Object|null, facilities?: Object[]}} [data]
 */
export const consolidateDirectAddresses = (data) => {
    if (!data)
        return [];
    const { physicianDirect, facilities } = data;
    return [
        ...(physicianDirect ? [physicianDirect] : []),
        ...(Array.isArray(facilities) ? facilities : []),
    ];
};

/** Whether the Direct Inbox tab shows at all (legacy getDirectAddressIconIfConfigured). */
export const hasDirectAddressConfigured = (data) => Boolean(data?.physicianDirect) || (data?.facilities?.length > 0);

/** Dropdown row label — the full address, falling back to subdomain.baseDomain. */
export const directAddressLabel = (address) => address?.fullAddress
    || (address?.directSubdomain && address?.directBaseDomain
        ? `${address.directSubdomain}.${address.directBaseDomain}`
        : '');

/**
 * A personal (provider) address renders a person glyph, a facility address a
 * building glyph. Legacy keys the dropdown rows off `providerId` and the selected
 * button off `physicianId` — both are kept so either shape resolves.
 */
export const isProviderAddress = (address) => Boolean(address?.providerId || address?.physicianId);

// ---- message list ----

/**
 * getFromToSectionContent — the from/to column. Outbound shows the recipient
 * prefixed with "To:", every other section shows the sender. Truncated at 24 chars.
 */
export const fromToSectionContent = (sectionType, recipientAddress, senderAddress) => {
    const prefix = sectionType === 'OUTBOUND' ? 'To:' : '';
    const content = `${prefix}${(sectionType === 'OUTBOUND' ? recipientAddress : senderAddress) || ''}`;
    return content.length > 24 ? content.substring(0, 24) : content;
};

/**
 * getMessageSubjectAndPreviewContent — subject (bold) + body preview inside an
 * 80-char budget. A subject that fills the budget on its own is truncated and the
 * preview dropped; an empty subject renders "(no subject)" un-bolded.
 * Returns the pieces for JSX instead of an HTML string.
 */
export const subjectAndPreview = ({ subject, body = '' }) => {
    const MAX = 80;
    const trimmed = (subject || '').trim();
    const subjectText = trimmed || '(no subject)';
    if (subjectText.length > MAX)
        return { subject: `${subjectText.slice(0, MAX)}…`, bold: Boolean(trimmed), preview: null };
    const remaining = MAX - subjectText.length;
    const previewBody = body || '';
    return {
        subject: subjectText,
        bold: Boolean(trimmed),
        preview: `${previewBody.slice(0, remaining)}${previewBody.length > remaining ? '…' : ''}`,
    };
};

/** List column date — legacy parses MM-DD-YYYY and renders "MMM D, YYYY". */
export const formatMessageListDate = (messageDate) => (messageDate ? moment(messageDate, FMT.MDY).format('MMM D, YYYY') : '');

/** Conversation header date — legacy "MMM D, YYYY hh:mm A" off MM-DD-YYYY hh:mm A. */
export const formatConversationDate = (messageDate) => (messageDate ? moment(messageDate, FMT.MDY_12H).format('MMM D, YYYY hh:mm A') : '');

/** Linked-patient DOB in a conversation (details API sends ISO). */
export const formatPatientDobIso = (dob) => (dob ? moment(dob, FMT.YMD).format('MMM D, YYYY') : '');

/** Linked-patient DOB in the composer (patient lookup sends MM-DD-YYYY). */
export const formatPatientDobMdy = (dob) => (dob ? moment(dob, FMT.MDY).format('MMM D, YYYY') : '');

/** ISO (details API) -> MM-DD-YYYY (the shape the patient lookup and composer use). */
export const isoDateToMdy = (dob) => (dob ? moment(dob, FMT.YMD).format(FMT.MDY) : '');

/** makeUpperCaseOfEachString — title-case a name for display. */
export const titleCase = (text) => (text
    ? text.toLowerCase().split(' ').map((word) => word.charAt(0).toUpperCase() + word.substring(1)).join(' ')
    : '');

/** toTitleCase — section labels ("INBOUND" -> "Inbound") used in the back link + empty state. */
export const sectionTitleCase = (text = '') => `${text.charAt(0).toUpperCase()}${text.slice(1).toLowerCase()}`;

/**
 * Transport statuses that carry no useful text for the reader — legacy hides the
 * status line for dispatched / queued / received and shows it for everything else
 * (failures and errors, which the CSS renders in red).
 */
export const SILENT_STATUS_CODES = ['DMSTDISPAT', 'DMSTQUEUE', 'DMSTRECEIVE'];

/** Statuses rendered as an error (red) in the outbound list + conversation. */
export const ERROR_STATUS_CODES = ['DMSTERROR', 'DMSTFAIL'];

/** A draft message (never sent) — shown in the Draft section and inline in a thread. */
export const DRAFT_STATUS = 'DMSTDRAFT';

/** Visibility code marking a message archived. */
export const ARCHIVED_VISIBILITY = 'DVISARCHIVE';

// ---- compose ----

/** Compose attachment limits — legacy: 5 files, 5 MB each, these formats (+ CDA XML). */
export const COMPOSE_MAX_FILES = 5;
export const COMPOSE_MAX_SIZE_MB = 5;
export const COMPOSE_ALLOWED_MIME = [
    'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/pdf', 'image/jpg', 'image/jpeg', 'image/png', 'video/mp4', 'video/mov', 'video/quicktime',
    'application/xml', 'text/xml',
];
export const COMPOSE_ACCEPT = COMPOSE_ALLOWED_MIME.join(', ');

/** mimeTypeChange — file extension to the MIME type the payload carries. */
const MIME_BY_FORMAT = {
    pdf: 'application/pdf',
    xml: 'application/xml',
    doc: 'application/msword',
    docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    png: 'image/png',
    gif: 'image/gif',
    mp4: 'video/mp4',
    mov: 'video/quicktime',
    txt: 'text/plain',
};
export const mimeForFormat = (fileFormat = '') => MIME_BY_FORMAT[fileFormat.toLowerCase()] || 'application/octet-stream';

/** A picked file is accepted on its MIME type, or on an .xml extension (CDA). */
export const isAllowedComposeFile = (file) => COMPOSE_ALLOWED_MIME.includes(file.type)
    || file.name.toLowerCase().endsWith('.xml');

/** CDA (XML) documents travel in their own multipart field. */
export const isCdaFile = (fileName = '') => fileName.toLowerCase().endsWith('.xml');

/**
 * setSubjectValueInComposeContainer (reply branch) — prefix "Re: " unless the
 * subject already carries it. An empty subject stays empty.
 */
export const replySubject = (subject) => {
    const trimmed = (subject || '').trim();
    if (!trimmed)
        return '';
    return /^re:/i.test(trimmed) ? trimmed : `Re: ${trimmed}`;
};

/**
 * The other side of a message, from this mailbox's point of view — replying to a
 * message we sent goes back to its recipient, otherwise to its sender.
 */
export const replyRecipient = (message, mailboxAddress) => (message?.senderAddress === mailboxAddress
    ? message?.recipientAddress
    : message?.senderAddress);

/** A message's recipients as a list — the API sends either an array or a comma string. */
export const recipientList = (recipientAddress) => (Array.isArray(recipientAddress)
    ? recipientAddress
    : `${recipientAddress || ''}`.split(','))
    .map((value) => value.trim())
    .filter(Boolean);

/**
 * getPatientContextFromFields — the DIRECT context block sent with a patient-linked
 * message. The category/action/purpose pickers are commented out in the legacy
 * template, so those three are fixed values there; kept verbatim rather than invented.
 */
export const patientContext = (patient) => (patient?.patientId ? {
    category: 'General',
    action: 'Report',
    purpose: 'Treatment',
    givenName: patient.patientName,
    surname: patient.patientName,
    dateOfBirth: patient.dob,
    gender: 'M',
} : null);

/**
 * getDirectMessageParam — the multipart body for send / save-draft. One `data` part
 * holds the JSON payload; every staged attachment is appended as a real file part,
 * XML under `cdaFiles` and everything else under `attachments`. Attachments already
 * stored against the message carry no payload — they stay put unless their id is
 * listed in `removedAttachmentIds`.
 *
 * @param {Object} p
 * @param {Object} p.directAddress          the selected mailbox ({ directAddressId, fullAddress, facilityId }).
 * @param {number|string|null} p.messageId  set when editing a stored draft.
 * @param {number|string|null} p.parentMessageId thread parent (reply target wins over the thread root).
 * @param {string[]} p.recipients
 * @param {string} p.subject
 * @param {string} p.body
 * @param {boolean} p.isDraft
 * @param {Object|null} p.context           patientContext(), when a patient is linked.
 * @param {Object|null} p.linkedPatient
 * @param {Array<number>} p.removedAttachmentIds
 * @param {Array<Object>} p.files           staged attachments ({ fileName, fileFormat, encoded, attachmentId }).
 * @param {(base64: string, mime: string) => Blob} p.toBlob base64 -> Blob (commonUtility.base64ToBlob).
 * @returns {FormData}
 */
export const buildDirectMessageFormData = ({
    directAddress,
    messageId = null,
    parentMessageId = null,
    recipients = [],
    subject = '',
    body = '',
    isDraft = false,
    context = null,
    linkedPatient = null,
    removedAttachmentIds = [],
    files = [],
    toBlob,
}) => {
    const data = JSON.stringify({
        careGroupId: getCareGroupId(),
        facilityId: directAddress?.facilityId,
        senderAddressId: directAddress?.directAddressId,
        messageId: messageId || null,
        patientId: linkedPatient?.patientId || '',
        parentMessageId: parentMessageId || null,
        senderAddress: directAddress?.fullAddress,
        recipients,
        subject: (subject || '').trim(),
        body,
        isDraft: isDraft ? 'Y' : 'N',
        context,
        removedAttachmentIds,
    });

    const formData = new FormData();
    formData.append('data', data);
    files.forEach((file) => {
        // An existing (already-stored) attachment has no base64 payload to re-send.
        if (!file.encoded || !file.fileName)
            return;
        const cda = isCdaFile(file.fileName);
        const mime = cda ? 'application/xml' : mimeForFormat(file.fileFormat);
        formData.append(cda ? 'cdaFiles' : 'attachments', toBlob(file.encoded, mime), file.fileName);
    });
    return formData;
};

/**
 * The server reports compose validation per field; each field name maps to the
 * message slot the composer renders it in (legacy serverValidationFieldElements).
 */
export const SERVER_VALIDATION_FIELDS = ['messageContent', 'attachments', 'recipients', 'senderAddress'];
