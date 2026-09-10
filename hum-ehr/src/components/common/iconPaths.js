/**
 * Exact icon path data + resolver (no components — see CustomIcons.jsx for those).
 *
 * Maps each original FontAwesome/MDI class the app used to its ORIGINAL vector
 * path, so the migration preserves iconography 1:1 without shipping icon fonts:
 *   - Material Design -> `@mdi/js` path constants
 *   - FontAwesome     -> `@fortawesome/free-*-svg-icons` path data
 * (path-data only, tree-shakeable).
 */
import {
    mdiAccount, mdiAccountArrowRightOutline, mdiAccountDetailsOutline, mdiAccountGroupOutline,
    mdiAccountMultipleOutline, mdiAccountPlus, mdiAccountQuestionOutline, mdiAllergy,
    mdiApplicationCogOutline, mdiArrowLeft, mdiBellOutline, mdiBriefcaseOutline, mdiBullseye,
    mdiCalendarAccountOutline, mdiCalendarMonthOutline, mdiCalendarPlusOutline, mdiCartPlus,
    mdiChartMultiple, mdiCheck, mdiChevronDown, mdiChevronRight, mdiChevronUp, mdiCircle,
    mdiClipboardTextPlayOutline, mdiClose, mdiCloseCircleOutline, mdiCogOutline, mdiCounter,
    mdiCurrencyUsd, mdiDelete, mdiDevices, mdiDotsVertical, mdiDownload, mdiEmail, mdiEmailOutline,
    mdiEmoticonSickOutline, mdiEye, mdiEyeOff, mdiFileChartOutline, mdiFileDocumentMultipleOutline,
    mdiFileDocumentOutline, mdiFileDownloadOutline, mdiFileSign, mdiFilmstrip, mdiFilterVariant,
    mdiFoodAppleOutline, mdiGenderFemale, mdiGenderMale, mdiHeartCog, mdiHeartPulse,
    mdiHelpCircleOutline, mdiHomeOutline, mdiHospitalBuilding, mdiHumanMaleHeight, mdiIdCard,
    mdiImageOutline, mdiInformationOutline, mdiListBoxOutline, mdiLock, mdiLogout, mdiMagnify,
    mdiMenuClose, mdiMenuOpen, mdiMenuRight, mdiMessageTextOutline, mdiMicrophone, mdiMicrophoneOutline,
    mdiNeedle, mdiNoteCheckOutline, mdiPaperclip, mdiPencil, mdiPencilOutline, mdiPhoneOff, mdiPhoneOutline,
    mdiPillMultiple, mdiPlayCircleOutline, mdiPlus, mdiPower, mdiReload, mdiUpload, mdiVideoOutline,
    mdiViewDashboard, mdiWalk,
} from '@mdi/js';
import {
    faBedPulse, faPrescriptionBottleMedical, faBuilding, faPaw, faBowlFood, faNotesMedical,
    faPersonWalkingArrowLoopLeft, faAddressCard, faArrowRight, faBan, faBook, faCircleExclamation,
    faCircleInfo, faCloudArrowUp, faEllipsis, faEnvelope, faTriangleExclamation, faFilter,
    faHandDots, faHouse, faMagnifyingGlass, faMessage, faPen, faPencil, faPeopleArrows, faPhone,
    faCircleQuestion, faRotate, faXmark, faTrash, faTrashCan, faUser, faReply, faBoxArchive,
    faAngleLeft, faAngleRight, faHospital, faUserPlus, faArrowLeft, faCircle, faPaperclip,
    faShareNodes, faFileImport, faFileExport, faPaperPlane, faFileCircleCheck, faCircleDown,
    faUserSlash, faArrowUpRightFromSquare, faWandMagicSparkles,
} from '@fortawesome/free-solid-svg-icons';
import {
    faFilePowerpoint, faFileCode, faFileZipper, faFilePdf, faFileWord, faFileExcel, faFileImage,
    faFileLines, faFile, faEye as faEyeRegular, faCalendarPlus as faCalendarPlusRegular,
} from '@fortawesome/free-regular-svg-icons';

