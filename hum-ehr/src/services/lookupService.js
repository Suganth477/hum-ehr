import ENDPOINTS from './endpoints';
import { apiGet, apiPost } from './apiClient';
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
    fetchSubscribedProducts,
    fetchFacilities,
    fetchPhysiciansInCareGroup,
    fetchClinicians,
    fetchTimeZones,
    fetchAllergyMetadata,
};
export default lookupService;
