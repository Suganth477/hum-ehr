const PATIENT_CHART_SELECTORS = {
    patientChartSideMenuList: ".pcm-patient-chart-menu-list-item",
    patientChartTabContent: ".pc-patient-chart-side-menu-tabContent",
}

class PatientChart extends HTMLElement {

    constructor() {
        // Always call super() first in the constructor.
        // This will call the extended class constructor.
        super();

        // patient id
        this.patientId = $(this).attr("patient-id") || null;

        // list of selectors used in this code
        this.selectorElements = {
            patientChartModalCommonClass: ".patient-chart-modal"
        }
    }

    /**
     * Call back function triggered when we append the custom element to the DOM.
     * Initialize the validation rules for add and update threshold setup
     */
    connectedCallback() {
        try {
            this.bindAllRequiredEvents();
            this.appendPatientChartElements();
        } catch (error) {
            utility.exceptionMailAPICall(error.stack);
        }
    }

    /**
     * function to append patient chart html elements into 
     * the patient chart main custom element
     */
    appendPatientChartElements () {
        $(this).append(`
            <div class="container-fluid p-0 h-100">
                ${this.createPatientDemographicsCustomElement()}
                <div class="pc-patient-chart-body-container container-fluid p-0">
                   ${this.createPatientChartSideMenuCustomElement()}
                    <div class="pc-patient-chart-side-menu-contents">
                        <div class="tab-content pc-patient-chart-side-menu-tabContent">
                            ${this.createPatientChartSideMenuTabContents()}
                        </div>
                    </div>
                </div>
            </div>
        `)
    }

    /**
     * function to create patient demographic custom element
     * @returns 
     */
    createPatientDemographicsCustomElement () {
        return `
            <div class="pc-patient-demographics-container col-md-12">
                <pc-patient-demographics patient-id="${this.patientId}"></pc-patient-demographics>
            </div>
        `;
    }

    /**
     * function to create patient chart side menu custom element
     * @returns 
     */
    createPatientChartSideMenuCustomElement () {
        return `<div class="pc-patient-chart-side-menu">
            <pc-patient-chart-side-menu patient-id="${this.patientId}"></pc-patient-chart-side-menu>
        </div>`;
    }

    /**
     * function to create patient chart side menu tab contents
     * @returns 
     */
    createPatientChartSideMenuTabContents () {
        return `<div class="tab-pane fade show active" id="${this.patientId}_pc_patient_summary" 
            role="tabpanel" aria-labelledby="${this.patientId}_pc_patient_summary_tab">Summary
        </div>`;
}

    /**
     * function to bind the events. the events will be trigger
     * while user make any action in the buttons or icons
     */
    bindAllRequiredEvents () {
        $(this).on('hidden.bs.modal', this.selectorElements.patientChartModalCommonClass, this.emptyModalContentOnCloseThePatientChartModal);
    }

    /**
     * function to empty the modal contents while close the
     * patient chart bootstrap modal
     */
    emptyModalContentOnCloseThePatientChartModal () {
        $(this).find(".modal-body").empty();
    }
}

class PatientDemographics extends HTMLElement {

    constructor() {
        // Always call super() first in the constructor.
        // This will call the extended class constructor.
        super();

        // patient id
        this.patientId = $(this).attr("patient-id") || null;
    }

    /**
     * Call back function triggered when we append the custom element to the DOM.
     * Initialize the validation rules for add and update threshold setup
     */
    connectedCallback() {
        try {
            this.fetchPatientDetails();
            this.bindEventhandlers();
        } catch (error) {
            utility.exceptionMailAPICall(error.stack);
        }
    }

    /**
     * bind event handlers for the custom element
     */
    bindEventhandlers(){
        $(this)
            .on("PatientDemographicsCommonInformation:refreshPatientDemographicsCommonInformation", this.appendPatientDemographicElements);
    }

    /**
     * fetch patient details api
     */
    fetchPatientDetails () {
        apiUtility.fetchPatientDetails({patientId: this.patientId}).then((response) => {
            if (response.status === 'success') {
                $("pc-patient-demographics").data(`${this.patientId}PatientDetails`, response.data.patientDetails);
                $("pc-patient-demographics").data(`${this.patientId}PatientSubscribedProduct`, response.data.subscribedProducts);
                this.appendPatientDemographicElements();
            }
        }).catch((error) => {
            console.log(error);
            utility.failureMessage("Failed to fetch patient details. Please try again.");
        });
    }

