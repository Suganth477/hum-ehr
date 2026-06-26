import ENDPOINTS from './endpoints';
import { apiGet, apiPost, apiPostForm } from './apiClient';
/**
 * HumCode lists come back as an object map keyed by code
 * ({ ACTIVE: { code, description }, ... }); flatten to an array. Mirrors the
 * normalization the allergy module does (kept here so problem metadata can
 * reuse it). Other endpoints already return arrays, so handle both.
 */
export const humCodeListToArray = (response) => {
    const data = response?.status === 'success' ? response.data : response;
    if (!data)
        return [];
    const list = Array.isArray(data) ? data : Object.values(data);
    return list.map((item) => ({
        ...item,
        code: item.code,
        description: item.description || item.conceptName || item.name || item.code,
    }));
};
export const fetchHumCodeList = (groupCode) => apiGet(ENDPOINTS.lookup.humCodes(groupCode));
export const fetchMultipleHumCodes = (groupCodes = []) => apiPost(ENDPOINTS.lookup.multipleHumCodes, {
    groupCodes: Array.isArray(groupCodes) ? groupCodes.join(',') : groupCodes,
});
export const fetchAllergyLookup = ({ conceptCategory, searchParameter = '', }) => {
    const params = new URLSearchParams({ conceptCategory });
    // Backend param name is misspelled ("searchParamter"); kept verbatim so the
    // request matches the controller. Fix on the backend, then update here.
    if (searchParameter)
        params.set('searchParamter', searchParameter);
    return apiPost(`${ENDPOINTS.allergy.lookup}?${params.toString()}`);
};
// ---- Problems (diagnosis) lookups ----
/** ICD-10 autocomplete by code or description (min 3 chars enforced by caller). */
export const fetchProblemIcdLookup = (searchTerm = '') => {
    const params = new URLSearchParams({ description: searchTerm });
    return apiGet(`${ENDPOINTS.problem.icdLookup}?${params.toString()}`);
};
/** SNOMED CT codes linked to a (dotted) ICD code. Backend expects form-encoded. */
export const fetchProblemSnomedForIcd = (icd) => apiPostForm(ENDPOINTS.problem.snomedLookup, { icd });
/** Clinical + verification status option lists for the problem add/edit form. */
export const fetchProblemStatusMetadata = async () => {
    const [clinical, verification] = await Promise.all([
        fetchHumCodeList('DIAG-CLINICAL-STATUS'),
        fetchHumCodeList('DIAG-VERIFICATION-STATUS'),
    ]);
    return {
        clinicalStatuses: humCodeListToArray(clinical),
        verificationStatuses: humCodeListToArray(verification),
    };
};
export const fetchSubscribedProducts = () => apiGet(ENDPOINTS.lookup.subscribedProducts);
export const fetchFacilities = () => apiGet(ENDPOINTS.lookup.facilities);
export const fetchPhysiciansInCareGroup = () => apiGet(ENDPOINTS.lookup.physiciansInCareGroup);
export const fetchClinicians = () => apiGet(ENDPOINTS.lookup.clinicians);
export const fetchTimeZones = () => apiGet(ENDPOINTS.lookup.timeZones);
const dataOrEmpty = (response) => response?.status === 'success' ? response.data ?? [] : [];
export const fetchAllergyMetadata = async () => {
    const [types, severities, criticalities, verificationStatuses, clinicalStatuses] = await Promise.all([
        fetchHumCodeList('PATI-ALRG'),
        fetchAllergyLookup({ conceptCategory: 'ALSE' }),
        fetchAllergyLookup({ conceptCategory: 'ALCR' }),
        fetchAllergyLookup({ conceptCategory: 'ALVS' }),
        fetchHumCodeList('ALLERGY-CLINICAL-STATUS'),
    ]);
    return {
        types: dataOrEmpty(types),
        severities: dataOrEmpty(severities),
        criticalities: dataOrEmpty(criticalities),
        verificationStatuses: dataOrEmpty(verificationStatuses),
        clinicalStatuses: dataOrEmpty(clinicalStatuses),
    };
};
const lookupService = {
    fetchHumCodeList,
    fetchMultipleHumCodes,
    fetchAllergyLookup,
    humCodeListToArray,
    fetchProblemIcdLookup,
    fetchProblemSnomedForIcd,
    fetchProblemStatusMetadata,
    fetchSubscribedProducts,
    fetchFacilities,
    fetchPhysiciansInCareGroup,
    fetchClinicians,
    fetchTimeZones,
    fetchAllergyMetadata,
};
export default lookupService;
