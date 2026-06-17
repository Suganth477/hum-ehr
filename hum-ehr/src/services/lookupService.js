import ENDPOINTS from './endpoints';
import { apiGet, apiPost } from './apiClient';

export const fetchHumCodeList = (groupCode) => apiGet(ENDPOINTS.lookup.humCodes(groupCode));

export const fetchMultipleHumCodes = (groupCodes = []) => {
	const requestParam = {
		groupCodes: Array.isArray(groupCodes) ? groupCodes.join(',') : groupCodes,
	};
	return apiPost(ENDPOINTS.lookup.multipleHumCodes, requestParam);
};

export const fetchAllergyLookup = ({ conceptCategory, searchParamter = '', searchParameter = '' }) =>
	apiPost(`${ENDPOINTS.allergy.lookup}?conceptCategory=${encodeURIComponent(conceptCategory)}${searchParamter || searchParameter ? `&searchParamter=${encodeURIComponent(searchParamter || searchParameter)}` : ''}`);

export const fetchSubscribedProducts = () => apiGet(ENDPOINTS.lookup.subscribedProducts);
export const fetchFacilities = () => apiGet(ENDPOINTS.lookup.facilities);
export const fetchPhysiciansInCareGroup = () => apiGet(ENDPOINTS.lookup.physiciansInCareGroup);
export const fetchClinicians = () => apiGet(ENDPOINTS.lookup.clinicians);
export const fetchTimeZones = () => apiGet(ENDPOINTS.lookup.timeZones);

export const fetchAllergyMetadata = async () => {
	const [types, severities, criticalities, verificationStatuses, clinicalStatuses] = await Promise.all([
		fetchHumCodeList('PATI-ALRG'),
		fetchAllergyLookup({ conceptCategory: 'ALSE' }),
		fetchAllergyLookup({ conceptCategory: 'ALCR' }),
		fetchAllergyLookup({ conceptCategory: 'ALVS' }),
		fetchHumCodeList('ALLERGY-CLINICAL-STATUS'),
	]);

	return {
		types: types?.status === 'success' ? types.data || [] : [],
		severities: severities?.status === 'success' ? severities.data || [] : [],
		criticalities: criticalities?.status === 'success' ? criticalities.data || [] : [],
		verificationStatuses: verificationStatuses?.status === 'success' ? verificationStatuses.data || [] : [],
		clinicalStatuses: clinicalStatuses?.status === 'success' ? clinicalStatuses.data || [] : [],
		raw: { types, severities, criticalities, verificationStatuses, clinicalStatuses },
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