    /**
     * check patient data otherwise get the patient details using API
     * @param {*} patientId 
     * @returns 
     */
    static async checkPatientDetailsIsStoredAndGetData(patientId){
        const patientDetails = $(`pc-patient-demographics[patient-id="${patientId}"]`).data(`${patientId}PatientDetails`);
        return patientDetails || await PatientDemographics.fetchPatientDetails(patientId);
    }

    /**
     * get patient details
     * @param {*} patientId 
     * @returns 
     */
    static fetchPatientDetails(patientId){
        return apiUtility.fetchPatientDetails({patientId}).then((response) => {
            if (response.status === 'success') {
                $("pc-patient-demographics").data(`${patientId}PatientDetails`, response.data.patientDetails);
                return response.data.patientDetails;
            }
        }).catch((error) => {
            console.log(error);
            utility.failureMessage("Failed to fetch patient details. Please try again.");
        });
    }

    /**
     * append patient demographic details html elements 
     * into the custom element
     * @param {*} patientDetails 
     */
    appendPatientDemographicElements () {
        const patientDetails = $(`pc-patient-demographics`).data(`${this.patientId}PatientDetails`);
        const {patientName, emrId, genderDesc, dateOfBirth, gender, email, addressLineOne, addressLineTwo, city, state, zipCode} = patientDetails;
        $(this).html(`
            <div class="pd-patient-demographics-main-container">
                <div class="pd-patient-profile-picture">
                    <img class="pd-patient-image profile-image" src="${url}/assets/images/hum-images/doctor.jpeg">
                </div>
                <div class="pd-patient-demographics-details">
                    <div class="pd-patient-demographics-list">
                        <div class="pd-patient-demographics-list-item">
                            <span class="pd-patient-demographics-icon"></span>
                            <span class="pd-patient-demographics-data text-capitalize patient-name">${patientName}</span>
                        </div>
                         <div class="pd-patient-demographics-list-item">
                            <span class="pd-patient-demographics-icon mdi mdi-calendar-month-outline"></span>
                            <span class="pd-patient-demographics-data">${dateOfBirth} (${utility.ageCalculator(dateOfBirth)}yrs)</span>
                        </div>
                         <div class="pd-patient-demographics-list-item">
                            <span class="pd-patient-demographics-icon mdi mdi-gender-${utility.getGenderIconBasedOnGenderCode(gender)}"></span>
                            <span class="pd-patient-demographics-data">${genderDesc}</span>
                        </div>
                        <div class="pd-patient-demographics-list-item">
                            <span class="pd-patient-demographics-icon"></span>
                            <span class="pd-patient-demographics-data">${emrId}</span>
                        </div>
                        ${this.getPatientPhoneNumber(patientDetails)}
                        <div class="pd-patient-demographics-list-item">
                            <span class="pd-patient-demographics-icon mdi mdi-email-outline"></span>
                            <span class="pd-patient-demographics-data">${email || ""}</span>
                        </div>
                        <div class="pd-patient-demographics-list-item">
                            <span class="pd-patient-demographics-icon mdi mdi-home-outline"></span>
                            <span class="pd-patient-demographics-data">${utility.displayAddressInUSFormat(addressLineOne, addressLineTwo, city, state, zipCode)}</span>
                        </div>
                        <div class="pd-patient-demographics-list-item">
                            <span class="pd-patient-demographics-icon"></span>
                            <span class="pd-patient-demographics-data">Last Encounter</span>
                        </div>
                        <div class="pd-patient-demographics-list-item d-none">
                            <span class="pd-patient-demographics-icon"></span>
                            <span class="pd-patient-demographics-data">Allergies</span>
                        </div>
                        <div class="pd-patient-demographics-list-item d-none">
                            <span class="pd-patient-demographics-icon"></span>
                            <span class="pd-patient-demographics-data">CDS</span>
                        </div>
                        <div class="pd-patient-demographics-list-item d-none">
                            <span class="pd-patient-demographics-icon"></span>
                            <span class="pd-patient-demographics-data"></span>
                        </div>
                    </div>
                    ${this.createPatientDemographicDetailsActionIconDropdown()}
                </div>
            </div>
        `)
    }

