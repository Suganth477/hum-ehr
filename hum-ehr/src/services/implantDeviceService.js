import ENDPOINTS from './endpoints';
import { apiGet, apiPost, apiPostForm } from './apiClient';
import moment, { userNow } from '../utils/dayjs';

/**
 * Implantable-device data layer. Mirrors patient.implantable.device.js + api.utility.js:
 *   list           POST (form) /implant/device/list      { activeFlag, patientId, searchValue, invalidFlag }
 *   validateAndFetch POST(json) /implant/device/validateAndFetch { code, patientId }   (UDI/GUDID lookup)
 *   verifyLater    POST (json) /implant/device/verifyLater { code, patientId }
 *   invalid        GET         /implant/device/invalid?id=            (delete / mark-as-error)
 *   lookup         POST (json) /implant/device/lookup?code=  { start, length, search }  (device-type SNOMED)
 *   save           POST (json) /implant/device/save
 *   explantSave    POST (json) /implant/device/explant/save
 *   getPendingDevice GET       /implant/device/getPendingDevice?patientId=
 *   invalidateUdi  POST (form) /implant/device/invalidateUdi?patientId=
 *   bodySite       POST (form) /bodySite-lookup  { searchParamter }   (shared)
 * recordType is 'active' (Active) or 'history' (Inactive). invalidFlag 'Y' = marked-as-error view.
 */
export const fetchImplantDeviceList = async ({ patientId, recordType = 'active', search = '', invalidFlag = '' }) => {
	// Legacy: activeFlag is "" when viewing marked-as-error, else Y for active / N for history.
	const activeFlag = invalidFlag ? '' : (recordType === 'active' ? 'Y' : 'N');
	const response = await apiPostForm(ENDPOINTS.implantDevice.list, {
		activeFlag,
		patientId,
		searchValue: search || '',
		invalidFlag: invalidFlag || '',
	});
	const data = response?.status === 'success' ? (response.data || {}) : {};
	return {
		records: Array.isArray(data.medicalEquipmentList) ? data.medicalEquipmentList : [],
		pendingVerificationFlag: data.pendingVerificationFlag,
		response,
	};
};

// Soft-delete + mark-as-error both go through /implant/device/invalid?id= (legacy getRequestWithoutId).
export const deleteImplantDevice = (deviceId) => apiGet(`${ENDPOINTS.implantDevice.invalid}?id=${deviceId}`);

// UDI validate + fetch device attributes from GUDID.
export const validateAndFetchImplantDevice = (code, patientId) =>
	apiPost(ENDPOINTS.implantDevice.validateAndFetch, { code, patientId });

// "Verify later" when the GUDID third-party service is down.
export const verifyImplantDeviceLater = (code, patientId) =>
	apiPost(ENDPOINTS.implantDevice.verifyLater, { code, patientId });

export const getPendingImplantDevice = (patientId) =>
	apiGet(`${ENDPOINTS.implantDevice.getPendingDevice}?patientId=${patientId}`);

export const removePendingImplantDevice = (patientId) =>
	apiPostForm(`${ENDPOINTS.implantDevice.invalidateUdi}?patientId=${patientId}`, {});

export const saveImplantDevice = (payload) => apiPost(ENDPOINTS.implantDevice.save, payload);
export const saveImplantDeviceExplant = (payload) => apiPost(ENDPOINTS.implantDevice.explantSave, payload);

// Device-type (SNOMED) typeahead — paginated. Legacy appends a literal empty `?code=`.
export const fetchImplantDeviceTypeLookup = async ({ search = '', start = 0, length = 50 }) => {
	const response = await apiPost(`${ENDPOINTS.implantDevice.lookup}?code=`, { start, length, search });
	const list = response?.status === 'success' && Array.isArray(response.data)
		? response.data.map((item) => ({ id: item.id, code: item.code, value: `${item.code}-${item.codeDescribtion}` }))
		: [];
	return { options: list, totalRecords: response?.totalRecords ?? 0 };
};

// Shared body-site typeahead (same endpoint the immunization site + procedure use).
export const fetchImplantBodySiteLookup = async (term) => {
	const response = await apiPostForm(ENDPOINTS.lookup.bodySiteLookup, { searchParamter: term });
	const data = response?.status === 'success' && Array.isArray(response.data) ? response.data : [];
	return data
		.filter((item, index) => item.isActive === 'Y' && index < 500)
		.map((item) => ({ id: item.id, code: item.code, value: item.description }));
};