// Original class -> Material Design path (24x24 viewBox).
const MDI_PATHS = {
    'mdi-account': mdiAccount, 'mdi-account-arrow-right-outline': mdiAccountArrowRightOutline,
    'mdi-account-details-outline': mdiAccountDetailsOutline, 'mdi-account-group-outline': mdiAccountGroupOutline,
    'mdi-account-multiple-outline': mdiAccountMultipleOutline, 'mdi-account-plus': mdiAccountPlus,
    'mdi-account-question-outline': mdiAccountQuestionOutline, 'mdi-allergy': mdiAllergy,
    'mdi-application-cog-outline': mdiApplicationCogOutline, 'mdi-arrow-left': mdiArrowLeft,
    'mdi-bell-outline': mdiBellOutline, 'mdi-briefcase-outline': mdiBriefcaseOutline, 'mdi-bullseye': mdiBullseye,
    'mdi-calendar-account-outline': mdiCalendarAccountOutline, 'mdi-calendar-month-outline': mdiCalendarMonthOutline,
    'mdi-calendar-plus-outline': mdiCalendarPlusOutline, 'mdi-cart-plus': mdiCartPlus,
    'mdi-chart-multiple': mdiChartMultiple, 'mdi-check': mdiCheck, 'mdi-chevron-down': mdiChevronDown,
    'mdi-chevron-right': mdiChevronRight, 'mdi-chevron-up': mdiChevronUp, 'mdi-circle': mdiCircle,
    'mdi-clipboard-text-play-outline': mdiClipboardTextPlayOutline, 'mdi-close': mdiClose,
    'mdi-close-circle-outline': mdiCloseCircleOutline, 'mdi-cog-outline': mdiCogOutline, 'mdi-counter': mdiCounter,
    'mdi-currency-usd': mdiCurrencyUsd, 'mdi-delete': mdiDelete, 'mdi-devices': mdiDevices,
    'mdi-dots-vertical': mdiDotsVertical, 'mdi-download': mdiDownload, 'mdi-email': mdiEmail,
    'mdi-email-outline': mdiEmailOutline, 'mdi-emoticon-sick-outline': mdiEmoticonSickOutline,
    'mdi-eye': mdiEye, 'mdi-eye-off': mdiEyeOff, 'mdi-file-chart-outline': mdiFileChartOutline,
    'mdi-file-document-multiple-outline': mdiFileDocumentMultipleOutline,
    'mdi-file-document-outline': mdiFileDocumentOutline, 'mdi-file-download-outline': mdiFileDownloadOutline,
    'mdi-file-sign': mdiFileSign, 'mdi-filmstrip': mdiFilmstrip, 'mdi-filter-variant': mdiFilterVariant,
    'mdi-food-apple-outline': mdiFoodAppleOutline, 'mdi-gender-female': mdiGenderFemale,
    'mdi-gender-male': mdiGenderMale, 'mdi-heart-cog': mdiHeartCog, 'mdi-heart-pulse': mdiHeartPulse,
    'mdi-help-circle-outline': mdiHelpCircleOutline, 'mdi-home-outline': mdiHomeOutline,
    'mdi-hospital-building': mdiHospitalBuilding, 'mdi-human-male-height': mdiHumanMaleHeight,
    'mdi-id-card': mdiIdCard, 'mdi-image-outline': mdiImageOutline, 'mdi-information-outline': mdiInformationOutline,
    'mdi-list-box-outline': mdiListBoxOutline, 'mdi-lock': mdiLock, 'mdi-logout': mdiLogout,
    'mdi-magnify': mdiMagnify, 'mdi-reload': mdiReload,
    'mdi-menu-close': mdiMenuClose, 'mdi-menu-open': mdiMenuOpen, 'mdi-menu-right': mdiMenuRight,
    'mdi-message-text-outline': mdiMessageTextOutline, 'mdi-microphone': mdiMicrophone,
    'mdi-microphone-outline': mdiMicrophoneOutline, 'mdi-needle': mdiNeedle,
    'mdi-note-check-outline': mdiNoteCheckOutline, 'mdi-paperclip': mdiPaperclip, 'mdi-pencil': mdiPencil,
    'mdi-pencil-outline': mdiPencilOutline, 'mdi-phone-off': mdiPhoneOff, 'mdi-phone-outline': mdiPhoneOutline,
    'mdi-pill-multiple': mdiPillMultiple, 'mdi-play-circle-outline': mdiPlayCircleOutline, 'mdi-plus': mdiPlus,
    'mdi-power': mdiPower, 'mdi-upload': mdiUpload, 'mdi-video-outline': mdiVideoOutline,
    'mdi-view-dashboard': mdiViewDashboard, 'mdi-walk': mdiWalk,
};

