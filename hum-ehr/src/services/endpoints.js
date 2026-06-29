const ENDPOINTS = {
	auth: {
		logout: '/logout',
	},
	patient: {
		details: '/patient/details',
		activeList: '/patient/list/all',
		ccdDownload: '/patient/ccd/download',
		activeCount: '/patient/active/count/',
	},
	allergy: {
		list: (recordType = 'active') => `/allergies/${recordType}`,
		save: '/allergies',
		invalid: '/allergies/invalid',
		recover: '/allergies/recover',
		lookup: '/allergies/lookup',
	},
	problem: {
		list: (recordType = 'active') => `/diagnosis/${recordType}`,
		save: '/diagnosis',
		invalid: '/diagnosis/invalid',
		icdLookup: '/diagnosis/icd/lookup',
		snomedLookup: '/diagnosis/snomed/lookup',
	},
	lookup: {
		humCodes: (groupCode) => `/hum-codes/${groupCode}`,
		multipleHumCodes: '/multiple/hum-codes',
		subscribedProducts: '/configuration/products',
		facilities: '/facilities',
		physiciansInCareGroup: '/physicians/care-group',
		clinicians: '/clinicians',
		timeZones: '/timezones',
	},
};
export default ENDPOINTS;
