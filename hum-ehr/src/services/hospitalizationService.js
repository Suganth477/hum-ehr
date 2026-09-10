import { userNow } from '../utils/dayjs';
import ENDPOINTS from './endpoints';
import { apiGet, apiPost, apiPostForm } from './apiClient';
import { getUserSessionId } from './sessionLockService';
import { fetchHumCodeList, humCodeListToArray } from './lookupService';

/**
 * Hospitalization = a "care status" record of type HOSP. Mirrors the legacy
 * patient.ehr.hospitalization.js + patient.chart.auto.save.js wiring:
 *   list      GET  /care-status/hospitalization?patientId=&hospitalName=
 *   save      POST (json) /care-status/save
 *   invalid   POST (form) /care-status/invalid  { patientId, id }
 *   validate  POST (json) /care-status/validation  -> { data: "true" | "false" }
 * The list returns active + marked-as-error rows together; the component splits
 * them by invalidFlag (legacy hides invalidFlag === 'Y' unless "Show Deleted").
 */
export const normalizeList = (response) => {
	if (!response) return [];
	if (Array.isArray(response)) return response;
	if (Array.isArray(response.data)) return response.data;
	return [];
};

export const fetchPatientHospitalizations = async ({ patientId, search = '' }) => {
	const trimmed = String(search || '').trim();
	const params = new URLSearchParams({ patientId: String(patientId) });
	if (trimmed) params.set('hospitalName', trimmed);
	const response = await apiGet(`${ENDPOINTS.hospitalization.list}?${params.toString()}`);
	return { records: normalizeList(response), response };
};

export const savePatientHospitalization = (payload) => apiPost(ENDPOINTS.hospitalization.save, payload);

// Delete = mark as error. Legacy uses postRequest (form-urlencoded) with {patientId, id}.
export const deletePatientHospitalization = ({ patientId, id }) =>
	apiPostForm(ENDPOINTS.hospitalization.invalid, { patientId, id });

// Server-side uniqueness check for the admitted/discharged date range.
// Legacy returns { data: "true" } when the record is UNIQUE (allowed),
// "false" when a duplicate already exists for the range.
export const validateHospitalizationUnique = (payload) =>
	apiPost(ENDPOINTS.hospitalization.validate, payload);

// Patient problem-list + encounter-diagnosis list for the admitted-diagnosis picker.
// Legacy: postRequest with patientId in the query string and an empty body.
export const fetchPatientDiagnosisProblems = (patientId) =>
	apiPost(`${ENDPOINTS.problem.patientProblems}?patientId=${patientId}`);

export const fetchDischargeDispositionList = async () => {
	const response = await fetchHumCodeList('DISCHARGE-DISPOSITION');
	return humCodeListToArray(response);
};

// Date inputs are date-only (MM-DD-YYYY) Flatpickr values; keep just the date part.
const toDateOnly = (value) => (value ? String(value).trim().split(' ')[0] : '');

/**
 * Mirrors PcEhrHospitalizationAddEdit.getEhrPatientHospitalizationSaveRequestParam.
 * `diagnosisList` is the selected-diagnoses array built by the picker.
 */
export const buildHospitalizationSavePayload = ({ patientId, form, record, diagnosisList = [] }) => ({
	id: record?.id || form.id || '',
	patientId,
	hospitalName: form.hospitalName,
	dischargeDisposition: form.dischargeDisposition,
	diagnosisList: diagnosisList || [],
	type: 'HOSP',
	effectiveDate: toDateOnly(form.admittedDate),
	lastEffectiveDate: toDateOnly(form.dischargedDate),
	careNotes: form.notes,
	// Legacy utility.getCurrentDateInUserTimeZone().format(MDY_12H) — the logged-in user's
	// timezone, not the browser clock (userNow() reads the JWT `timezone` claim).
	recordedDate: userNow().format('MM-DD-YYYY hh:mm A'),
	invalidFlag: 'N',
	dischargeDispositionOther: form.otherDischargeDisposition || '',
	// Releases this record's section lock server-side on save (legacy
	// getEhrPatientHospitalizationSaveRequestParam → activeSessionHandle.getUserSessionId()).
	sessionId: getUserSessionId(),
});

// Mirrors PcEhrHospitalizationAddEdit careStatusUniqueCheck request body.
export const buildHospitalizationValidatePayload = ({ patientId, form, record }) => ({
	id: record?.id || form.id || null,
	patientId,
	type: 'HOSP',
	invalidFlag: 'N',
	effectiveDate: toDateOnly(form.admittedDate),
	lastEffectiveDate: toDateOnly(form.dischargedDate),
	careNotes: form.notes,
});

const hospitalizationService = {
	normalizeList,
	fetchPatientHospitalizations,
	savePatientHospitalization,
	deletePatientHospitalization,
	validateHospitalizationUnique,
	fetchPatientDiagnosisProblems,
	fetchDischargeDispositionList,
	buildHospitalizationSavePayload,
	buildHospitalizationValidatePayload,
};
export default hospitalizationService;
