import ENDPOINTS from './endpoints';
import { apiGet, apiPost, apiPostForm } from './apiClient';
import { getLoggedInUser } from './authService';
import { getUserSessionId } from './sessionLockService';
import { humCodeListToArray } from './lookupService';
import { userNow } from '../utils/dayjs';

/**
 * Patient Preferences data layer. Mirrors patient.chart.preferences.js + api.utility.js:
 *   list      GET  /preference/{category}/{active|history}?patientId=&searchValue=&advanceDirectiveId=
 *   lookup    GET  /preference/lookup                       → { CARE, TREA, ADDI: [...] }
 *   status    GET  /hum-codes/PREF-STS-CODE?id={userId}
 *   save      POST(json) /preference/{category}/saveOrUpdate
 *   attachment POST /preference/advance-directive/attachment?attachmentId= | ?advanceDirectiveId=
 * preferencesType is 'advance-directives' | 'care-preferences' | 'treatment-preferences'.
 */
export const PREFERENCES_DESC_MAP = {
	'care-preferences': 'Care Preferences',
	'treatment-preferences': 'Treatment Preferences',
	'advance-directives': 'Advance Directives',
};
export const PREFERENCES_CATEGORY_MAP = {
	'care-preferences': 'care',
	'treatment-preferences': 'treatment',
	'advance-directives': 'advance-directive',
};
// Per-category concurrency-lock resourceNavigationCode (legacy PREFERENCES_CONCURRENT_CODE).
// Preferences lock EACH sub-section separately — unlike single-code sections (PROBLEM/ALLERGY).
export const PREFERENCES_CONCURRENT_CODE = {
	'care-preferences': 'CAREPREF',
	'treatment-preferences': 'TREATPREF',
	'advance-directives': 'DIRCTPREF',
};
const LOOKUP_MAPPING = { CARE: 'care-preferences', TREA: 'treatment-preferences', ADDI: 'advance-directives' };

export const fetchPreferencesList = async ({ patientId, recordType, preferencesType, searchValue = '', advanceDirectiveId = '' }) => {
	const category = PREFERENCES_CATEGORY_MAP[preferencesType];
	const params = new URLSearchParams({ patientId, searchValue: searchValue || '' });
	if (advanceDirectiveId) params.set('advanceDirectiveId', advanceDirectiveId);
	// Legacy uses request.postRequest (POST) with params in the query string, not GET.
	const response = await apiPostForm(`${ENDPOINTS.preference.list(category, recordType)}?${params.toString()}`, {});
	const data = response?.status === 'success' ? (response.data || []) : [];
	return { records: Array.isArray(data) ? data : [], response };
};

// Lookup titles per preference type (object-map keyed by CARE/TREA/ADDI → normalized).
export const fetchPreferenceLookups = async () => {
	const response = await apiGet(ENDPOINTS.preference.lookup);
	const out = { 'care-preferences': [], 'treatment-preferences': [], 'advance-directives': [] };
	if (response?.status === 'success' && response.data) {
		Object.entries(response.data).forEach(([category, items]) => {
			if (LOOKUP_MAPPING[category])
				out[LOOKUP_MAPPING[category]] = (items || []).map((item) => ({ id: item.id, code: item.code, value: item.description, label: item.description }));
		});
	}
	return out;
};

// Preference status codes (PREF-STS-CODE hum-codes). Legacy getRequest appends the user id.
export const fetchPreferenceStatuses = async () => {
	const response = await apiGet(`${ENDPOINTS.preference.statusCodes}?id=${getLoggedInUser()?.userId || ''}`);
	return humCodeListToArray(response);
};

export const savePreference = (preferencesType, payload) =>
	apiPost(ENDPOINTS.preference.saveOrUpdate(PREFERENCES_CATEGORY_MAP[preferencesType]), payload);

export const fetchPreferenceAttachmentFile = (attachmentId) =>
	apiPostForm(`${ENDPOINTS.preference.attachment}?attachmentId=${attachmentId}`, {});
