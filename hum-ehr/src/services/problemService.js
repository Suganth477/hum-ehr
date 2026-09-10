import ENDPOINTS from './endpoints';
import { apiPost } from './apiClient';
import { getUserSessionId } from './sessionLockService';
import {
	getCarePlanChangeLogSessionId,
	getCurrentSessionChangeLogMessagesForSection,
} from './changeLogService';
import patientCache from '../utils/patientCache';
import moment, { userNow } from '../utils/dayjs';

// The problems section files its audit trail under the "DIAGNOSIS" change-log section.
const CHANGE_LOG_SECTION = 'DIAGNOSIS';
export const normalizeProblemList = (response) => {
	if (!response)
		return [];
	if (Array.isArray(response))
		return response;
	if (Array.isArray(response.data))
		return response.data;
	return [];
};
/**
 * One list endpoint, path-suffixed by record type. The history payload mixes
 * deleted (invalidFlag === 'Y') and non-deleted rows; the client splits them so
 * the "Show Deleted Records" toggle doesn't need a second fetch.
 */
export const fetchPatientProblems = async ({ patientId, recordType = 'active', showDeleted = false, search = '', type = '', }) => {
	const request = { patientId, search: search?.trim() || null, type: type || null };
	const response = await apiPost(ENDPOINTS.problem.list(recordType), request);
	const data = normalizeProblemList(response);
	const records = recordType === 'history'
		? data.filter((item) => (showDeleted ? item.invalidFlag === 'Y' : item.invalidFlag !== 'Y'))
		: data;
	return { records, rawRecords: data, request, response };
};
// Add, edit and recover all POST the same endpoint; create vs update is decided
// server-side by the presence of `diagnosisId`.
export const savePatientProblem = (payload) => apiPost(ENDPOINTS.problem.save, payload);
export const deletePatientProblem = (payload) => apiPost(ENDPOINTS.problem.invalid, payload);
// The change-log/audit message is generated programmatically by the caller (mirroring
// the legacy hidden `pa_patient_problem_change_log_message`, which `constructProblemChangeLogMessage`
// auto-fills from the diagnosis label) — it is never typed by the user. The service then wraps
// it with the session's running message + logId so the server appends to one audit entry
// (legacy `patientProblemSaveParam`: logId / careplanLogMessage / careplanLogMessageUserInput /
// sessionId). `sessionId` also lets the save release this record's concurrency lock server-side.
export const buildProblemSavePayload = ({ patientId, form, problemRecord, changeLogMessage = '' }) => {
	const endDate = form.endDate || null;
	// activeFlag mirrors the legacy rule: resolved in the past => inactive. "Past" is judged
	// against the logged-in user's current wall-clock time (legacy utility.loggedInUserDate),
	// not the browser clock — both compared as wall-clock in one frame.
	const nowWall = userNow().format('MM-DD-YYYY hh:mm A');
	const activeFlag = endDate
		&& moment(endDate, 'MM-DD-YYYY hh:mm A').isBefore(moment(nowWall, 'MM-DD-YYYY hh:mm A'))
		? 'N' : 'Y';
	const diagnosisId = problemRecord?.diagnosisId || "";
	// Legacy sends the patient's carePlanId (from PatientDetails) on EVERY save. For a new
	// problem there's no problemRecord, so fall back to the cached patient details — without
	// this, new problems save with careplanId:null and never appear in the careplan-scoped list.
	const careplanId = problemRecord?.careplanId ?? patientCache.get(`${patientId}_details`)?.carePlanId ?? null;
	return {
		icdCodeType: '10',
		patientId,
		goalRequestModelList: [],
		careplanId,
		diagnosisId,
		diagnosisType: form.diagnosisType,
		icdCode: (form.icdCode || '').replace(/\./g, ''),
		snomedCode: form.snomedCode || null,
		dateOfDiagnosis: form.diagnosisDate || null,
		dateOfResolution: endDate,
		recordedDate: form.recordedDate || null,
		clinicalStatus: form.clinicalStatus || "",
		verificationStatus: form.verificationStatus || "",
		activeFlag,
		notes: form.notes?.trim() || '',
		logId: getCarePlanChangeLogSessionId(CHANGE_LOG_SECTION, patientId),
		careplanLogMessageUserInput: changeLogMessage,
		careplanLogMessage: getCurrentSessionChangeLogMessagesForSection(CHANGE_LOG_SECTION, changeLogMessage, diagnosisId, patientId),
		sessionId: getUserSessionId(),
	};
};
export const buildProblemDeletePayload = ({ patientId, problemRecord, changeLogNotes = '' }) => {
	const diagnosisId = problemRecord?.diagnosisId;
	return {
		diagnosisId,
		effectiveDate: problemRecord?.effectiveDate ?? null,
		lastEffectiveDate: problemRecord?.lastEffectiveDate ?? null,
		lastAssessmentDate: problemRecord?.lastAssessmentDate ?? null,
		assessmentSummary: problemRecord?.assessmentSummary ?? null,
		icdDescription: problemRecord?.icdDescription,
		diagnosisType: problemRecord?.diagnosisType,
		icdCode: problemRecord?.icdCode,
		snomedCode: problemRecord?.snomedCode,
		icdCodeType: problemRecord?.icdCodeType ?? '10',
		invalidFlag: problemRecord?.invalidFlag,
		snomedAvailableFlag: problemRecord?.snomedAvailableFlag,
		snomedDesc: problemRecord?.snomedDesc,
		logId: getCarePlanChangeLogSessionId(CHANGE_LOG_SECTION, patientId),
		careplanLogMessageUserInput: changeLogNotes,
		careplanLogMessage: getCurrentSessionChangeLogMessagesForSection(CHANGE_LOG_SECTION, changeLogNotes, diagnosisId, patientId),
		sessionId: getUserSessionId(),
	};
};
const problemService = {
	normalizeProblemList,
	fetchPatientProblems,
	savePatientProblem,
	deletePatientProblem,
	buildProblemSavePayload,
	buildProblemDeletePayload,
};
export default problemService;