    /**
     * function to create patient demographic details
     * action icon dropdown list
     * @returns 
     */
    createPatientDemographicDetailsActionIconDropdown () {
        return `
            <div class="pd-patient-demographics-icons">
                <span class="mdi mdi-dots-vertical action-group-icon" data-bs-toggle="dropdown" data-bs-auto-close="true" aria-expanded="false"></span>
                <ul class="dropdown-menu" aria-labelledby="defaultDropdown">
                    <li><a class="dropdown-item" href="#">Menu item</a></li>
                    <li><a class="dropdown-item" href="#">Menu item</a></li>
                    <li><a class="dropdown-item" href="#">Menu item</a></li>
                </ul>
            </div>`;
    }

    /**
     * get the patient phone number details
     * @param {*} patientInfo 
     * @returns 
     */
    getPatientPhoneNumber (patientInfo) {
        const {mobilePhoneNumber, homePhoneNumber, workPhoneNumber} = patientInfo;

        let patientPhoneNumberElement = "";

        if (mobilePhoneNumber) {
            patientPhoneNumberElement = `
                <div class="pd-patient-demographics-list-item">
                    <span class="pd-patient-demographics-icon mdi mdi-phone-outline"></span>
                    <span class="pd-patient-demographics-data">${mobilePhoneNumber}</span>
                </div>`;
        }

        if (homePhoneNumber) {
            patientPhoneNumberElement = `
                <div class="pd-patient-demographics-list-item">
                    <span class="pd-patient-demographics-icon mdi mdi-phone-outline"></span>
                    <span class="pd-patient-demographics-data">${homePhoneNumber}</span>
                </div>`;
        }

        if (workPhoneNumber) {
            patientPhoneNumberElement = `
                <div class="pd-patient-demographics-list-item">
                    <span class="pd-patient-demographics-icon mdi mdi-phone-outline"></span>
                    <span class="pd-patient-demographics-data">${workPhoneNumber}</span>
                </div>`;
        }
        return patientPhoneNumberElement;
    }
}

class PatientChartSideMenu extends HTMLElement {

    constructor() {
        // Always call super() first in the constructor.
        // This will call the extended class constructor.
        super();

        // patient id
        this.patientId = $(this).attr("patient-id") || null;
        this.patientChartElement = `patient-chart[patient-id="${this.patientId}"]`;
    }

    /**
     * Call back function triggered when we append the custom element to the DOM.
     * Initialize the validation rules for add and update threshold setup
     */
    connectedCallback() {
        try {
            this.constructPatientChartSideNavigationMenu();
            this.bindAllRequiredEvents();
            this.displayRecentlySelectedMenu();
        } catch (error) {
            utility.exceptionMailAPICall(error.stack);
        }
    }

    /**
     * function to display the recently selected menu content
     * while refresh the screen
     */
    displayRecentlySelectedMenu () {
        if (sessionStorage.getItem("patientChartInformation")) {
            let patientChartInfoObject = JSON.parse(sessionStorage.getItem("patientChartInformation"));
            const recentSelectedMenuCode = patientChartInfoObject[`${this.patientId}_patient_details`]["selectedMenuCode"];
            recentSelectedMenuCode ? $(this).find(`${PATIENT_CHART_SELECTORS.patientChartSideMenuList}[data-section-code="${recentSelectedMenuCode}"]`).trigger("click") : '';
        }
    }

    /**
     * function to bind the events. the events will be trigger
     * while user make any action in the buttons or icons
     */
    bindAllRequiredEvents () {
        $(this)
            .on("click", PATIENT_CHART_SELECTORS.patientChartSideMenuList, {classObject: this}, this.appendPatientChartSectionElement)
    }

