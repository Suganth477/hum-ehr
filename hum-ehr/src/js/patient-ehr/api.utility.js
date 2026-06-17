import { useCallback } from "react";
import axios from "axios";

const API_ENDPOINTS = {
        // patient end points
        patientDetails: "/patient/details",
        allActivePatientDetails: "/patient/list/all",

        // patient allergies
        allergyList: "/allergies",
        allergyInvalid: "/allergies/invalid",
        allergyLookup: "/allergies/lookup",
        humCodeAPI: "/hum-codes/",

        // patient problems
        problemList: "/diagnosis",
        problemInvalid: "/diagnosis/invalid",
        problemIcdLookup: '/diagnosis/icd/lookup',
        problemIcdSnomedLookup: "/diagnosis/snomed/lookup",

        // patient encounter
        encounterLookup: "/encounter/lookup",
        encounterServiceTypeList: "/encounter/serviceTypeList",
        encounterList: "/encounter/list",
        encounterSave: "/encounter/save",

        // patient encounter soap chief complaints
        encounterSoapChiefComplaints: "/soap/subjective/saveOrUpdate/visit-reason",
        encounterSoapActiveRosHopList: "/soap/subjective/activeList",
        encounterSoapPresentIllnessSummary: "/soap/subjective/list/presentIllness-summary",
        encounterSoapPresentIllnessSummarySave: "/soap/subjective/saveOrUpdate/presentIllness-summary",
        encounterSoapPresentIllnessDetailList: "/soap/subjective/list/presentIllness-details",
        symptomLookUp: "/soap/subjective/presentIllness-details/symptom-lookup",
        eSoapNotesHistoryOfPresentIllnessSave: "/soap/subjective/saveOrUpdate/presentIllness-details",
        eSoapHistoryOfPresentIllnessDelete: "/soap/subjective/invalidate/presentIllness-details",

        eSoapNotesReviewOfSystemLookUp: "/soap/subjective/system-lookup",
        eSoapNotesReviewOfSystemSummarySave: "/soap/subjective/saveOrUpdate/rosSummary",
        eSoapNotesReviewOfSystemList: "/soap/subjective/List/reviewOfSystem",
        eSoapNotesReviewOfSystemSave: "/soap/subjective/saveOrUpdate/ros",
        eSoapNotesEncounterVitalList: "/vitals/active/",
        eSoapNotesEncounterVitalSave: "/vitals",
        eSoapNotesEncounterVitalDelete: "/vitals/invalid",
        eSoapNotesAssessmentVisitProblemSummaryList: "/soap/assessment/list/visitProblem-summary",
        eSoapNotesAssessmentVisitProblemSummarySave: "/soap/assessment/saveOrUpdate/visitProblem-summary",
        eSoapNotesAssessmentVisitProblemDetailList: "/soap/assessment/list/visitProblem-detail",
        eSoapNotesAssessmentVisitProblemDetailSave: "/soap/assessment/saveOrUpdate/visitProblem-detail",
        eSoapNotesAssessmentVisitProblemDetailDelete: "/soap/assessment/invalidate/visitProblem-detail",
        fetchQuestionnaireCategoryList: "/soap/objective/physicalExamination/category",
        fetchQuestionnaireDetail: "/soap/objective/physicalExamination/details",
        eSoapPhysicalExaminationQuestionSave: "/soap/objective/physicalExamination/saveOrUpdate",

        // patient E-prescription
        patientEprescriptionList :`/surescript/prescription/list`,
        patientEprescriptionCancelRx:`/surescript/cancelRx`,
        transactionHistoryUrl :"/surescript/prescription/history",// transaction history API
        eRxProviderDetails:`/surescript/patient/provider/details`,
        eRxNcpdpFmtCode:`/surescript/ncpdpFmt/getCode`,
        eRxSurescriptGetQuantityCode:`/surescript/QNTCDLSQLR`, // QNTCDLSQLR is group code , if we call just use /surescript we can get all group codes
        eRxSurescriptGetPharmacyCode:`/surescript/PHRMSPLTY`, // PHRMSPLTY is a group code , 
        eRxMedicationSearchApi:`/rxnorm/search`,
        eRxMedicationDetailsAfterSearchApi:`/rxnorm/getDetails`,
        getPatientFavPharmacyList :`/surescript/pharmacy/getFavList`,
        getPatientFreqPharmacyList:`/surescript/pharmacy/getFrequentList`,
        eRxSearchPhamacy:`/surescript/pharmacy/search`,
        newRx:`/surescript/newRx`,
        rxChangeResponse:"/surescript/rxChangeResponse",
        rxRenewalResponse:"/surescript/rxRenewalResponse",

        // humcodes
        fetchMultipleHumCodes: "/multiple/hum-codes",

        // lab report
        labReportList: "/lab/result",
        availableTestNameLookUp :"/lab/labTestPanelLookUp",
        labTestDetailNameAvailableLookUp: "/lab/labTestLookUp",
        deleteInvalid: "/lab/invalidate",
        addUpdateLab: "/lab/save",
        
        // health status assessment
        // health concerns
        healthConcernsList: "/healthConcern/list",
        addUpdateHealthConcern: "/healthConcern/save",
        healthConcernInvalid: "/healthConcern/invalid",
        
        // functional status
        functionalStatusList: "/functionalStatus/list",
        addUpdateFunctionalStatus: "/functionalStatus/save",
        functionalStatusInvalid: "/functionalStatus/invalid",
        functionalStatusObservationLookUp: "/functionalStatus/lookup?code=",
        
        // Behavioral / Cognitive Status
        behavioralCognitiveStatusList: "/mentalStatus/list",
        addUpdatebehavioralCognitiveStatus: "/mentalStatus/save",
        behavioralCognitiveStatusInvalid: "/mentalStatus/invalid",
        behavioralCognitiveStatusObservationLookUp:"/mentalStatus/lookup?code=",
        
        // substance Use
        substanceUseList: "/substanceUse/list",
        addUpdateSubstanceUseStatus: "/substanceUse/save",
        substanceUseInvalid: "/substanceUse/invalid",
        substanceUseObservationLookUp:"/substanceUse/lookup?code=",
        
        // assessment
        assessmentSave: "/assessment/save",
        assessmentGetStatus: "/assessment/get/status",
        groupAssessmentHeathStatus: '/group/assessment/health-status/get',
        getAssessmentQuestionnaire: '/assessment/get/questionnaire',
        createAssessment: '/assessment/create',
        
        // implantable device
        implantableDeviceList: "/implant/device/list",
        invalidImplantDevice: "/implant/device/invalid",
        implantDeviceLookUp: "/implant/device/lookup",
        implantDeviceSave: "/implant/device/save",

        //immunization
        immunizationFetchListApi: "/immunization",
        immunizationLookup: "/immunization/lookup",
        immunizationSave: "/immunization",
        immunizationInvalid: "/immunization/invalid",

        // family history
        familyHistoryList: "/familyHistory/list/",
        familyHistorySearchSnomedLookUpAPI: "/familyHistory/search/snomed",
        invalidFamilyHistory: "/familyHistory/member/invalid",
        familyHistorySearchSnomed: "/familyHistory/search/snomed",
        familyHistorySave: "/familyHistory/save",
        familyHistoryMemberSave: "/familyHistory/member/save",
        socialhistoryList: "/socialhistory/list",
        socialhistoryInvalid: "/socialhistory/invalid",

        // social history
        socialHistorySave: "/socialhistory/save",
        socialhistoryOtherHistory: "/socialhistory/other/history",

        // other social history
        addUpdateOtherSocialHistory: "/socialhistory/other/save",
        getOtherSocialHistory: "/socialhistory/other/get",
        socialHistoryLookUp: "/socialhistory/lookup",

        // surgical history
        surgicalHistoryList: "/surgical-history/list",
        surgicalHistorySave: "/surgical-history/saveOrUpdate",
        surgicalHistoryDeleteReport: "/surgical-history/deleteReport",
        surgicalHistoryInvalid: "/surgical-history/invalid",
        surgicalHistoryReport: "/surgical-history/report",

        //soap plan URLS
        planEncounterPlanNotesSaveOrUpdate:"/plan/saveOrUpdate",
        encounterSoapNotesPlanList:"/plan/list",

        planNutritionRecommandationSave:"/plan/save/nutrition-recommendation",
        planPatientEducationSave:"/plan/save/patient-education",
        soapPlanOrderSave :"/order/save",
        soapPlanGoalSaveOrUpdate:"/plan/save/goal",
        getPatientNutritionList:"/plan/get/nutrition-recommendation",
        getPatientEducation: "/plan/get/patient-education",
        getPatientEncountersOrdersList:"/order/list",
        planDashboardViewList:"/order/dashboard/list",
        deleteNutritionRecommandation:"/plan/invalid/nutrition-recommendation",
        deletePatientEducation:"/plan/invalid/patient-education",
        lifestyleRecommendationList :"/lifestyle-changes",
        lifestyleRecommendationsHumCodes:"/hum-codes/LIFE-STLY-CHNG",
        patientEhrGoals:"/humgoals",
        patientHumgoalslookup:'/humgoals/lookup',
        patientOrderDelete:"/order/invalid",
        patientOrderClinicalTestPanelLookup :"/order/clinical-test-panel/lookup",
        patientOrderClinicalTestNameLookup: "/order/clinical-test-name/lookup",
        patientOrderImagingTypeLookup:"/order/imaging-type/lookup",
        patientOrderImagingNameLookup : "/order/imaging-name/lookup",
        patientOrderLabPanelLookup :"/order/lab-order-panel/lookup",
        patientOrderLabOrderTestLookup : "/order/lab-order-test/lookup",
        patientPlanOrderStatus:"/hum-codes/PLAN-ORD-STS",
        patientPlanOrderPriority:"/hum-codes/PLAN-ORD-PRIOTY",
        patientProcedureLookup :"/soap/plan/procedure/lookup",
        patientProcedureReferralReasonLookup:"/referralReason-lookup",

        //user managament URLS
        ehrUserList: "/user/list",
        ehrUserRole: "/user/role",
        ehrUserCareGroupFind: '/care-group/find',
        ehrUserLicenseTypeList: "/hum-codes/CARE-PHYS-TYPE",
        ehrFacilitiesList: "/facilities",
        physicianSpecialtyList: "/physicians/get/specialty-master/list",
        alertCommunicationHumCodes :"/hum-codes/ALERT-COMMUNICATION",
        timeZoneHumcodes : "/hum-codes/UTC-TIMEZONE",
        productList :"/configuration/products",
        communicationOptionHumcodes :"/hum-codes/COMM-METH",
        employeeTypeHumCodes :"/hum-codes/CARE-EMPL-TYPE",
        careGroupAdminCount :"/account/admin/count",
        userAccountDetails :"/account/user/details",
        preferedDateAndTimeHumcodes :"/hum-codes/CPLN-PREF-DAY",
        activePatientsCount: "/patient/active/count/",
        deactivateReasonsList: "/hum-codes/DEACTIVE/USER-DEACTIVE",
        deactivate: '/deactivate/user',
        activateUser: "/activate/user",
        alertEventHumCode:'/hum-codes/ALERT-COMMUNICATION',
        uniqueNPICheck: '/physicians/unique/npi',
        uniqueEmailAddressCheck: '/care-group/unique/email',
        uniqueFullNameCheck: '/user/name/validate',
        userEnableWebAndMobileAccess :"/user/updateWebAndMobileAccess",
        activePatientCount :"/active/patient-count",
        saveUserDetails: "/account/user/save",
        resendLoginCredentials :'/account/send/credentials',

        // Health Insurance
        healthInsurancePayerList: '/payer/list',
        healthInsurancePayerLookup:  '/payer/lookup',
        healthInsuranceInvalid: "/insurance/invalid",
        
        //EHR documents URLs 
        patientDocumentList:"/patient-documents/patientDocument/list",
        patientEhrDocumentsCategoryLookup : "/patient-documents/category-lookup",
        patientEhrDocumentgetFiles:"/patient-documents/getPatientDocumentsById",
        patientEhrDocumentsSave:"/patient-documents/saveOrUpdate",
        patientDocumentDelete:"/patient-documents/deleteDocumentById",

        // patient chart procedure
        soapPlanProcedureInvalidate: "/soap/plan/procedure/invalidate",
        soapPlanProcedureList: "/soap/plan/procedure/list",

        //patient chart referral URLs
        patientReferralList: "/patient-referral/list-referrals",
        patientReferralListDelete: "/patient-referral/delete-referral?referrald=",
        patientReferralReceivingProviderSave: "/patient-referral/saveOrUpdate-external-physician",
        patientReferralReceivingOrganizationSave: "/patient-referral/saveOrUpdate-ReferralOrganization",
        patientReferralProviderLookup: "/patient-referral/external-physician?searchparam=",
        patientReferralOrganizationLookup: "/patient-referral/external-organization?searchparam=",
        patientReferralInsuranceList: "/payer/list",
        patientReferralSent: "/patient-referral/saveOrUpdate",

        //address verfication for zipcode
        patientZipCodeValidator: "/zipcode/",
};

