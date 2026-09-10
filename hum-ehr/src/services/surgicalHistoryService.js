import { userNow } from '../utils/dayjs';
import ENDPOINTS from './endpoints';
import { apiGet, apiPost, apiPostForm } from './apiClient';
import { buildDiagnosisListPayload } from './procedureService';

const MIME_MAP = { jpeg: 'image/jpeg', jpg: 'image/jpeg', png: 'image/jpeg', pdf: 'application/pdf', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
// Legacy utility.blobType: jpeg/jpg/png all map to image/jpeg; png handled explicitly below.
export const blobTypeFor = (fileFormat) => {
	const fmt = (fileFormat || '').toLowerCase();
	if (fmt.includes('/')) return fileFormat; // already a mime type
	if (fmt === 'png') return 'image/jpeg';
	return MIME_MAP[fmt] || '';
};

/**
 * Surgical history data layer. Mirrors patient.ehr.procedure.surgical.js + api.utility.js:
 *   list    POST (json) /surgical-history/list?patientId=&surgeryName=
 *   save    POST (json) /surgical-history/saveOrUpdate
 *   invalid POST (json) /surgical-history/invalid
 *   lookup  GET         /surgical-history/surgery-name/lookup?name=
 *   report  GET         /surgical-history/report/id?attachementId=   (misspelling verbatim)
 * The list returns active + deleted together; invalidFlag Y/N is split client-side.
 */
export const fetchSurgicalHistoryList = async ({ patientId, search = '' }) => {
	const response = await apiPost(`${ENDPOINTS.surgicalHistory.list}?patientId=${patientId}&surgeryName=${encodeURIComponent(search || '')}`);
	const data = response?.status === 'success' && Array.isArray(response.data) ? response.data : [];
	return {
		activeList: data.filter((item) => item.invalidFlag === 'N'),
		deletedList: data.filter((item) => item.invalidFlag === 'Y'),
		response,
	};
};

export const fetchSurgeryNameLookup = async (term) => {
	const response = await apiGet(`${ENDPOINTS.surgicalHistory.surgeryNameLookup}?name=${encodeURIComponent(term || '')}`);
	return (response?.status === 'success' && Array.isArray(response.data) ? response.data : [])
		.map((item) => ({ id: item.id, code: item.code, value: item.description }));
};

export const saveSurgicalHistory = (payload) => apiPost(ENDPOINTS.surgicalHistory.save, payload);

export const fetchSurgicalHistoryReport = (attachmentId) =>
	apiGet(`${ENDPOINTS.surgicalHistory.reportFile}?attachementId=${attachmentId}`);
export const deleteSurgicalHistoryReport = (attachmentId) =>
	apiPostForm(`${ENDPOINTS.surgicalHistory.deleteReport}?attachmentId=${attachmentId}`, {});

// Mirrors buildDeleteSurgicalHistoryRequest (change-log session fields sent empty).
export const deleteSurgicalHistory = ({ patientId, careplanId, surgeryId, surgeryName = '' }) =>
	apiPost(ENDPOINTS.surgicalHistory.invalid, {
		patientId,
		careplanId,
		surgeryId,
		notes: '',
		effectiveDate: null,
		activeFlag: '',
		lastEffectiveDate: null,
		logId: null,
		careplanLogMessageUserInput: `Surgical history "${surgeryName}" has been deleted`,
		careplanLogMessage: `Surgical history "${surgeryName}" has been deleted`,
	});

/**
 * Mirrors PatientSurgicalHistoryAddEdit.surgicalHistorySaveParams. surgeryDateTime =
 * picked date + the current time; fileDetail: new files as
 * { fileName, attachmentSize(KB, 2dp), fileFormat(mime), file(base64) }, existing kept
 * files as { attachmentId } only.
 */
export const buildSurgicalHistorySavePayload = ({ patientId, careplanId, form, diagnosisList, files }) => {
	const nowTime = userNow().format('hh:mm A');
	const fileDetail = (files || []).map((f) => (f.attachmentId
		? { attachmentId: parseInt(f.attachmentId, 10) }
		: { fileName: f.fileName, attachmentSize: Number(f.displaySizeKb ?? f.attachmentSize), fileFormat: blobTypeFor(f.fileFormat), file: f.encoded || f.file }));
	const changeLogMessage = `${form.id ? 'An existing' : 'A new'} surgical history "${form.surgeryName}" has been ${form.id ? 'modified' : 'added'}`;
	return {
		id: form.id || null,
		patientId,
		careplanId: careplanId ?? null,
		surgeryName: form.surgeryName,
		surgeonFacilityName: form.surgeonFacilityName,
		surgeonName: form.surgeonName,
		surgeryCode: form.surgeryCode || null,
		bodySiteId: form.bodySiteId || null,
		surgeryDateTime: `${form.surgeryDate} ${nowTime}`,
		diagnosisList: buildDiagnosisListPayload(diagnosisList),
		notes: form.notes,
		fileDetail,
		logId: null,
		careplanLogMessage: changeLogMessage,
	};
};

const surgicalHistoryService = {
	blobTypeFor,
	fetchSurgicalHistoryList,
	fetchSurgeryNameLookup,
	saveSurgicalHistory,
	fetchSurgicalHistoryReport,
	deleteSurgicalHistoryReport,
	deleteSurgicalHistory,
	buildSurgicalHistorySavePayload,
};
export default surgicalHistoryService;
