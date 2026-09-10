// @ts-check
import ENDPOINTS from "./endpoints";
import { apiPost, apiPostForm } from "./apiClient";
import moment from "../utils/dayjs";

/** Legacy utility.ageCalculator(dob) + "yrs" — whole years from the MM-DD-YYYY dob. */
const computePatientAge = (dob, separator = "") => {
	if (!dob) return "";
	const parsed = moment(dob, "MM-DD-YYYY", true);
	if (!parsed.isValid()) return "";
	const years = moment().diff(parsed, "year");
	return Number.isFinite(years) ? `${years}${separator}yrs` : "";
};
/**
 * Legacy active.patient.js `_getSearchableColumnName` — the active list and the
 * deactivated (user) list name the same searchable columns differently.
 * @param {'active'|'inactive'} patientsType
 * @param {string} selectedColumn one of the header select values
 */
export const resolveSearchColumn = (patientsType, selectedColumn = "PATIENNAME") => {
	if (patientsType !== "inactive") {
		return selectedColumn === "PATIENTEMR" ? "EHREMR" : selectedColumn;
	}
	const columnMapping = {
		PATIENNAME: "NAME",
		PATIENTEMR: "EMRID",
		PATIENMAIL: "EMAIL",
		PATIENTMOB: "MOB",
	};
	return columnMapping[selectedColumn] || selectedColumn;
};
/**
 * Legacy `_getValidDataTableObject` — the filter block differs per tab: the active
 * tab filters patients, the deactivated tab filters care-group users.
 * minAge holds the single value for the above/below operators; maxAge is null
 * unless the range is "BETWEEN".
 */
const buildListFilter = (filters, patientsType) => {
	const isBetween = filters.ageRange === "BETWEEN";
	const minAge = filters.minAge || "";
	const maxAge = isBetween ? filters.maxAge || "" : null;
	if (patientsType === "inactive") {
		return {
			userRole: "CMSPATIENT",
			status: "N",
			pcpId: filters.physicianId || "",
			pcpRoleStatus: "CRTM",
			rolePrivilege: "",
			facilityId: "",
			physicianId: "",
			clinicianId: "",
			noServiceMonths: "",
			humRoleCode: null,
			gender: filters.gender || "",
			ageRange: filters.ageRange || "",
			minAge,
			maxAge,
		};
	}
	return {
		productCode: filters.productCode || "",
		facilityId: filters.facilityId || "",
		physicianId: filters.physicianId || "",
		clinicianId: filters.clinicianId || "",
		clinicianRoleStatus: filters.clinicianRoleStatus || "ALL",
		physicianRoleStatus: filters.physicianRoleStatus || "ALL",
		fromDate: filters.fromDate || "",
		toDate: filters.toDate || "",
		programStatus: filters.programStatus || "ALL",
		gender: filters.gender || "",
		ageRange: filters.ageRange || "",
		minAge,
		maxAge,
		dsiAlertStatus: filters.dsiAlertStatus || "",
		pcpId: filters.physicianId || "",
		pcpRoleStatus: "CPHY",
	};
};
export const buildActivePatientListRequest = ({
	draw = 1,
	rows = 10,
	first = 0,
	filters = {},
	// Legacy orders both tables by the S.No column (the only orderable one).
	sortField = "sno",
	sortOrder = 1,
	patientsType = "active",
} = {}) => ({
	draw,
	length: rows,
	start: first,
	filter: buildListFilter(filters, patientsType),
	order: {
		column: sortField || "sno",
		type: sortOrder === -1 ? "desc" : "asc",
	},
	search: filters.search || "",
	searchColumn: resolveSearchColumn(patientsType, filters.searchColumn),
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
 * Normalize a raw deactivated (user-list) record into the row shape the UI consumes.
 * The deactivated list comes from /user/list, whose field names differ from the
 * active list's (patientDob / mobilePhone) — legacy displayEnrolledDeactivatedPatientsList.
 * @param {Record<string, any>} patient
 */
export const mapDeactivatedPatientRow = (patient) => ({
	id: patient.patientId,
	patientId: patient.patientId,
	sno: patient.sno || "",
	fullName: patient.fullName || "",
	gender: patient.genderDesc || "",
	genderCode: patient.genderCode,
	dob: patient.patientDob || "",
	// Legacy renders the deactivated age with a space ("54 yrs"); the active list
	// renders it without one. Kept verbatim.
	age: computePatientAge(patient.patientDob, " "),
	emrId: patient.emrId || "",
	mobilePhoneNumber: patient.mobilePhone || "",
	homePhoneNumber: "",
	workPhoneNumber: "",
	patientEffectiveDate: patient.patientEffectiveDate || "",
	raw: patient,
});
/**
 * Fetch and map the active patient list.
 * @param {Object} [params] buildActivePatientListRequest options
 * @returns {Promise<import('../types/models').ActivePatientsResult>}
 */
export const fetchActivePatients = async (params = {}) => {
	const request = buildActivePatientListRequest({ ...params, patientsType: "active" });
	const response = await apiPost(ENDPOINTS.patient.activeList, request);
	return {
		rows:
			response?.status === "success"
				? (response.data ?? []).map(mapActivePatientRow)
				: [],
		totalRecords: response?.recordsFiltered ?? 0,
		// The "Active (n)" tab label counts every patient, not the filtered subset.
		recordsTotal: response?.recordsTotal ?? 0,
		request,
	};
};
/**
 * Fetch and map the deactivated patient list (legacy loadFilterInputValuesForDeactivatedPatients).
 * @param {Object} [params] buildActivePatientListRequest options
 */
export const fetchDeactivatedPatients = async (params = {}) => {
	const request = buildActivePatientListRequest({ ...params, patientsType: "inactive" });
	const response = await apiPost(ENDPOINTS.patient.deactivatedList, request);
	return {
		rows:
			response?.status === "success"
				? (response.data ?? []).map(mapDeactivatedPatientRow)
				: [],
		totalRecords: response?.recordsFiltered ?? 0,
		// Legacy labels the Deactivated tab with the filtered count.
		recordsTotal: response?.recordsFiltered ?? 0,
		request,
	};
};
export const fetchPatientDetails = (patientId) =>
	apiPostForm(ENDPOINTS.patient.details, { patientId });
/**
 * Active (not-yet-actioned, not invalidated) DSI alerts for a patient — legacy
 * PatientDemographics.fetchPatientDsiActiveAlertsList. Drives the demographics
 * bar's "DSI Alert" highlight.
 * @param {string|number} patientId
 */
export const fetchPatientDsiAlerts = (patientId) =>
	apiPost(ENDPOINTS.dsi.alertsSearch, {
		patientId,
		isActionTaken: null,
		invalidFlag: 'N',
	});
export const downloadPatientCCD = (patientId) =>
	apiPost(
		ENDPOINTS.patient.ccdDownload,
		{ patientId },
		{ responseType: "blob" },
	);
const patientService = {
	buildActivePatientListRequest,
	resolveSearchColumn,
	mapActivePatientRow,
	mapDeactivatedPatientRow,
	fetchActivePatients,
	fetchDeactivatedPatients,
	fetchPatientDetails,
	fetchPatientDsiAlerts,
	downloadPatientCCD,
};
export default patientService;
