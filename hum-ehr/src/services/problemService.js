import ENDPOINTS from './endpoints';
import { apiPost } from './apiClient';
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
export const buildProblemSavePayload = ({ patientId, form, problemRecord, }) => {
	const endDate = form.endDate || null;
	// activeFlag mirrors the legacy rule: resolved in the past => inactive.
	const activeFlag = endDate && Date.parse(endDate) < Date.now() ? 'N' : 'Y';
	return {
		icdCodeType: '10',
		patientId,
		goalRequestModelList: [],
		careplanId: problemRecord?.careplanId || null,
		diagnosisId: problemRecord?.diagnosisId || null,
		diagnosisType: form.diagnosisType,
		icdCode: (form.icdCode || '').replace(/\./g, ''),
		snomedCode: form.snomedCode || null,
		dateOfDiagnosis: form.diagnosisDate || null,
		dateOfResolution: endDate,
		recordedDate: form.recordedDate || null,
		clinicalStatus: form.clinicalStatus || null,
		verificationStatus: form.verificationStatus || null,
		activeFlag,
		notes: form.notes?.trim() || '',
		careplanLogMessageUserInput: form.changeLogNotes || '',
		careplanLogMessage: form.changeLogNotes || '',
	};
};
export const buildProblemDeletePayload = ({ problemRecord, changeLogNotes = '' }) => ({
	diagnosisId: problemRecord?.diagnosisId,
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
	careplanLogMessageUserInput: changeLogNotes,
	careplanLogMessage: changeLogNotes,
});
const problemService = {
	normalizeProblemList,
	fetchPatientProblems,
	savePatientProblem,
	deletePatientProblem,
	buildProblemSavePayload,
	buildProblemDeletePayload,
};
export default problemService;
