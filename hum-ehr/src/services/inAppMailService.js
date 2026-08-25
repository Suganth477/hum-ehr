import ENDPOINTS from './endpoints';
import { apiGet, apiPost } from './apiClient';
import { getLoggedInUser } from './authService';

/**
 * In-App Mail service — secure internal messaging (inbox / sent / drafts / starred /
 * trash folders, threaded conversations, compose with recipients + attachments).
 *
 * This is the standalone Message Center mail surface AND the patient-chart "mail"
 * tab: when a `patientId` is supplied the request is patient-scoped (`mailType`
 * PATIENT/EVENT, `subjectTypeCode` PATIENT), otherwise it is a global folder view —
 * exactly the legacy `PATIENT_ID` branch. Every request shape mirrors the legacy
 * param builders in `care-team-communication/in.app.mail.conversation.list.js`
 * verbatim (field names, folder codes, flags), so the backend contract is unchanged.
 *
 * All calls go through the standard backend (apiClient, JSON) — In-App Mail does not
 * use the signal chat microservice.
 */

const loggedInUserId = () => getLoggedInUser()?.userId;

/**
 * A single recipient row in the compose payload's `messageDistribution`.
 * @typedef {Object} MailDistribution
 * @property {number} distributionUserId
 * @property {'Y'|'N'} distributionUserInCCFlag  'Y' = CC recipient, 'N' = To recipient.
 * @property {number} [distributionId]           present when editing an existing draft.
 */

/**
 * A single attachment in the compose payload's `fileDetails`. A newly-picked file
 * carries its base64 data; an already-uploaded file carries only its `attachmentId`.
 * @typedef {Object} MailFileDetail
 * @property {string} [file]                     base64-encoded data (new upload).
 * @property {string} [fileFormat]               e.g. 'pdf', 'png' (new upload).
 * @property {number} [fileSize]                 (new upload).
 * @property {string} [messageAttachmentTypeCode] legacy `_getAttachmentType(fmt, 1)` (new upload).
 * @property {string} [fileName]                 (new upload).
 * @property {number} [attachmentId]             present instead of the above for an existing file.
 */

// ---- request-param builders (legacy in.app.mail.conversation.list.js) ----

/**
 * requestParamForConversationList — folder list request (DataTables server-side).
 * Legacy: patient-scoped view sends `inAppStatus:null` + `mailType:'PATIENT'` and
 * puts the folder in `eventCode`; the global view sends the folder in `inAppStatus`.
 * @param {Object} p
 * @param {number} [p.start=0]                 row offset (data-start-index).
 * @param {number} [p.length=25]               page size.
 * @param {string} [p.search='']               free-text search.
 * @param {'asc'|'desc'} [p.sortOrder='asc']
 * @param {string} [p.conversationType='INBOX'] INBOX | SENT | DRAFTS | STARRED | TRASH.
 * @param {number|null} [p.patientId=null]     set → patient-scoped mail.
 * @param {string|null} [p.eventCode=null]     patient event filter (patient-scoped only).
 */
export const buildConversationListParam = ({
    start = 0,
    length = 25,
    search = '',
    sortOrder = 'asc',
    conversationType = 'INBOX',
    patientId = null,
    eventCode = null,
} = {}) => ({
    draw: 0,
    length,
    start,
    inAppStatus: patientId ? null : conversationType,
    search,
    sortOrder,
    patientId: patientId || null,
    eventCode: patientId ? (eventCode || null) : null,
    mailType: patientId ? 'PATIENT' : null,
});

/**
 * statusChangeApiCall param — read / star / trash / permanently-delete a message.
 * @param {Object} p
 * @param {'READ'|'STARD'|'TRASH'|'PERMTRASH'} p.statusCode
 * @param {'Y'|'N'} [p.statusFlag='Y']         'Y' applies the status, 'N' clears it.
 * @param {number[]} [p.messageDetailsIdList=[]] user-distributed-list ids to update.
 */
export const buildStatusChangeParam = ({ statusCode, statusFlag = 'Y', messageDetailsIdList = [] }) => ({
    statusCode,
    statusFlag,
    messageDetailsIdList,
});

/**
 * contactUsersListParam — recipient (To/CC) search for compose. Patient-scoped
 * compose narrows the directory to the patient's care-event participants (`EVENT`).
 * @param {Object} p
 * @param {string} [p.search='']
 * @param {number|null} [p.patientId=null]
 */
export const buildContactUsersParam = ({ search = '', patientId = null } = {}) => ({
    search,
    filter: { role: '' },
    keyType: 'ECHAT',
    deviceType: '',
    start: 0,
    length: 1000,
    mailType: patientId ? 'EVENT' : null,
    patientId: patientId || null,
});

