import ENDPOINTS from './endpoints';
import { apiGet, apiPost, apiPostForm } from './apiClient';

/**
 * Immunization data layer. Mirrors patient.immunization.js + api.utility.js:
 *   list    GET  /immunization/{recordType}/{patientId}?searchValue=
 *   save    POST (json) /immunization              (legacy auto-save pipeline)
 *   invalid POST (json) /immunization/invalid
 *   lookup  POST (form) /immunization/lookup        { category, searchParamter }
 * recordType is 'active' (Completed) or 'schedule' (Scheduled).
 */
export const fetchPatientImmunizations = async ({ patientId, recordType = 'active', search = '' }) => {
	// The current backend requires an `invalidFlag` query param (the legacy
	// api.utility.js predates it). Immunization has no "show deleted" toggle, so
	// the list always requests non-deleted ('N') records.
	const params = new URLSearchParams({ searchValue: search || '', invalidFlag: 'N' });
	const response = await apiGet(`${ENDPOINTS.immunization.list(recordType, patientId)}?${params.toString()}`);
	const data = response?.status === 'success' ? response.data || [] : [];
	return { records: Array.isArray(data) ? data : [], response };
};

export const saveImmunization = (payload) => apiPost(ENDPOINTS.immunization.save, payload);
export const deleteImmunization = (payload) => apiPost(ENDPOINTS.immunization.invalid, payload);

// Backend param name is misspelled ("searchParamter") — kept verbatim so the
// request matches the controller (same quirk as the allergy lookup).
export const fetchImmunizationLookup = ({ category, searchParameter = null }) =>
	apiPostForm(ENDPOINTS.immunization.lookup, { category, searchParamter: searchParameter ?? '' });

// Legacy fetchImmunizationAutoCompleteList: keep active rows, cap at 500, map to {id, code, value}.
export const normalizeLookupOptions = (response) => {
	const data = response?.status === 'success' ? response.data || [] : [];
	return data
		.filter((item, index) => item.isActive === 'Y' && index < 500)
		.map((item) => ({ id: item.id, code: item.code, value: item.description }));
};

/** Prefetch the four static autocomplete lists the add/edit form needs. */
export const fetchImmunizationReferenceData = async () => {
	const [vaccines, routes, doseForms, units] = await Promise.all([
		fetchImmunizationLookup({ category: 'VACCIN' }),
		fetchImmunizationLookup({ category: 'VACROUTE' }),
		fetchImmunizationLookup({ category: 'VACDOSFORM' }),
		fetchImmunizationLookup({ category: 'VACUNIT' }),
	]);
	return {
		vaccines: normalizeLookupOptions(vaccines),
		routes: normalizeLookupOptions(routes),
		doseForms: normalizeLookupOptions(doseForms),
		units: normalizeLookupOptions(units),
	};
};

// Body-site is an async typeahead (min 3 chars, enforced by the caller). Legacy
// reuses the shared implantable-device/procedure body-site endpoint
// (POST form /bodySite-lookup { searchParamter }) — NOT the immunization lookup.
export const fetchVaccineSiteLookup = async (term) => {
	const response = await apiPostForm(ENDPOINTS.lookup.bodySiteLookup, { searchParamter: term });
	return normalizeLookupOptions(response);
};

/**
 * Mirrors PatientImmunizationAddEdit.getImmunizationDetailsSaveParam.
 * `form` carries the selected lookup ids alongside the typed values.
 */
export const buildImmunizationSavePayload = ({ patientId, careplanId, form, changeLogMessage = '', encounterId = null, validatedUserId = '' }) => ({
	id: form.id || null,
	patientId,
	careplanId: careplanId ?? null,
	vaccineName: form.vaccineName || null,
	administeringPhysician: form.administeringPhysician || '',
	// Recorded By — the logged-in user, always sent (legacy immunization_validated_recorded_by).
	validatedUserId,
	administeredDate: form.administeredDate || '',
	vaccineId: form.vaccineId || null,
	routeId: form.routeId || null,
	siteId: form.siteId || null,
	doseFormId: form.doseFormId || null,
	unitId: form.unitId || '',
	// Dose number (position in the vaccination series) — required by the backend
	// (@NotNull "Dose Number"); sent as an integer.
	doseNumber: form.doseNumber !== '' && form.doseNumber != null ? Number(form.doseNumber) : null,
	vaccineReason: form.vaccineReason || '',
	notes: form.notes || '',
	cdcName: form.cdcName || '',
	cdcType: form.cdcType || '',
	quantity: form.quantity || '',
	expirationDate: form.expirationDate || '',
	manufacturerName: form.manufacturerName || '',
	manufacturerCode: form.manufacturerCode || '',
	lotNumber: form.lotNumber || '',
	publicityCode: form.publicityCode || '',
	careplanLogMessageUserInput: changeLogMessage,
	careplanLogMessage: changeLogMessage,
	encounterId,
	logId: null,
});

// Mirrors deleteImmunizationParam (reuses the record + a programmatic change-log message).
export const buildImmunizationDeletePayload = ({ record, patientId, changeLogMessage = '', encounterId = null }) => ({
	id: record.id,
	careplanId: record.careplanId,
	patientId,
	logId: null,
	careplanLogMessageUserInput: changeLogMessage,
	careplanLogMessage: changeLogMessage,
	encounterId,
});

const immunizationService = {
	fetchPatientImmunizations,
	saveImmunization,
	deleteImmunization,
	fetchImmunizationLookup,
	normalizeLookupOptions,
	fetchImmunizationReferenceData,
	fetchVaccineSiteLookup,
	buildImmunizationSavePayload,
	buildImmunizationDeletePayload,
};
export default immunizationService;
