// @ts-check
import ENDPOINTS from "./endpoints";
import { apiPost, apiPostForm } from "./apiClient";
import moment from "../utils/dayjs";

/** Legacy utility.ageCalculator(dob) + "yrs" — whole years from the MM-DD-YYYY dob. */
const computePatientAge = (dob) => {
	if (!dob) return "";
	const parsed = moment(dob, "MM-DD-YYYY", true);
	if (!parsed.isValid()) return "";
	const years = moment().diff(parsed, "year");
	return Number.isFinite(years) ? `${years}yrs` : "";
};
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
		// Patient-list filter (Gender / Age / Primary Provider / DSI Alert) — legacy
		// active.patient.js _getValidDataTableObject. minAge holds the single value for
		// the above/below operators; maxAge is null unless the range is "BETWEEN".
		gender: filters.gender || "",
		ageRange: filters.ageRange || "",
		minAge: filters.minAge || "",
		maxAge: filters.maxAge || null,
		dsiAlertStatus: filters.dsiAlertStatus || "",
		pcpId: filters.physicianId || "",
		pcpRoleStatus: "CPHY",
	},
	order: {
		column: sortField || "fullName",
		type: sortOrder === -1 ? "desc" : "asc",
	},
	search: filters.search || "",
	searchColumn: filters.searchColumn || "PATIENNAME",
});
/**
 * Normalize a raw API patient record into the row shape the UI consumes.
 * @param {Record<string, any>} patient
 * @returns {import('../types/models').ActivePatientRow}
 */
export const mapActivePatientRow = (patient) => ({
	id: patient.patientId,
	patientId: patient.patientId,
	sno: patient.sno,
	fullName: patient.fullName,
	gender: patient.genderDesc,
	genderCode: patient.genderCode,
	dob: patient.dob,
	age: computePatientAge(patient.dob),
	// DSI (Decision Support Intervention) alert count — drives the DSI Alert column badge.
	dsiAlertCount: Number(patient.dsiAlertCount) || 0,
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
/**
 * Fetch and map the active patient list.
 * @param {Object} [params] buildActivePatientListRequest options
 * @returns {Promise<import('../types/models').ActivePatientsResult>}
 */
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