export const fetchLinkedAdvanceDirectiveDocs = (adId) =>
	apiPostForm(`${ENDPOINTS.preference.attachment}?advanceDirectiveId=${adId}`, {});

// Status transition matrix (mirrors renderPreferenceStatuses.allowedTransitions).
export const ALLOWED_STATUS_TRANSITIONS = {
	REGISTERED: ['REGISTERED', 'PRELIMINARY', 'FINAL', 'CANCELLED', 'ENTERED_ERR'],
	PRELIMINARY: ['PRELIMINARY', 'FINAL', 'CANCELLED', 'ENTERED_ERR'],
	FINAL: ['FINAL', 'AMENDED', 'CORRECTED', 'CANCELLED', 'ENTERED_ERR'],
	AMENDED: ['AMENDED', 'CORRECTED', 'CANCELLED', 'ENTERED_ERR'],
	CORRECTED: ['CORRECTED', 'AMENDED', 'CANCELLED', 'ENTERED_ERR'],
	CANCELLED: ['CANCELLED'],
	ENTERED_ERR: ['ENTERED_ERR'],
	UNKNOWN: ['UNKNOWN', 'REGISTERED', 'PRELIMINARY', 'FINAL', 'AMENDED', 'CORRECTED', 'CANCELLED', 'ENTERED_ERR'],
};
export const NEW_STATUS_CODES = ['REGISTERED', 'PRELIMINARY', 'FINAL', 'AMENDED', 'CORRECTED', 'CANCELLED', 'UNKNOWN'];

/**
 * Mirrors patientEhrPreferencesSaveParam. `title` maps to code (from the lookup) +
 * description (the typed label); `notes` is the description/notes textarea.
 */
export const buildPreferenceSavePayload = ({
	preferencesId, patientId, preferencesType, code, title, effectiveDate, lastEffectiveDate,
	recordedDate, notes, statusCode, attachment, advanceDirectiveIds, deletePreferenceCode,
}) => {
	const lastEffective = statusCode === 'ENTERED_ERR' ? userNow().format('MM-DD-YYYY hh:mm A') : (lastEffectiveDate || null);
	return {
		id: preferencesId && preferencesId !== '0' ? parseInt(preferencesId, 10) : null,
		patientId: parseInt(patientId, 10),
		code: code || null,
		description: title || null,
		effectiveDate,
		lastEffectiveDate: lastEffective,
		recordedDate,
		notes: notes || null,
		statusCode: statusCode || null,
		invalidFlag: 'N',
		// Releases this record's section lock server-side on save (legacy patientEhrPreferencesSaveParam).
		sessionId: getUserSessionId(),
		attachment: attachment && attachment.length ? attachment : null,
		...(preferencesType === 'treatment-preferences' && { advanceDirectiveIds: advanceDirectiveIds || [] }),
		...(deletePreferenceCode && { deletePreferenceCode }),
	};
};

/**
 * Soft-delete payload (legacy deletePreferenceRecord): the full record with invalidFlag
 * flipped to 'Y', plus the advance-directive deletePreferenceCode when the user chose to
 * also inactivate linked treatment preferences. No sessionId here — the DELETE concurrency
 * check (checkItIsNewRecordOrEditRecord ... 'DELETE') releases the lock separately.
 */
export const buildPreferenceDeletePayload = (record, deletePreferenceCode = null) => ({
	...record,
	invalidFlag: 'Y',
	...(deletePreferenceCode && { deletePreferenceCode }),
});

const preferencesService = {
	fetchPreferencesList,
	fetchPreferenceLookups,
	fetchPreferenceStatuses,
	savePreference,
	buildPreferenceDeletePayload,
	fetchPreferenceAttachmentFile,
	fetchLinkedAdvanceDirectiveDocs,
	buildPreferenceSavePayload,
	PREFERENCES_DESC_MAP,
	PREFERENCES_CATEGORY_MAP,
	ALLOWED_STATUS_TRANSITIONS,
	NEW_STATUS_CODES,
};
export default preferencesService;