/**
 * requestParamForInAppMailSave — compose payload for send (SENT) or save-draft (DRAFTS).
 * The recipient list (`messageDistribution`) and attachments (`fileDetails`) are
 * collected by the compose UI into the documented item shapes and passed through here;
 * this builder owns the exact top-level field names + the patient-scoping branch.
 * The caller decides send-vs-draft via `messageStatus`, and reply/forward vs new via
 * `messageResponseTypeCode` (+ `parentMessageId`) and `messageId`.
 * @param {Object} p
 * @param {'SENT'|'DRAFTS'} p.messageStatus
 * @param {'ORGINL'|'REPLY'|'FORWD'} [p.messageResponseTypeCode='ORGINL']
 * @param {number|null} [p.parentMessageId=null] thread parent (null for a new mail).
 * @param {string} [p.messageBodyText='']
 * @param {string} [p.subjectName='']
 * @param {MailDistribution[]} [p.messageDistribution=[]]
 * @param {MailFileDetail[]} [p.fileDetails=[]]
 * @param {number|null} [p.messageId=null]     set → routes to the update endpoint.
 * @param {number|null} [p.patientId=null]
 * @param {string|null} [p.subjectEventCode=null] patient care-event (patient-scoped only).
 */
export const buildSaveMailParam = ({
    messageStatus,
    messageResponseTypeCode = 'ORGINL',
    parentMessageId = null,
    messageBodyText = '',
    subjectName = '',
    messageDistribution = [],
    fileDetails = [],
    messageId = null,
    patientId = null,
    subjectEventCode = null,
}) => ({
    messageStatus,
    messageResponseTypeCode,
    parentMessageId: parentMessageId === 0 ? null : parentMessageId,
    messageAuthorId: loggedInUserId(),
    messageBodyText,
    subjectName,
    messageTypeCode: 'INAPMAIL',
    messageDistribution,
    fileDetails,
    messageId: messageId || null,
    subjectTypeCode: patientId ? 'PATIENT' : null,
    subjectEventCode: patientId ? (subjectEventCode || null) : null,
    patientId: patientId || null,
});

// ---- standard backend calls ----

/** Fetch a folder's conversation list. */
export const fetchConversationList = (params) =>
    apiPost(ENDPOINTS.inAppMail.conversationList, buildConversationListParam(params));

/**
 * Fetch a single thread's full conversation. Legacy sends both as query params with a
 * null body; `isTrash` gates whether trashed messages in the thread are included.
 * @param {number|string} parentMailId
 * @param {boolean} [isTrash=false]
 */
export const fetchMailDetails = (parentMailId, isTrash = false) =>
    apiPost(`${ENDPOINTS.inAppMail.details}?parentMailId=${parentMailId}&statusIsTrash=${isTrash ? 'Y' : 'N'}`, null);

/** Search the directory for compose recipients. */
export const fetchContactUsers = (params) =>
    apiPost(ENDPOINTS.inAppMail.contact, buildContactUsersParam(params));

/**
 * Send a message or save it as a draft. Legacy routes to the update endpoint when the
 * payload carries a `messageId` (editing an existing mail/draft) and the save endpoint
 * otherwise — preserved verbatim.
 */
export const saveMail = (params) => {
    const requestParam = buildSaveMailParam(params);
    const url = requestParam.messageId ? ENDPOINTS.inAppMail.update : ENDPOINTS.inAppMail.save;
    return apiPost(url, requestParam);
};

/** Change message status (read / star / trash / permanently delete). */
export const updateMailStatus = (params) =>
    apiPost(ENDPOINTS.inAppMail.statusChange, buildStatusChangeParam(params));

/** Fetch per-folder counts (unread badges). Legacy posts a null body. */
export const fetchMailCount = () => apiPost(ENDPOINTS.inAppMail.count, null);

/**
 * Validate that a patient care-event can receive mail (patient-scoped compose only).
 * Legacy uses a GET with both values as query params.
 * @param {number|string} patientId
 * @param {string} eventCode
 */
export const validatePatientEvent = (patientId, eventCode) =>
    apiGet(`${ENDPOINTS.inAppMail.eventValidation}?patientId=${patientId}&eventCode=${eventCode}`);

const inAppMailService = {
    buildConversationListParam,
    buildStatusChangeParam,
    buildContactUsersParam,
    buildSaveMailParam,
    fetchConversationList,
    fetchMailDetails,
    fetchContactUsers,
    saveMail,
    updateMailStatus,
    fetchMailCount,
    validatePatientEvent,
};
export default inAppMailService;