// Original class -> FontAwesome icon definition ([w, h, , , pathData]).
const FA_DEFS = {
    'fa-bed-pulse': faBedPulse, 'fa-prescription-bottle-medical': faPrescriptionBottleMedical,
    'fa-buildings': faBuilding, 'fa-building': faBuilding, 'fa-paw': faPaw, 'fa-bowl-food': faBowlFood,
    'fa-notes-medical': faNotesMedical, 'fa-person-walking-arrow-loop-left': faPersonWalkingArrowLoopLeft,
    'fa-address-card': faAddressCard, 'fa-arrow-right': faArrowRight, 'fa-ban': faBan, 'fa-book': faBook,
    'fa-circle-exclamation': faCircleExclamation, 'fa-circle-info': faCircleInfo,
    'fa-cloud-arrow-up': faCloudArrowUp, 'fa-ellipsis': faEllipsis, 'fa-envelope': faEnvelope,
    'fa-exclamation-triangle': faTriangleExclamation, 'fa-warning': faTriangleExclamation,
    'fa-filter': faFilter, 'fa-hand-dots': faHandDots, 'fa-house': faHouse,
    'fa-magnifying-glass': faMagnifyingGlass, 'fa-message': faMessage, 'fa-pen': faPen, 'fa-pencil': faPencil,
    'fa-people-arrows': faPeopleArrows, 'fa-phone': faPhone, 'fa-question-circle': faCircleQuestion,
    'fa-rotate': faRotate, 'fa-times': faXmark, 'fa-trash': faTrash, 'fa-trash-can': faTrashCan,
    'fa-user': faUser, 'fa-file-powerpoint': faFilePowerpoint, 'fa-file-code': faFileCode,
    'fa-file-archive': faFileZipper, 'fa-file-pdf': faFilePdf, 'fa-file-word': faFileWord,
    'fa-file-excel': faFileExcel, 'fa-file-image': faFileImage, 'fa-file-lines': faFileLines,
    // Direct Address (Direct Secure Messaging) — the exact glyphs the legacy
    // message-center template used.
    'fa-reply': faReply, 'fa-box-archive': faBoxArchive, 'fa-paper-plane': faPaperPlane,
    'fa-angle-left': faAngleLeft, 'fa-angle-right': faAngleRight, 'fa-hospital': faHospital,
    'fa-user-plus': faUserPlus, 'fa-arrow-left': faArrowLeft, 'fa-circle': faCircle, 'fa-file': faFile,
    'fa-paperclip': faPaperclip,
    // Patient-list action menu (legacy active.patient.js _displayAllPossibleActionIcons).
    // `fa-regular` variants keep the original outline glyph.
    'fa-eye': faEyeRegular, 'fa-calendar-plus': faCalendarPlusRegular,
    'fa-share-nodes': faShareNodes, 'fa-file-import': faFileImport, 'fa-file-export': faFileExport,
     'fa-circle-down': faCircleDown, 'fa-user-slash': faUserSlash,
    // `fa-file-certificate` is FontAwesome Pro-only (absent from the free kit this
    // app ships, so it never rendered originally) — nearest free equivalent.
    'fa-file-certificate': faFileCircleCheck,
    // Patient demographics bar (legacy patient.chart.js PatientDemographics).
    // `fa-sparkles` is Pro-only; `fa-wand-magic-sparkles` is the free equivalent.
    'fa-sparkles': faWandMagicSparkles,
    'fa-arrow-up-right-from-square': faArrowUpRightFromSquare,
};

/** Resolves an original icon class to a `{ viewBox, d }` renderable, or null. */
export const resolveIcon = (icon) => {
    const mdiPath = MDI_PATHS[icon];
    if (mdiPath) return { viewBox: '0 0 24 24', d: mdiPath };
    const def = FA_DEFS[icon];
    if (def) {
        const [w, h, , , d] = def.icon;
        return { viewBox: `0 0 ${w} ${h}`, d: typeof d === 'string' ? d : d[d.length - 1] };
    }
    return null;
};

/** HTML-string form for innerHTML/template contexts (e.g. DataTable body strings). */
export const legacyIconHtml = (icon, extraClass = '') => {
    const r = resolveIcon(icon);
    if (!r) return '';
    const cls = `pi ${extraClass}`.trim();
    return `<svg class="${cls}" width="1em" height="1em" viewBox="${r.viewBox}" fill="currentColor" aria-hidden="true" focusable="false"><path d="${r.d}"/></svg>`;
};
