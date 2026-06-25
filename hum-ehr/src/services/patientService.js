import ENDPOINTS from "./endpoints";
import { apiPost, apiPostForm } from "./apiClient";
export const buildActivePatientListRequest = ({
	draw = 1,
	rows = 10,
	first = 0,
	filters = {},
	sortField = "fullName",
	sortOrder = 1,
} = {}) => ({
	draw,
	length: rows,
	start: first,
	filter: {
		productCode: filters.productCode || "",
		facilityId: filters.facilityId || "",
		physicianId: filters.physicianId || "",
		clinicianId: filters.clinicianId || "",
		clinicianRoleStatus: filters.clinicianRoleStatus || "ALL",
		physicianRoleStatus: filters.physicianRoleStatus || "ALL",
		fromDate: filters.fromDate || "",
		toDate: filters.toDate || "",
		programStatus: filters.programStatus || "ALL",
	},
	order: {
		column: sortField || "fullName",
		type: sortOrder === -1 ? "desc" : "asc",
	},
	search: filters.search || "",
	searchColumn: filters.searchColumn || "PATIENNAME",
});
export const mapActivePatientRow = (patient) => ({
	id: patient.patientId,
	patientId: patient.patientId,
	sno: patient.sno,
	fullName: patient.fullName,
	gender: patient.genderDesc,
	genderCode: patient.genderCode,
	dob: patient.dob,
	emrId: patient.emrId || patient.ehrEmrId || "",
	medicareNumber: patient.medicareNumber || "",
	mobilePhoneNumber: patient.mobilePhoneNumber || "",
	homePhoneNumber: patient.homePhoneNumber || "",
	workPhoneNumber: patient.workPhoneNumber || "",
	mobilePhoneInvalidFlag: patient.mobilePhoneInvalidFlag,
	pagerPhoneInvalidFlag: patient.pagerPhoneInvalidFlag,
	workPhoneInvalidFlag: patient.workPhoneInvalidFlag,
	raw: patient,
});
export const fetchActivePatients = async (params = {}) => {
	const request = buildActivePatientListRequest(params);
	const response = await apiPost(ENDPOINTS.patient.activeList, request);
	return {
		rows:
			response?.status === "success"
				? (response.data ?? []).map(mapActivePatientRow)
				: [],
		totalRecords: response?.recordsFiltered ?? 0,
		request,
	};
};
export const fetchPatientDetails = (patientId) =>
	apiPostForm(ENDPOINTS.patient.details, { patientId });
export const downloadPatientCCD = (patientId) =>
	apiPost(
		ENDPOINTS.patient.ccdDownload,
		{ patientId },
		{ responseType: "blob" },
	);
const patientService = {
	buildActivePatientListRequest,
	mapActivePatientRow,
	fetchActivePatients,
	fetchPatientDetails,
	downloadPatientCCD,
};
export default patientService;