// Linked procedure / surgical-history option lists (used by the add/edit link pickers).
export const fetchImplantProcedureList = (patientId) =>
	apiPostForm(`${ENDPOINTS.implantDevice.procedureList}?patientId=${patientId}`, {});
export const fetchImplantSurgicalList = (patientId) =>
	apiPostForm(`${ENDPOINTS.implantDevice.surgicalList}?patientId=${patientId}`, {});

/**
 * Mirrors PatientImplantableDeviceDetailViewAddEdit.saveImplantableDeviceDetails.
 * Dates get the logged-in user's current time appended (implant/explant) or 12:59 (mfg/expiry),
 * exactly like the legacy save. `form` carries the resolved lookup ids alongside typed values.
 */
export const buildImplantDeviceSavePayload = ({ patientId, form, overrideDuplicate = false }) => {
	const now = userNow();
	const withUserTime = (d) => (d ? moment(d, 'MM-DD-YYYY').set({ hour: now.hours(), minute: now.minutes(), second: now.seconds() }).format('MM-DD-YYYY hh:mm A') : '');
	const withNoonTime = (d) => (d ? moment(d, 'MM-DD-YYYY').set({ hour: 12, minute: 59, second: 0 }).format('MM-DD-YYYY hh:mm A') : '');
	const explanting = !!form.explantFlag;
	return {
		id: form.id || '',
		uniqueDeviceId: form.uniqueDeviceId === 'Unknown' ? '' : (form.uniqueDeviceId || ''),
		deviceIdentifier: form.deviceIdentifier || '',
		serialNumber: form.serialNumber || '',
		expiryDate: withNoonTime(form.expiryDate),
		manufacturedDate: withNoonTime(form.manufacturedDate),
		deviceName: form.deviceName || '',
		deviceDescription: form.deviceDescription || '',
		brandName: form.brandName || '',
		model: form.model || '',
		patientId,
		bodySiteId: form.bodySiteId || '',
		implantProviderName: form.implantProviderName || '',
		explantProviderName: '',
		surgicalHistoryId: form.surgicalHistoryId || [],
		procedureId: form.procedureId || [],
		explantFlag: explanting ? 'Y' : 'N',
		deviceTypeId: form.deviceTypeId || '',
		companyName: form.companyName || '',
		lotNumber: form.lotNumber || '',
		implantDate: withUserTime(form.implantDate),
		explantDate: explanting ? withUserTime(form.explantDate) : '',
		mriSafetyInfo: form.mriSafetyInfo || '',
		hcpFlag: form.hcpCode ? 'Y' : 'N',
		hcpCode: form.hcpCode || '',
		naturalRubberLatexStatus: form.naturalRubberLatexStatus || '',
		reasonForImplant: form.reasonForImplant || '',
		reasonForExplant: explanting ? (form.reasonForExplant || '') : null,
		notes: form.notes || '',
		associations: [
			{
				explantFlag: explanting ? 'Y' : 'N',
				procedureId: form.explantProcedureId || [],
				surgicalHistoryId: form.explantSurgicalId || [],
			},
		],
		overrideDuplicate: overrideDuplicate === true,
		snomedCode: form.snomedCode || '',
	};
};

// Mirrors PatientImplantableDeviceExplantation.getExplantReuestParam.
export const buildImplantDeviceExplantPayload = ({ patientId, deviceId, explantDate, reasonForExplant }) => {
	const now = userNow();
	const explantDateAndTime = explantDate
		? moment(explantDate, 'MM-DD-YYYY').set({ hour: now.hours(), minute: now.minutes(), second: now.seconds() }).format('MM-DD-YYYY hh:mm A')
		: '';
	return {
		id: deviceId,
		patientId,
		explantDate: explantDateAndTime,
		reasonForExplant: reasonForExplant || '',
		// Procedure / surgical linkage is commented-out (inactive) in the legacy explant flow.
		associations: [{ explantFlag: 'Y', procedureId: null, surgicalHistoryId: null }],
	};
};

const implantDeviceService = {
	fetchImplantDeviceList,
	deleteImplantDevice,
	validateAndFetchImplantDevice,
	verifyImplantDeviceLater,
	getPendingImplantDevice,
	removePendingImplantDevice,
	saveImplantDevice,
	saveImplantDeviceExplant,
	fetchImplantDeviceTypeLookup,
	fetchImplantBodySiteLookup,
	fetchImplantProcedureList,
	fetchImplantSurgicalList,
	buildImplantDeviceSavePayload,
	buildImplantDeviceExplantPayload,
};
export default implantDeviceService;