    /**
     * function to insert the menu tab content on
     * click the side navigation menu
     * @param {*} event 
     */
    appendPatientChartSectionElement (event) {
        const classObject = event.data.classObject;
        const tabContentSelector = $(PATIENT_CHART_SELECTORS.patientChartTabContent);
        const currentSectionId = $(this).attr("data-id");
        const patientId = classObject.patientId;
        const sectionCode = $(this).attr("data-section-code");

        $(this).closest(".pcm-patient-chart-menu-list").find(".pcm-nav-link").removeClass("active");
        $(this).find(".pcm-nav-link").addClass("active");

        switch (currentSectionId) {
            case `${classObject.patientId}_pc_patient_summary`:
                $(classObject.patientChartElement).find(tabContentSelector).html(`
                    <div class="tab-pane fade show active" id="${patientId}_pc_patient_summary" role="tabpanel" aria-labelledby="${patientId}_pc_patient_summary_tab">
                        Summary
                    </div>
                `);
                break;
            case `${classObject.patientId}_pc_patient_profile`:
                $(classObject.patientChartElement).find(tabContentSelector).html(`
                    <div class="tab-pane fade show active" id="${patientId}_pc_patient_profile" role="tabpanel" aria-labelledby="${patientId}_pc_patient_profile_tab">
                        <patient-chart-patient-profile patient-id="${patientId}"></patient-chart-patient-profile>
                    </div>
                `);
                break;
            case `${classObject.patientId}_pc_patient_appointments`:
                $(classObject.patientChartElement).find(tabContentSelector).html(`
                    <div class="tab-pane fade show active" id="${patientId}_pc_patient_appointments" role="tabpanel" aria-labelledby="${patientId}_pc_patient_appointments_tab">
                        Appointment
                    </div>
                `);
                break;
            case `${classObject.patientId}_pc_patient_allergies`:
                $(classObject.patientChartElement).find(tabContentSelector).html(`
                    <div class="tab-pane fade show active" id="${patientId}_pc_patient_allergies" role="tabpanel" aria-labelledby="${patientId}_pc_patient_allergies_tab">
                        <patient-allergies patient-id="${patientId}" record-type="active"></patient-allergies>
                    </div>`);
                break;
            case `${classObject.patientId}_pc_patient_problems`:
                $(classObject.patientChartElement).find(tabContentSelector).html(`
                    <div class="tab-pane fade show active" id="${patientId}_pc_patient_problems" role="tabpanel" aria-labelledby="${patientId}_pc_patient_problems_tab">
                        <patient-problems patient-id="${patientId}" record-type="active"></patient-problems>
                    </div>`);
                break;
            case `${classObject.patientId}_pc_patient_encounters`:
                $(classObject.patientChartElement).find(tabContentSelector).html(`
                    <div class="tab-pane fade show active" id="${patientId}_pc_patient_encounters" role="tabpanel" aria-labelledby="${patientId}_pc_patient_encounters_tab">
                        <patient-encounter patient-id="${patientId}" record-type="active"></patient-encounter>
                    </div>`);
                break;
            case `${classObject.patientId}_pc_patient_medications` :
                $(classObject.patientChartElement).find(tabContentSelector).html(`
                    <div class="tab-pane fade show active" id="${patientId}_pc_patient_medications" role="tabpanel" aria-labelledby="${patientId}_pc_patient_medications_tab">
                        <patient-ehr-eprescription patient-id="${patientId}" show-list="Y"></patient-ehr-eprescription>
                    </div>`);
                break;
			case `${classObject.patientId}_pc_patient_lab`:
				$(classObject.patientChartElement).find(tabContentSelector).html(`
                    <div class="tab-pane fade show active" id="${patientId}_pc_patient_lab" role="tabpanel" aria-labelledby="${patientId}_pc_patient_lab">
						<patient-lab-reports patient-id="${patientId}" record-type="active"></patient-lab-reports>
                    </div>`);
                break;
			case `${classObject.patientId}_pc_patient_hsa`:
				$(classObject.patientChartElement).find(tabContentSelector).html(`
                    <div class="tab-pane fade show active" id="${patientId}_pc_patient_hsa" role="tabpanel" aria-labelledby="${patientId}_pc_patient_hsa">
						<patient-health-status-assessment patient-id="${patientId}"></patient-health-status-assessment>
                    </div>`);
                break;
			case `${classObject.patientId}_pc_patient_implant_device`:
				$(classObject.patientChartElement).find(tabContentSelector).html(`
                    <div class="tab-pane fade show active" id="${patientId}_pc_patient_implant_device" role="tabpanel" aria-labelledby="${patientId}_pc_patient_implant_device">
						<patient-implantable-device patient-id="${patientId}"></patient-implantable-device>
                    </div>`);
                break;
            case `${classObject.patientId}_pc_patient_immunization`:
                $(classObject.patientChartElement).find(tabContentSelector).html(`
                    <div class="tab-pane fade show active" id="${patientId}_pc_patient_immunization" role="tabpanel" aria-labelledby="${patientId}_pc_patient_immunization">
                        <patient-immunization patient-id="${patientId}"></patient-immunization>
                    </div>`);
                break;
            case `${classObject.patientId}_pc_patient_pfsh`:
	            $(classObject.patientChartElement).find(tabContentSelector).html(`
	                <div class="tab-pane fade show active" id="${patientId}_pc_patient_pfsh" role="tabpanel" aria-labelledby="${patientId}_pc_patient_pfsh">
                        <patient-pfsh patient-id="${patientId}"></patient-pfsh>
	                </div>`);
                    break;
            case `${classObject.patientId}_pc_patient_documents`:
                $(classObject.patientChartElement).find(tabContentSelector).html(`
                    <div class="tab-pane fade show active" id="${patientId}_pc_patient_documents" role="tabpanel" aria-labelledby="${patientId}_pc_patient_documents">
                        <patient-ehr-documents patient-id="${patientId}"></patient-ehr-documents>
                    </div>`);
                break;

        }
        classObject.handlePatientChartLocalStorageInformation(patientId, sectionCode);
    }

