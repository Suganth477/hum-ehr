import moment from 'moment-timezone';
/** Global selector strings retained for cross-script reference stability. */
export const SELECTORS = {
    applicationInfoCloseIcon: '.app-info-close-icon',
    applicationInfoContainer: '#application_info_container',
    applicationMainHeaderList: '#app_main_header_list',
    applicationMenuListContainer: '#application_menu_list_container',
    applicationMenuList: '.application-menu-list',
    applicationMenuBarIcon: '#application_main_header .application-menu-bar-icon',
    applicationSideNavMenuContainer: '#application_side_navigation_menu_container',
    applicationSideMenuWrapper: '#sidebar_wrapper',
    actionIconDropDownMenuListButton: '.action-group-icon',
    patientChartAddEditCommonXlModal: '#patient_chart_add_edit_common_xl_modal',
    patientChartDocumentViewCommonXlModal: '#patient_chart_document_view_common_xl_modal',
    patientChartAddEditCommonLgModal: '#patient_chart_add_edit_common_lg_modal',
    hsaPatientHealthAssessmentAddEditModal: '#hsa_patient_health_assessment_add_edit_modal',
};
/** Date/time layout format tokens. */
export const dateTimeFormats = {
    DD: 'DD',
    YMD_24H: 'YYYY-MM-DD HH:mm:ss',
    MDY_24H: 'MM-DD-YYYY HH:mm:ss',
    MDY_12H: 'MM-DD-YYYY hh:mm A',
    YMD_12H: 'YYYY-MM-DD hh:mm A',
    MDY: 'MM-DD-YYYY',
    YMD: 'YYYY-MM-DD',
    _24H: 'HH:mm:ss',
    _12H: 'hh:mm A',
    MM_YY: 'MMMM YYYY',
    MDYHMS: 'MDYHHmmss',
    MMDDYYYYHHMMSS: 'MMDDYYYYhhmmss',
    MYSQL_YMD_24H: 'YYYY-MM-DD HH:mm:ss',
    MYSQL_YMD_12H: 'YYYY-MM-DD hh:mm:ss',
    YYYY: 'YYYY',
};
/** Human-readable relative time from a "MM-DD-YYYY hh:mm A" timestamp. */
export const getRelativeTime = (dateAndTime) => {
    const now = moment();
    const inputDate = moment(dateAndTime, 'MM-DD-YYYY hh:mm A');
    if (inputDate.isSame(now, 'day'))
        return 'Today';
    if (inputDate.isSame(now.clone().subtract(1, 'days'), 'day'))
        return 'Yesterday';
    if (inputDate.isAfter(now.clone().subtract(1, 'weeks'), 'day')) {
        return `${now.diff(inputDate, 'days')} days ago`;
    }
    if (inputDate.isAfter(now.clone().subtract(1, 'months'), 'day')) {
        const weeksAgo = now.diff(inputDate, 'weeks');
        return `${weeksAgo} week${weeksAgo > 1 ? 's' : ''} ago`;
    }
    if (inputDate.isAfter(now.clone().subtract(1, 'years'), 'day')) {
        const monthsAgo = now.diff(inputDate, 'months');
        return `${monthsAgo} month${monthsAgo > 1 ? 's' : ''} ago`;
    }
    const yearsAgo = now.diff(inputDate, 'years');
    return `${yearsAgo} year${yearsAgo > 1 ? 's' : ''} ago`;
};
export const constructDropDownActionIcons = (element, id, recordType = 'active') => `
    <div class="action-icon-dropdown-group ${recordType === 'history' ? 'd-none' : ''}">
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
export const constructDeleteIcons = (element, id, invalidFlag) => `
    <div>
        <span class="mdi mdi-delete ${element}-delete-details delete-icon ${invalidFlag === 'Y' ? 'd-none' : ''} " data-id="${id}" data-bs-toggle="tooltip" data-bs-placement="top" data-bs-original-title="Delete Social History"></span>
    </div>
  `;
/** Decodes a Base64 string into an object URL. */
export const base64ToBlobUrl = (base64Data, contentType) => {
    const base64 = base64Data.split(',')[1] || base64Data;
    const byteChars = atob(base64);
    const byteNumbers = new Array(byteChars.length);
    for (let i = 0; i < byteChars.length; i += 1)
        byteNumbers[i] = byteChars.charCodeAt(i);
    const blob = new Blob([new Uint8Array(byteNumbers)], { type: contentType });
    return window.URL.createObjectURL(blob);
};
/** Reads a File into a base64 data URL. */
export const convertUploadFileInputBase64Format = (file) => new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result);
    reader.onerror = (error) => reject(error);
});
/** Inserts the decimal point into an ICD code. */
export const getFormattedIcdCode = (icdCode) => {
    if (!icdCode)
        return '';
    const sliced = icdCode.replace('.', '');
    return sliced.length > 3 ? `${sliced.slice(0, 3)}.${sliced.slice(3)}` : sliced;
};
export const addSectionLoaderIcon = () => `<img src='${window.location.origin}/assets/images/hum-images/Loader_Variant3.gif' alt='loader'>`;
