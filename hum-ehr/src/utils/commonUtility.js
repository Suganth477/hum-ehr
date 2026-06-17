import moment from 'moment-timezone';

/**
 * Global Selectors Mapping Context
 * Retained for downstream cross-script reference stability.
 */
export const SELECTORS = {
    applicationInfoCloseIcon: ".app-info-close-icon",
    applicationInfoContainer: "#application_info_container",
    applicationMainHeaderList: "#app_main_header_list",
    applicationMenuListContainer: "#application_menu_list_container",
    applicationMenuList: ".application-menu-list",
    applicationMenuBarIcon: "#application_main_header .application-menu-bar-icon",
    applicationSideNavMenuContainer: "#application_side_navigation_menu_container",
    applicationSideMenuWrapper: "#sidebar_wrapper",
    actionIconDropDownMenuListButton: ".action-group-icon",
    patientChartAddEditCommonXlModal: "#patient_chart_add_edit_common_xl_modal",
    patientChartDocumentViewCommonXlModal: "#patient_chart_document_view_common_xl_modal",
    patientChartAddEditCommonLgModal: "#patient_chart_add_edit_common_lg_modal",
    hsaPatientHealthAssessmentAddEditModal: "#hsa_patient_health_assessment_add_edit_modal",
};

/**
 * Date Time Layout Format Tokens Matrix[cite: 6]
 */
export const dateTimeFormats = {
    DD: "DD",
    YMD_24H: "YYYY-MM-DD HH:mm:ss",
    MDY_24H: "MM-DD-YYYY HH:mm:ss",
    MDY_12H: "MM-DD-YYYY hh:mm A",
    YMD_12H: "YYYY-MM-DD hh:mm A",
    MDY: "MM-DD-YYYY",
    YMD: "YYYY-MM-DD",
    _24H: "HH:mm:ss",
    _12H: "hh:mm A",
    MM_YY: "MMMM YYYY",
    MDYHMS: 'MDYHHmmss',
    MMDDYYYYHHMMSS: 'MMDDYYYYhhmmss',
    MYSQL_YMD_24H: "YYYY-MM-DD HH:mm:ss",
    MYSQL_YMD_12H: "YYYY-MM-DD hh:mm:ss",
    YYYY: "YYYY",
};

/**
 * Calculates human-readable relative time strings from timestamps.
 * @param {string} dateAndTime - Timestamp (MM-DD-YYYY hh:mm A).
 * @returns {string} Relative age description string[cite: 12].
 */
export const getRelativeTime = (dateAndTime) => {
    const now = moment();
    const inputDate = moment(dateAndTime, 'MM-DD-YYYY hh:mm A');

    if (inputDate.isSame(now, 'day')) {
        return 'Today';
    } else if (inputDate.isSame(now.clone().subtract(1, 'days'), 'day')) {
        return 'Yesterday';
    } else if (inputDate.isAfter(now.clone().subtract(1, 'weeks'), 'day')) {
        const daysAgo = now.diff(inputDate, 'days');
        return `${daysAgo} days ago`;
    } else if (inputDate.isAfter(now.clone().subtract(1, 'months'), 'day')) {
        const weeksAgo = now.diff(inputDate, 'weeks');
        return `${weeksAgo} week${weeksAgo > 1 ? 's' : ''} ago`;
    } else if (inputDate.isAfter(now.clone().subtract(1, 'years'), 'day')) {
        const monthsAgo = now.diff(inputDate, 'months');
        return `${monthsAgo} month${monthsAgo > 1 ? 's' : ''} ago`;
    } else {
        const yearsAgo = now.diff(inputDate, 'years');
        return `${yearsAgo} year${yearsAgo > 1 ? 's' : ''} ago`;
    }
};

/**
 * Generates raw HTML action drop-down strings for older grid layout rendering layers[cite: 12].
 * @param {string} element - Target structural component descriptor identifier[cite: 12].
 * @param {string|number} id - Active row data identifier sequence[cite: 12].
 * @param {string} recordType - Active or history view constraint[cite: 12].
 * @returns {string} Plain HTML string template[cite: 12].
 */
export const constructDropDownActionIcons = (element, id, recordType = "active") => {
    return `
    <div class="action-icon-dropdown-group ${recordType === "history" ? 'd-none' : ''}">
        <span class="mdi mdi-dots-vertical action-group-icon" data-bs-toggle="dropdown" data-bs-auto-close="true" aria-expanded="false"></span>
        <ul class="dropdown-menu action-icon-dropdown-menu-list">
            <li class="${element}-edit-details" data-id="${id}">
               <i class="action-icon fa-regular fa-pencil"></i>
                <span class="action-name">Edit</span>
            </li>
            <li class="${element}-delete-details" data-id="${id}">
                <i class="action-icon fa-regular fa-trash"></i>
                <span class="action-name">Delete</span>
            </li>
        </ul>
    </div>
  `;
};

/**
 * Generates fallback trash button layout maps for standalone grid entries[cite: 12].
 */
export const constructDeleteIcons = (element, id, invalidFlag) => {
    return `
    <div>
        <span class="mdi mdi-delete ${element}-delete-details delete-icon ${invalidFlag === "Y" ? 'd-none' : ''} " data-id="${id}" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-original-title="Delete Social History"></span>     
    </div>
  `;
};

/**
 * Decodes Base64 stream data into a browser-accessible object Blob URL[cite: 12].
 */
export const base64ToBlobUrl = (base64Data, contentType) => {
    const base64Prefix = base64Data.split(',')[1] || base64Data;
    const byteCharacters = atob(base64Prefix);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
        byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);
    const blob = new Blob([byteArray], { type: contentType });
    return window.URL.createObjectURL(blob);
};

/**
 * Encodes local system files into base64 strings using a FileReader Promise chain[cite: 12].
 */
export const convertUploadFileInputBase64Format = (fileSelector) => {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(fileSelector);
        reader.onload = () => resolve(reader.result);
        reader.onerror = error => reject(error);
    });
};

/**
 * Normalizes ICD medical code blocks by adding decimal notation segments[cite: 12].
 */
export const getFormmatedIcdCode = (icdCode) => {
    if (!icdCode) return "";
    const sliceIcdCode = icdCode.replace(".", "");
    return sliceIcdCode.length > 3
        ? sliceIcdCode.slice(0, 3) + "." + sliceIcdCode.slice(3)
        : sliceIcdCode;
};

/**
 * Utility method to render a section loader icon string[cite: 12].
 */
export const addSectionLoaderIcon = () => {
    const rootUrl = window.location.origin;
    return `<img src='${rootUrl}/assets/images/hum-images/Loader_Variant3.gif' alt='loader'>`;
};