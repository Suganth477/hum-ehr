import ENDPOINTS from './endpoints';
import { apiGet, apiPost, apiPostForm } from './apiClient';
import { getLoggedInUser } from './authService';

/**
 * Direct Address service — Direct Secure Messaging (the DIRECT protocol inbox).
 *
 * The third Message Center surface, next to Chat and In-App Mail. Unlike In-App
 * Mail (internal users addressed by userId) a direct message is exchanged with an
 * EXTERNAL direct address string (`provider@direct.example.org`), optionally linked
 * to a patient and carrying CDA (XML) documents alongside ordinary attachments.
 *
 * Every request shape mirrors the legacy `apiUtility` "Direct Address APIs" block +
 * the param builders in `hum-js/message-center/ehr.message.center.js`
 * (EhrDirectAdressMessagesList / EhrDirectAddressComposeDirectMessage) verbatim, so
 * the backend contract is unchanged.
 *
 * All calls hit the standard backend through apiClient.
 */

const loggedInUserId = () => getLoggedInUser()?.userId;

/** Section tabs — { code sent to the API, label, count field on /direct/message/count }. */
export const DIRECT_SECTIONS = [
    { type: 'INBOUND', code: 'DDIRINBOUND', label: 'Inbound', countKey: 'inboundCount' },
    { type: 'OUTBOUND', code: 'DDIROUTBOUND', label: 'Outbound', countKey: 'outboundCount' },
    { type: 'DRAFT', code: 'DMSTDRAFT', label: 'Draft', countKey: 'draftCount' },
    { type: 'ARCHIVED', code: 'DVISARCHIVE', label: 'Archived', countKey: 'archivedCount' },
];

/** Legacy list page size (data-start-index steps by this). */
export const DIRECT_PAGE_SIZE = 10;

/**
 * getDirectMessageListParam — section list request.
 * Inbound/Outbound filter by `directionCode`; Draft and Archived instead send a
 * `statusCode` / `visibilityCode` and leave `directionCode` null (legacy branch).
 * @param {Object} p
 * @param {string} p.sectionCode            DDIRINBOUND | DDIROUTBOUND | DMSTDRAFT | DVISARCHIVE.
 * @param {number|string} p.directAddressId the mailbox being read.
 * @param {number} [p.start=0]              row offset.
 * @param {number} [p.length=10]            page size.
 * @param {string} [p.search='']            free-text search.
 */
export const buildMessageListParam = ({ sectionCode, directAddressId, start = 0, length = DIRECT_PAGE_SIZE, search = '' }) => {
    const directionCode = (sectionCode === 'DVISARCHIVE' || sectionCode === 'DMSTDRAFT') ? null : sectionCode;
    return {
        directionCode,
        search: (search || '').trim(),
        start: parseInt(start, 10) || 0,
        directAddressId,
        length,
        order: { column: 'messageDate', type: 'DESC' },
        ...(sectionCode === 'DVISARCHIVE' ? { visibilityCode: 'DVISARCHIVE' } : {}),
        ...(sectionCode === 'DMSTDRAFT' ? { statusCode: 'DMSTDRAFT' } : {}),
    };
};

/**
 * getDirectMessageStatusUpdateParam — archive / unarchive / mark-read.
 * The two uses are exclusive in legacy: an archive toggle sends `isArchived` with a
 * null `isRead`, and the open-conversation read marker sends `isRead:'Y'` with a null
 * `isArchived`.
 * @param {Object} p
 * @param {Array<number|string>} p.directMessageIdList
 * @param {'Y'|'N'|null} [p.isArchived=null]
 * @param {'Y'|null} [p.isRead=null]
 */
export const buildStatusUpdateParam = ({ directMessageIdList = [], isArchived = null, isRead = null }) => ({
    directMessageIdList,
    isArchived,
    isRead: isRead || null,
});

// ---- calls ----

/**
 * The logged-in user's direct addresses.
 * Legacy uses the `?id={userId}` GET variant.
 * @returns {Promise<{status:string, data:{physicianDirect:Object|null, facilities:Object[]}}>}
 */
export const fetchUserDirectAddressList = () =>
    apiGet(`${ENDPOINTS.directAddress.list}?id=${loggedInUserId() || ''}`);

/** Fetch a section's (inbound/outbound/draft/archived) message list. */
export const fetchDirectMessageList = (params) =>
    apiPost(ENDPOINTS.directAddress.messageList, buildMessageListParam(params));

/** Fetch one full conversation (all messages under a thread parent, drafts included). */
export const fetchDirectMessageConversation = (parentMessageId) =>
    apiGet(`${ENDPOINTS.directAddress.conversation}?parentMessageId=${parentMessageId}`);

/** Per-section counts for a mailbox — a hint on the tabs; never block the list on it. */
export const fetchDirectMessageSectionCounts = (directAddressId) =>
    apiGet(`${ENDPOINTS.directAddress.sectionCount}?directAddressId=${directAddressId}`);

/** Archive / unarchive / mark-read. */
export const updateDirectMessageStatus = (params) =>
    apiPost(ENDPOINTS.directAddress.statusUpdate, buildStatusUpdateParam(params));

/** External direct-address typeahead for the compose "To" field. */
export const fetchRecipientLookup = (search) =>
    apiGet(`${ENDPOINTS.directAddress.recipientLookup}?search=${encodeURIComponent(search || '')}`);

/** Download one attachment ({ data: { file } } — base64 payload). */
export const downloadDirectMessageAttachment = (attachmentId) =>
    apiGet(`${ENDPOINTS.directAddress.attachmentFile}?attachmentId=${attachmentId}`);

/** Discard a drafted direct message (legacy posts with the id in the query string). */
export const deleteDraftedDirectMessage = (messageId) =>
    apiPost(`${ENDPOINTS.directAddress.draftDelete}?messageId=${messageId}`, null);

/**
 * Send a direct message or save it as a draft. Multipart, exactly as legacy:
 * a single `data` part holding the JSON payload, plus one part per attachment —
 * XML (CDA) documents under `cdaFiles`, everything else under `attachments`.
 * @param {FormData} formData built by buildDirectMessageFormData (directAddressHelpers).
 */
export const sendDirectMessage = (formData) =>
    apiPost(ENDPOINTS.directAddress.send, formData);

/** Active-patient name typeahead used by the compose "Link Patient" field. */
export const fetchActivePatientLookup = (patientName) =>
    apiPostForm(ENDPOINTS.patient.activeLookup, { patientName });

const directAddressService = {
    DIRECT_SECTIONS,
    DIRECT_PAGE_SIZE,
    buildMessageListParam,
    buildStatusUpdateParam,
    fetchUserDirectAddressList,
    fetchDirectMessageList,
    fetchDirectMessageConversation,
    fetchDirectMessageSectionCounts,
    updateDirectMessageStatus,
    fetchRecipientLookup,
    downloadDirectMessageAttachment,
    deleteDraftedDirectMessage,
    sendDirectMessage,
    fetchActivePatientLookup,
};
export default directAddressService;
