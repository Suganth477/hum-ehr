const ENDPOINTS = {
	auth: {
		logout: '/logout',
	},
	// Section-level concurrency locks (legacy active.session.handle.js). A lock is
	// taken when a user opens an existing record for edit; heartbeats keep it alive,
	// resume re-checks it, and un-lock releases it. All are POST form-encoded.
	navigationResource: {
		lock: '/navigation-resource/lock',
		unlock: '/navigation-resource/un-lock',
		resume: '/navigation-resource/lock/resume',
		heartbeat: '/navigation-resource/lock/heartbeat',
	},
	// Decision Support Intervention (DSI) — re-evaluated after a clinical change
	// (e.g. a saved/deleted problem may raise a drug-disease interaction alert).
	// Legacy utility.fetchEhrPatientDsiAlertDetails: POST { patientId, productCode:'DSI' }.
	intervention: {
		eventBased: '/intervention/event-based-intervention',
	},
	patient: {
		details: '/patient/details',
		activeList: '/patient/list/all',
		// Lightweight name typeahead (legacy apiUtility.fetchActivePatientList):
		// POST form { patientName } -> [{ patientId, patientName, dob, ... }].
		// Distinct from `activeList`, which is the DataTables patient grid.
		activeLookup: '/active/patients/list',
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
		// Patient diagnosis + encounter problems, used by hospitalization / orders
		// diagnosis pickers. Legacy: POST /diagnosis/patient-diagnosis-problems?patientId=
		patientProblems: '/diagnosis/patient-diagnosis-problems',
	},
	// Hospitalization is a "care status" of type HOSP on the backend.
	hospitalization: {
		list: '/care-status/hospitalization',
		save: '/care-status/save',
		invalid: '/care-status/invalid',
		validate: '/care-status/validation',
	},
	// Immunization (vaccines) — completed + scheduled.
	immunization: {
		list: (recordType = 'active', patientId) => `/immunization/${recordType}/${patientId}`,
		save: '/immunization',
		invalid: '/immunization/invalid',
		lookup: '/immunization/lookup',
	},
	// Procedures (SOAP plan) — patient-chart procedure section.
	procedure: {
		list: '/soap/plan/procedure/list',                 // POST form { patientId, encounterId, searchValue }
		save: '/soap/plan/procedure/saveOrUpdate',         // POST json
		invalidate: '/soap/plan/procedure/invalidate',     // POST form { procedureId, patientId }
		groupCodes: '/soap/plan/procedure-code-list',      // POST ?groupCode=PRST|PROU|PRCT|PRFU|PRCO[&search=]
		lookup: '/soap/plan/procedure/lookup',             // POST form { searchParameter } (PRCNA)
		referralReasonLookup: '/referralReason-lookup',    // POST form { searchParameter } (PCRE)
		sdohInterventionLookup: '/soap/plan/sdohIntervention/lookup', // POST form { searchParameter }
		reportFile: '/soap/plan/reportFile',               // GET ?attachmentId=
		deleteReport: '/soap/plan/deleteReport',           // POST ?procedureId=
	},
	// Surgical history — patient-chart surgical history section.
	surgicalHistory: {
		list: '/surgical-history/list',                    // POST json ?patientId=&surgeryName=
		save: '/surgical-history/saveOrUpdate',            // POST json
		invalid: '/surgical-history/invalid',              // POST json
		surgeryNameLookup: '/surgical-history/surgery-name/lookup', // GET ?name=
		// NOTE: the backend param is misspelled ("attachementId") — kept verbatim.
		reportFile: '/surgical-history/report/id',         // GET ?attachementId=
		deleteReport: '/surgical-history/deleteReport',    // POST ?attachmentId=
	},
	// Patient EHR Documents — server-side paginated list + file attachments.
	patientDocuments: {
		list: '/patient-documents/patientDocument/list',        // POST json (DataTables server-side)
		categoryLookup: '/patient-documents/category-lookup',   // GET
		getFiles: '/patient-documents/getPatientDocumentsById', // POST ?documentId=
		save: '/patient-documents/saveOrUpdate',                // POST json
		delete: '/patient-documents/deleteDocumentById',        // POST ?documentId=
	},
	// Patient Preferences — Advance Directives / Care / Treatment (category-based).
	preference: {
		list: (category, recordType) => `/preference/${category}/${recordType === 'active' ? 'active' : 'history'}`,
		lookup: '/preference/lookup',
		statusCodes: '/hum-codes/PREF-STS-CODE',
		saveOrUpdate: (category) => `/preference/${category}/saveOrUpdate`,
		attachment: '/preference/advance-directive/attachment',
	},
	// Family Health History — member × SNOMED-condition matrix.
	familyHistory: {
		list: '/familyHistory/list/',            // GET + patientId
		snomedSearch: '/familyHistory/search/snomed', // POST form { searchSnomed, isDefaultValue }
		memberSave: '/familyHistory/member/save',     // POST json (incremental member auto-save)
		memberInvalid: '/familyHistory/member/invalid', // POST form (delete a member/column)
		save: '/familyHistory/save',                    // POST json (final matrix save)
	},
	// Implantable devices (medical equipment) — UDI / GUDID based.
	implantDevice: {
		list: '/implant/device/list',
		validateAndFetch: '/implant/device/validateAndFetch',
		verifyLater: '/implant/device/verifyLater',
		// Soft-delete / mark-as-error (GET ?id=). Same endpoint serves both actions.
		invalid: '/implant/device/invalid',
		// Device-type (SNOMED) typeahead. Legacy appends an empty `?code=` query param.
		lookup: '/implant/device/lookup',
		save: '/implant/device/save',
		explantSave: '/implant/device/explant/save',
		procedureList: '/implant/device/procedure/list',
		surgicalList: '/implant/device/surgical/list',
		unique: '/implant/device/unique',
		getPendingDevice: '/implant/device/getPendingDevice',
		invalidateUdi: '/implant/device/invalidateUdi',
	},
	// Health insurance (payer/coverage) records.
	healthInsurance: {
		list: (recordType = 'active', patientId) => `/insurance/${recordType}/list/${patientId}`,
		save: '/insurance/save',
		invalid: '/insurance/invalid',
		payerList: '/payer/list',
		payerLookup: '/payer/lookup',
	},
	// Patient Goals (humgoals) + SDOH goals (sdoh-goal) are separate backends.
	goal: {
		// Patient goal list: GET /humgoals/{recordType}/{patientId}/ALL?searchValue=&id={userId}
		patientList: (recordType = 'active', patientId) => `/humgoals/${recordType}/${patientId}/ALL`,
		patientSave: '/humgoals/save',
		patientInvalid: '/humgoals/invalid',
		patientLookup: '/humgoals/lookup',
		// SDOH goal list: POST /sdoh-goal/{recordType}?patientId=&searchValue=
		sdohList: (recordType = 'active') => `/sdoh-goal/${recordType}`,
		sdohSave: '/sdoh-goal/saveOrUpdate',
		sdohLookup: '/sdoh-goal/lookup',
		statusCodes: '/hum-codes/GOAL-STS-CODE',
	},
	lookup: {
		humCodes: (groupCode) => `/hum-codes/${groupCode}`,
		multipleHumCodes: '/multiple/hum-codes',
		subscribedProducts: '/configuration/products',
		facilities: '/facilities',
		physiciansInCareGroup: '/physicians',
		clinicians: '/clinicians',
		timeZones: '/timezones',
		// Shared body-site typeahead (procedure / implantable device / immunization).
		bodySiteLookup: '/bodySite-lookup',
	},
	// Patient Profile — demographics / contact / care team / care givers /
	// deactivation / mobile access / preferred day & time.
	patientProfile: {
		// The four legacy "form-data saves": multipart body with a single
		// `data` field holding the JSON payload.
		updateDemographics: '/patient/update/demographic',
		updateContactInfo: '/patient/update/contactinfo',
		updateMobileAccess: '/patient/update/mobileaccess',
		updatePreferredDayTime: '/patient/update/preferreddaytime',
		addressSaveOrUpdate: '/patient/address/saveOrUpdate',   // POST json
		previousAddressList: '/patient/address/list/',          // GET {patientId} (no ?id)
		ethnicityLookup: '/ethnicity-lookup',                   // GET
		raceLookup: '/race-lookup',                             // POST json {start,length,search}
		languageLookup: '/language-lookup',                     // POST json {start,length,search}
		occupationLookup: '/occupation-lookup',                 // POST json {start,length,search}
		occupationIndustryLookup: '/occupation-industry-lookup',// POST json {start,length,search}
		timeZoneHumCodes: '/hum-codes/UTC-TIMEZONE',            // GET
		uniqueValidation: '/eligible-patient/validation',       // POST form (emrId/mobile/email duplicate check)
		zipcode: (zip) => `/zipcode/${zip}`,                    // GET → [{city, state}]
		smsValidateNumber: '/sms/validate/number',              // POST form {number, patientId}
		smsResend: '/sms/resent',                               // POST form {number, patientId}
		smsValidateOtp: '/sms/validate/otp',                    // POST form {otp, patientId}
		deactivateUser: '/deactivate/user',                     // POST multipart {userId, code, notes, exitForm}
		deactivateReasons: '/hum-codes/DEACTIVE/PATI-DEACTIVE', // GET
		carePlanDetails: (patientId, carePlanId) => `/careplan/${patientId}${carePlanId ? `/${carePlanId}` : ''}`, // GET ?id
		careTeam: '/careteam',                                  // POST form {patientId, physicianId, clinicianId, alertFlag} (fetch + save)
		specialtyProviders: '/speciality/physicians',           // GET /{recordType}/{patientId}; POST json (save)
		specialtyProviderInvalid: '/speciality/physicians/invalid',       // POST json
		specialtyProviderValidation: '/speciality/physicians/validation', // POST json → boolean
		taxonomyLookup: '/taxonomy/lookup',                     // POST ?keyword=
		careGivers: '/caregivers',                              // GET /{recordType}/{patientId}; POST json (save)
		careGiversInvalid: '/caregivers/invalid',               // POST json
		careGiverTypes: '/hum-codes/CARE_GIVER_TYPE',           // GET (types + relationships via subGroupCode)
		commMethods: '/hum-codes/COMM-METH',                    // GET
	},
	// Message Center — Chat surface.
	// `signal.*` paths hit the separate chat microservice (config.signalUrl) via
	// chatClient (form-urlencoded, token+apiUrl in body). `standard.*` paths hit
	// the normal backend via apiClient.
	messageCenter: {
		signal: {
			dashboard: '/message/center/chat/dashboard',            // POST form: recent-chat users
			loggedInUserKeyDetails: '/get/loggedInUser/KeyDetails', // POST form: first-time-user key setup
			oldMessageData: '/message/center/oldMessage/data',      // POST form: encrypt migrated messages
			userMessageEntries: '/get/distributedUser/message/details', // POST form: individual chat history
			messageSave: '/message/center/chat/message-save',       // POST form: send message
			mediaAttachments: '/get/distributedUser/media/attachments', // POST form: media side panel
		},
		standard: {
			contactUsersList: '/business/message/contact',          // POST json: user search (new chat)
			oldMessageMigration: '/sms/getChatDetails',             // POST json: fetch legacy messages to migrate
			updateUnreadCount: '/business/message/status-update',   // POST json: mark messages read
			notificationCount: '/business/message/count?communicationType=INAPCHT', // GET
		},
	},
	// In-App Mail — secure internal messaging (distinct from the chat surface above).
	// All calls hit the standard backend via apiClient (JSON). Legacy source:
	// care-team-communication/in.app.mail.conversation.list.js.
	inAppMail: {
		conversationList: '/inAppMail/conversationList',   // POST json: folder list (DataTables server-side)
		details: '/inAppMail/details',                     // POST ?parentMailId=&statusIsTrash=Y|N (null body): thread
		contact: '/inAppMail/contact',                     // POST json: recipient (to/cc) search
		save: '/inAppMail/save',                           // POST json: new mail / draft (no messageId)
		update: '/inAppMail/status/update',                // POST json: existing mail (has messageId)
		// Shared read/star/trash/permtrash endpoint (same path as chat's updateUnreadCount).
		// Legacy constant: IN_APP_MAIL_COMMON_URL.inAppMailMessageStatusChangeApi.
		statusChange: '/business/message/status-update',   // POST json: { statusCode, statusFlag, messageDetailsIdList }
		count: '/inAppMail/count',                         // POST json (null body): per-folder unread counts
		eventValidation: '/inAppMail/event/validation',    // GET ?patientId=&eventCode= (patient-scoped mail)
	},
	// Direct Address — Direct Secure Messaging (DIRECT protocol) inbox. A third
	// Message Center surface next to Chat and In-App Mail: messages are exchanged
	// with EXTERNAL direct addresses (provider / organization), not internal users.
	// Legacy source: hum-js/message-center/ehr.message.center.js (EhrDirectAdress*)
	// + api.utility.js "Direct Address APIs" block.
	directAddress: {
		list: '/direct/address',                    // GET ?id={userId}: the user's physician + facility direct addresses
		messageList: '/direct/message/list',        // POST json: section list (DataTables-style paging)
		send: '/direct/message/send',               // POST multipart: send / save-draft (data + attachments + cdaFiles)
		conversation: '/direct/message/details',    // GET ?parentMessageId=: full thread
		attachmentFile: '/direct/message/file',     // GET ?attachmentId=: single attachment download
		statusUpdate: '/direct/status/update',      // POST json: { directMessageIdList, isArchived, isRead }
		recipientLookup: '/direct/recipient/search',// GET ?search=: external direct-address typeahead
		sectionCount: '/direct/message/count',      // GET ?directAddressId=: per-section counts
		draftDelete: '/direct/message/draft/delete',// POST ?messageId=: discard a draft
	},
};
export default ENDPOINTS;
