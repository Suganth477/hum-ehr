import ENDPOINTS from './endpoints';
import { apiPost } from './apiClient';
import {
	getCarePlanChangeLogSessionId,
	getCurrentSessionChangeLogMessagesForSection,
} from './changeLogService';
import patientCache from '../utils/patientCache';

// The allergies section files its audit trail under the "ALLERGY" change-log section.
const CHANGE_LOG_SECTION = 'ALLERGY';
export const normalizeResponseList = (response) => {
	if (!response)
		return [];
	if (Array.isArray(response))
		return response;
	if (Array.isArray(response.data))
		return response.data;
	return [];
};
export const buildAllergyListRequest = ({ patientId, searchTerm = '', advancedFilters = {}, }) => ({
	patientId,
	search: searchTerm?.trim() || null,
	filter: {
		allergyType: advancedFilters.allergyType || null,
		subType: advancedFilters.subTypeCode || advancedFilters.subType || null,
		reaction: advancedFilters.reactionCode || advancedFilters.reaction || null,
		severity: advancedFilters.severity || null,
	},
});
export const fetchPatientAllergies = async ({ patientId, recordType = 'active', showDeleted = false, searchTerm = '', advancedFilters = {}, }) => {
	const request = buildAllergyListRequest({ patientId, searchTerm, advancedFilters });
	const response = await apiPost(ENDPOINTS.allergy.list(recordType), request);
	const data = normalizeResponseList(response);
	const records = recordType === 'history'
		? data.filter((item) => (showDeleted ? item.invalidFlag === 'Y' : item.invalidFlag !== 'Y'))
		: data;
	return { records, rawRecords: data, request, response };
};
export const savePatientAllergy = (payload) => apiPost(ENDPOINTS.allergy.save, payload);
export const deletePatientAllergy = (payload) => apiPost(ENDPOINTS.allergy.invalid, payload);
export const recoverPatientAllergy = (payload) => apiPost(ENDPOINTS.allergy.recover, payload);
// Delete/recover payload (legacy deletePatientAllergyRecordParam): the change-log message is
// accumulated across the session + grouped under logId, matching the ALLERGY save. careplanId
// falls back to the cached patient details so it's never null.
const buildStatusChangePayload = (activeFlag, { patientId, allergyRecord, changeLogNotes = '' }) => ({
	activeFlag,
	patientId,
	careplanId: allergyRecord?.careplanId ?? patientCache.get(`${patientId}_details`)?.carePlanId ?? null,
	allergyId: allergyRecord?.allergyId,
	lastEffectiveDate: allergyRecord?.lastEffectiveDate ?? null,
	logId: getCarePlanChangeLogSessionId(CHANGE_LOG_SECTION, patientId),
	PatientLogMessageUserInput: changeLogNotes,
	PatientLogMessage: getCurrentSessionChangeLogMessagesForSection(CHANGE_LOG_SECTION, changeLogNotes, allergyRecord?.allergyId, patientId),
});
export const buildDeletePayload = (args) => buildStatusChangePayload('Y', args);
export const buildRecoverPayload = (args) => buildStatusChangePayload('N', args);
const allergyService = {
	normalizeResponseList,
	buildAllergyListRequest,
	fetchPatientAllergies,
	savePatientAllergy,
	deletePatientAllergy,
	recoverPatientAllergy,
	buildDeletePayload,
	buildRecoverPayload,
};
export default allergyService;