const useApiUtility = () => {
  const handleError = (error, message = "Something went wrong") => {
    console.error(error);
    alert(message); // Replace with toast or error utility
  };

  const getCareGroupAdminCount = useCallback(async (param) => {
    try {
      const res = await axios.post(API_ENDPOINTS.careGroupAdminCount, param);
      return res.data || {};
    } catch (error) {
      handleError(error, "Failed to get admin count.");
      return {};
    }
  }, []);

  const deletePatientEncounterSoapPlanOrders = useCallback(async (param) => {
    try {
      const res = await axios.post(API_ENDPOINTS.patientOrderDelete, param);
      return res.data || {};
    } catch (error) {
      handleError(error, "Failed to delete order.");
      return {};
    }
  }, []);

  const fetchClinicalTestPanelLookup = useCallback(async () => {
    try {
      const res = await axios.get(API_ENDPOINTS.patientOrderClinicalTestPanelLookup);
      return res.data || {};
    } catch (error) {
      handleError(error, "Failed to get clinical test panel.");
      return {};
    }
  }, []);

  const fetchClinicalTestNameLookup = useCallback(async (param) => {
    try {
      const res = await axios.get(`${API_ENDPOINTS.patientOrderClinicalTestPanelLookup}${param}`);
      return res.data || {};
    } catch (error) {
      handleError(error, "Failed to get clinical test name.");
      return {};
    }
  }, []);

  const fetchPatientOrderImagingNameLookup = useCallback(async () => {
    try {
      const res = await axios.get(API_ENDPOINTS.patientOrderImagingNameLookup);
      return res.data || {};
    } catch (error) {
      handleError(error, "Failed to get imaging names.");
      return {};
    }
  }, []);

  const fetchPatientOrderImagingTypeLookup = useCallback(async () => {
    try {
      const res = await axios.get(API_ENDPOINTS.patientOrderImagingNameLookup);
      return res.data || {};
    } catch (error) {
      handleError(error, "Failed to get imaging types.");
      return {};
    }
  }, []);

  const fetchPatientOrderLabPanelLookup = useCallback(async () => {
    try {
      const res = await axios.get(API_ENDPOINTS.patientOrderLabPanelLookup);
      return res.data || {};
    } catch (error) {
      handleError(error, "Failed to get lab panel.");
      return {};
    }
  }, []);

  const fetchPatientOrderLabOrderTestLookup = useCallback(async (param) => {
    try {
      const res = await axios.get(`${API_ENDPOINTS.patientOrderLabOrderTestLookup}${param}`);
      return res.data || {};
    } catch (error) {
      handleError(error, "Failed to get lab order tests.");
      return {};
    }
  }, []);

  const getLifestyleRecommandationsType = useCallback(async () => {
    try {
      const res = await axios.get(API_ENDPOINTS.lifestyleRecommendationsHumCodes);
      return res.data || {};
    } catch (error) {
      handleError(error, "Failed to get lifestyle recommendations.");
      return {};
    }
  }, []);

  const fetchPatientEncounterList = useCallback(async (patientId, encounterId = "") => {
    try {
      const res = await axios.get(`${API_ENDPOINTS.encounterList}?patientId=${patientId}&encounterId=${encounterId}`);
      return res.data || {};
    } catch (error) {
      handleError(error, "Failed to fetch encounter list.");
      return {};
    }
  }, []);

  const getMultipleHumCodesServiceCall = useCallback(async (param) => {
    try {
      const res = await axios.post(API_ENDPOINTS.fetchMultipleHumCodes, param);
      return res.data || {};
    } catch (error) {
      handleError(error, "Failed to fetch multiple hum codes.");
      return {};
    }
  }, []);

  return {
    getCareGroupAdminCount,
    deletePatientEncounterSoapPlanOrders,
    fetchClinicalTestPanelLookup,
    fetchClinicalTestNameLookup,
    fetchPatientOrderImagingNameLookup,
    fetchPatientOrderImagingTypeLookup,
    fetchPatientOrderLabPanelLookup,
    fetchPatientOrderLabOrderTestLookup,
    getLifestyleRecommandationsType,
    fetchPatientEncounterList,
    getMultipleHumCodesServiceCall,
  };
};

export default useApiUtility;