    /**
     * update the patient chart local storage information
     * while clicking the side navigation menu
     * @param {*} patientId 
     * @param {*} sectionCode 
     */
    handlePatientChartLocalStorageInformation (patientId, sectionCode) {
        if (sessionStorage.getItem("patientChartInformation")) {
            let patientChartInfoObject = JSON.parse(sessionStorage.getItem("patientChartInformation"));
            patientChartInfoObject[`${patientId}_patient_details`]["selectedMenuCode"] = sectionCode;
            sessionStorage.setItem("patientChartInformation", JSON.stringify(patientChartInfoObject))
        }
    }

    /**
     * function to create the patient chart side 
     * navigation menu with icons
     */
    constructPatientChartSideNavigationMenu () {
        $(this).html(`
            <ul class="pcm-patient-chart-menu-list custom-scrollbar" role="tablist">
                <li class="pcm-patient-chart-menu-list-item nav-item" role="presentation" data-section-code="PCSUM" data-id="${this.patientId}_pc_patient_summary">
                    <button class="nav-link pcm-nav-link active" id="${this.patientId}_pc_patient_summary_tab" data-bs-toggle="pill" data-bs-target="#${this.patientId}_pc_patient_summary" type="button" role="tab" aria-controls="${this.patientId}_pc_patient_summary" aria-selected="true">
                        <span class="pcm-patient-chart-menu-icon mdi mdi-view-dashboard"></span>
                        <span class="pcm-patient-chart-menu-desc text-center">Summary</span>
                    </button>
                </li>
                <li class="pcm-patient-chart-menu-list-item nav-item" role="presentation" data-section-code="PCPP" data-id="${this.patientId}_pc_patient_profile">
                    <button class="nav-link pcm-nav-link" id="${this.patientId}_pc_patient_profile_tab" data-bs-toggle="pill" data-bs-target="#${this.patientId}_pc_patient_profile" type="button" role="tab" aria-controls="${this.patientId}_pc_patient_profile" aria-selected="true">
                        <i class="pcm-patient-chart-menu-icon fa-regular fa-id-card"></i>
                        <span class="pcm-patient-chart-menu-desc text-center">Patient<br>Profile</span>
                    </button>
                </li>
                <li class="pcm-patient-chart-menu-list-item nav-item" role="presentation" data-section-code="PCAPP" data-id="${this.patientId}_pc_patient_appointments">
                    <button class="nav-link pcm-nav-link" id="${this.patientId}_pc_patient_appointments_tab" data-bs-toggle="pill" data-bs-target="#${this.patientId}_pc_patient_appointments" type="button" role="tab" aria-controls="${this.patientId}_pc_patient_appointments" aria-selected="false">
                        <span class="pcm-patient-chart-menu-icon mdi mdi-calendar-account-outline"></span>
                        <span class="pcm-patient-chart-menu-desc text-center">Appointments</span>
                    </button>
                </li>
                <li class="pcm-patient-chart-menu-list-item nav-item" role="presentation" data-section-code="PCALL" data-id="${this.patientId}_pc_patient_allergies">
                    <button class="nav-link pcm-nav-link" id="${this.patientId}_pc_patient_allergies_tab" data-bs-toggle="pill" data-bs-target="#${this.patientId}_pc_patient_allergies" type="button" role="tab" aria-controls="${this.patientId}_pc_patient_allergies" aria-selected="false">
                        <span class="pcm-patient-chart-menu-icon mdi mdi-allergy"></span>
                        <span class="pcm-patient-chart-menu-desc text-center">Allergies</span>
                    </button>
                </li>
                <li class="pcm-patient-chart-menu-list-item nav-item" role="presentation" data-section-code="PCPRO" data-id="${this.patientId}_pc_patient_problems">
                    <button class="nav-link pcm-nav-link" id="${this.patientId}_pc_patient_problems_tab" data-bs-toggle="pill" data-bs-target="#${this.patientId}_pc_patient_problems" type="button" role="tab" aria-controls="${this.patientId}_pc_patient_problems" aria-selected="false">
                        <span class="pcm-patient-chart-menu-icon mdi mdi-emoticon-sick-outline"></span>
                        <span class="pcm-patient-chart-menu-desc text-center">Problems</span>
                    </button>
                </li>
                <li class="pcm-patient-chart-menu-list-item nav-item" role="presentation" data-section-code="PCENC" data-id="${this.patientId}_pc_patient_encounters">
                    <button class="nav-link pcm-nav-link" id="${this.patientId}_pc_patient_encounters_tab" data-bs-toggle="pill" data-bs-target="#${this.patientId}_pc_patient_encounters" type="button" role="tab" aria-controls="${this.patientId}_pc_patient_encounters" aria-selected="false">
                        <span class="pcm-patient-chart-menu-icon mdi mdi-counter"></span>
                        <span class="pcm-patient-chart-menu-desc text-center">Encounters</span>
                    </button>
                </li>
                <li class="pcm-patient-chart-menu-list-item nav-item" role="presentation" data-section-code="PCMED" data-id="${this.patientId}_pc_patient_medications">
                    <button class="nav-link pcm-nav-link" id="${this.patientId}_pc_patient_medications_tab" data-bs-toggle="pill" data-bs-target="#${this.patientId}_pc_medications_allergies" type="button" role="tab" aria-controls="${this.patientId}_pc_medications_allergies" aria-selected="false">
                        <span class="pcm-patient-chart-menu-icon mdi mdi-pill-multiple"></span>
                        <span class="pcm-patient-chart-menu-desc text-center">Medications</span>
                    </button>
                </li>
                <li class="pcm-patient-chart-menu-list-item nav-item" role="presentation" data-section-code="PCIMP" data-id="${this.patientId}_pc_patient_implant_device">
                    <button class="nav-link pcm-nav-link" id="${this.patientId}_pc_patient_implant_device_tab" data-bs-toggle="pill" data-bs-target="#${this.patientId}_pc_patient_implant_device" type="button" role="tab" aria-controls="${this.patientId}_pc_patient_implant_device_tab" aria-selected="false">
                        <span class="pcm-patient-chart-menu-icon mdi mdi-devices"></span>
                        <span class="pcm-patient-chart-menu-desc text-center text-wrap">Implantable Devices</span>
                    </button>
                </li>
                <li class="pcm-patient-chart-menu-list-item nav-item" role="presentation" data-section-code="PCVIT" data-id="${this.patientId}_pc_patient_vitals">
                    <button class="nav-link pcm-nav-link" id="${this.patientId}_pc_patient_vitals_tab" data-bs-toggle="pill" data-bs-target="#${this.patientId}_pc_patient_vitals" type="button" role="tab" aria-controls="${this.patientId}_pc_patient_vitals" aria-selected="false">
                        <span class="pcm-patient-chart-menu-icon mdi mdi-heart-pulse"></span>
                        <span class="pcm-patient-chart-menu-desc text-center">Vitals</span>
                    </button>
                </li>
                <li class="pcm-patient-chart-menu-list-item nav-item" role="presentation" data-section-code="PCIMM" data-id="${this.patientId}_pc_patient_immunization">
                    <button class="nav-link pcm-nav-link" id="${this.patientId}_pc_patient_immunization_tab" data-bs-toggle="pill" data-bs-target="#${this.patientId}_pc_patient_immunization" type="button" role="tab" aria-controls="${this.patientId}_pc_patient_immunization" aria-selected="false">
                        <span class="pcm-patient-chart-menu-icon mdi mdi-needle"></span>
                        <span class="pcm-patient-chart-menu-desc text-center">Immunization</span>
                    </button>
                </li>
                <li class="pcm-patient-chart-menu-list-item nav-item" role="presentation" data-section-code="PCLAB" data-id="${this.patientId}_pc_patient_lab">
                    <button class="nav-link pcm-nav-link" id="${this.patientId}_pc_patient_lab_tab" data-bs-toggle="pill" data-bs-target="#${this.patientId}_pc_patient_lab" type="button" role="tab" aria-controls="${this.patientId}_pc_patient_lab" aria-selected="false">
                        <span class="pcm-patient-chart-menu-icon mdi mdi-cart-plus"></span>
                        <span class="pcm-patient-chart-menu-desc text-center text-wrap">Lab Orders</span>
                    </button>
                </li>
                <li class="pcm-patient-chart-menu-list-item nav-item" role="presentation" data-section-code="PCVIS" data-id="${this.patientId}_pc_patient_visits">
                    <button class="nav-link pcm-nav-link" id="${this.patientId}_pc_patient_visits_tab" data-bs-toggle="pill" data-bs-target="#${this.patientId}_pc_patient_visits" type="button" role="tab" aria-controls="${this.patientId}_pc_patient_visits" aria-selected="false">
                        <span class="pcm-patient-chart-menu-icon mdi mdi-walk"></span>
                        <span class="pcm-patient-chart-menu-desc text-center">Visits</span>
                    </button>
                </li>
                <li class="pcm-patient-chart-menu-list-item nav-item" role="presentation" data-section-code="PCPFS" data-id="${this.patientId}_pc_patient_pfsh">
                    <button class="nav-link pcm-nav-link" id="${this.patientId}_pc_patient_pfsh_tab" data-bs-toggle="pill" data-bs-target="#${this.patientId}_pc_patient_pfsh" type="button" role="tab" aria-controls="${this.patientId}_pc_patient_pfsh" aria-selected="false">
                        <span class="pcm-patient-chart-menu-icon mdi mdi-history"></span>
                        <span class="pcm-patient-chart-menu-desc text-center">PFSH</span>
                    </button>
                </li>
                <li class="pcm-patient-chart-menu-list-item nav-item" role="presentation" data-section-code="PCHSA" data-id="${this.patientId}_pc_patient_hsa">
                    <button class="nav-link pcm-nav-link" id="${this.patientId}_pc_patient_hsa_tab" data-bs-toggle="pill" data-bs-target="#${this.patientId}_pc_patient_hsa" type="button" role="tab" aria-controls="${this.patientId}_pc_patient_hsa" aria-selected="false">
                        <span class="pcm-patient-chart-menu-icon mdi mdi-note-check-outline"></span>
                        <span class="pcm-patient-chart-menu-desc text-center text-wrap">Health Status Assessment</span>
                    </button>
                </li>
                <li class="pcm-patient-chart-menu-list-item nav-item" role="presentation" data-section-code="PCDOC" data-id="${this.patientId}_pc_patient_documents">
                    <button class="nav-link pcm-nav-link" id="${this.patientId}_pc_patient_documents_tab" data-bs-toggle="pill" data-bs-target="#${this.patientId}_pc_patient_documents" type="button" role="tab" aria-controls="${this.patientId}_pc_patient_documents" aria-selected="false">
                        <span class="pcm-patient-chart-menu-icon mdi mdi-file-document-multiple-outline"></span>
                        <span class="pcm-patient-chart-menu-desc text-center text-wrap">Documents</span>
                    </button>
                </li>
            </ul>
        `);
    }
}

customElements.define("patient-chart", PatientChart);
customElements.define("pc-patient-demographics", PatientDemographics);
customElements.define("pc-patient-chart-side-menu", PatientChartSideMenu);