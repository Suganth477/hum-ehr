import { useEffect, useRef, useState } from 'react';
import doctorImage from '../../assets/images/doctor.jpeg';
import { downloadPatientCCD, fetchPatientDetails, fetchPatientDsiAlerts } from '../../services/patientService';
import patientCache from '../../utils/patientCache';
import { useNotify } from '../../context/NotificationContext';
import { LegacyIcon } from '../../components/common/CustomIcons';
import { useOverflowCount } from '../../hooks/useOverflowCount';
import moment from '../../utils/dayjs';

// Room kept free for the "+N More" toggle once anything overflows (see its CSS min-width).
const MORE_TOGGLE_RESERVE_PX = 92;

/** Legacy utility.getGenderIconBasedOnGenderCode — MALE/FEMA hum codes. */
const getGenderIcon = (genderCode = '') => {
    const code = String(genderCode).toUpperCase();
    if (code.startsWith('FEMA') || code === 'F')
        return 'mdi-gender-female';
    if (code.startsWith('MALE') || code === 'M')
        return 'mdi-gender-male';
    return 'mdi-account';
};
/** Legacy utility.ageCalculator — whole years from the MM-DD-YYYY date of birth. */
const calculateAge = (dateOfBirth) => {
    if (!dateOfBirth)
        return '';
    const parsed = moment(dateOfBirth, 'MM-DD-YYYY', true);
    if (!parsed.isValid())
        return '';
    const years = moment().diff(parsed, 'year');
    return Number.isFinite(years) ? years : '';
};
/**
 * Single phone row. Legacy getPatientPhoneNumber reassigns (rather than appends) the
 * markup for mobile → home → work, so the LAST non-empty number is the one rendered.
 *
 * NOTE: legacy reads `mobilePhoneNumber` / `homePhoneNumber` / `workPhoneNumber`, but
 * /patient/details actually returns `mobilePhone` / `homePhone` / `workPhone` — so the
 * phone row never renders on the legacy screen either. The legacy keys are kept here
 * so both screens match; switch to the commented keys to make the row appear.
 */
const getPatientPhoneNumber = (patientInfo) => {
    const { mobilePhoneNumber, homePhoneNumber, workPhoneNumber } = patientInfo;
    // const { mobilePhone, homePhone, workPhone } = patientInfo;  // the real API keys
    return workPhoneNumber || homePhoneNumber || mobilePhoneNumber || '';
};
/**
 * Patient demographics bar (legacy `<pc-patient-demographics patient-id is-show-dsi-alert>`
 * in patient.chart.js). Renders the profile picture, the label/value detail strip, the DSI
 * alert trigger, and the 3-dot action menu (Export CCD / Import CCD / Smart App Launch).
 *
 * @param {{ patientId: string|number, isShowDsiAlert?: 'Y'|'N' }} props
 */
const PatientDemographics = ({ patientId, isShowDsiAlert = 'N' }) => {
    // undefined = fetching (skeleton), null = fetch failed.
    const [patientDetails, setPatientDetails] = useState(undefined);
    const [dsiAlertCount, setDsiAlertCount] = useState(0);
    const [isDownloading, setIsDownloading] = useState(false);
    // "+N More" panel holding the detail cells that don't fit on the single line.
    const [isMoreOpen, setMoreOpen] = useState(false);
    // The toggle sits inside the (clipping) strip while the panel is rendered outside
    // it, so outside-click detection has to check both.
    const moreToggleRef = useRef(null);
    const morePanelRef = useRef(null);
    const { notify, notifyError } = useNotify();
    useEffect(() => {
        let ignore = false;
        const loadPatientDetails = async () => {
            if (!patientId)
                return;
            const cached = patientCache.get(`${patientId}_details`);
            if (cached) {
                setPatientDetails(cached);
                return;
            }
            setPatientDetails(undefined);
            try {
                const response = await fetchPatientDetails(patientId);
                if (ignore)
                    return;
                if (response?.status === 'success') {
                    const data = response.data || {};
                    patientCache.set(`${patientId}_details`, data.patientDetails);
                    patientCache.set(`${patientId}_subscribedProducts`, data.subscribedProducts);
                    patientCache.set(`${patientId}_sdohHistory`, data.sdohVisitHisotryDetails);
                    setPatientDetails(data.patientDetails || null);
                }
                else
                    setPatientDetails(null);
            }
            catch (error) {
                console.error('Failed to fetch patient details.', error);
                if (!ignore) {
                    setPatientDetails(null);
                    notifyError('Failed to fetch patient details. Please try again.');
                }
            }
        };
        loadPatientDetails();
        return () => { ignore = true; };
    }, [patientId, notifyError]);

    // Active DSI alerts drive the "DSI Alert" highlight (legacy adds `alert-message`
    // when the list is non-empty).
    useEffect(() => {
        let ignore = false;
        const loadDsiAlerts = async () => {
            if (!patientId)
                return;
            try {
                const response = await fetchPatientDsiAlerts(patientId);
                if (ignore)
                    return;
                const alerts = response?.status === 'success' ? response.data ?? [] : [];
                setDsiAlertCount(alerts.length);
                // Legacy opens the alert list straight away when the chart was opened
                // from a DSI alert (is-show-dsi-alert="Y").
                if (alerts.length > 0 && isShowDsiAlert === 'Y')
                    notify({ severity: 'info', summary: 'DSI Alerts', detail: `This patient has ${alerts.length} active DSI alert${alerts.length > 1 ? 's' : ''}.` });
            }
            catch (error) {
                console.error('Failed to fetch patient DSI alerts details.', error);
            }
        };
        loadDsiAlerts();
        return () => { ignore = true; };
    }, [patientId, isShowDsiAlert, notify]);

    const notifyNotMigrated = (label) => notify({
        severity: 'info',
        summary: 'Not available yet',
        detail: `${label} is not migrated yet.`,
    });
    // Legacy downloadPatientCCDFile — blob to pat_<patientId>.xml.
    const handleExportCCD = async () => {
        setIsDownloading(true);
        try {
            const response = await downloadPatientCCD(patientId);
            const hyperlink = document.createElement('a');
            // Legacy passes the extension as the blob type; kept verbatim.
            hyperlink.href = window.URL.createObjectURL(new Blob([response], { type: '.xml' }));
            hyperlink.download = `pat_${patientId}.xml`;
            document.body.appendChild(hyperlink);
            hyperlink.click();
            window.URL.revokeObjectURL(hyperlink.href);
            hyperlink.remove();
        }
        catch (error) {
            console.error('Failed to download CCD file.', error);
            notifyError('Failed to download patient data. Please try again.');
        }
        finally {
            setIsDownloading(false);
        }
    };
    // Legacy createPatientDemographicDetailsActionIconDropdown.
    const actionMenu = (
        <div className="action-icon-dropdown-group">
            <LegacyIcon icon="mdi-dots-vertical" className="action-group-icon" data-bs-toggle="dropdown" data-bs-auto-close="true" aria-expanded="false" role="button" />
            <ul className="dropdown-menu action-icon-dropdown-menu-list pd-patient-action-items" aria-labelledby="defaultDropdown">
                <li className="pd-patient-export-ccd-btn" role="button" aria-disabled={isDownloading} onClick={isDownloading ? undefined : handleExportCCD}>
                    <LegacyIcon icon="fa-file-import" className="action-icon" />
                    <span>{isDownloading ? 'Exporting...' : 'Export CCD'}</span>
                </li>
                <li className="pd-patient-import-ccd-btn" role="button" onClick={() => notifyNotMigrated('Import CCD')}>
                    <LegacyIcon icon="fa-file-export" className="action-icon" />
                    <span>Import CCD</span>
                </li>
                <li className="pd-patient-smart-launch-app" role="button" onClick={() => notifyNotMigrated('Smart App Launch')}>
                    <LegacyIcon icon="fa-arrow-up-right-from-square" className="action-icon" />
                    <span className="ehr-fhir-smart-app-launch">Smart App Launch</span>
                </li>
            </ul>
        </div>
    );
    // ---- Detail cells, in legacy order ------------------------------------------
    // Built before the early returns so the overflow hook's call order stays stable.
    const details = patientDetails || {};
    const age = calculateAge(details.dateOfBirth);
    const phoneNumber = patientDetails ? getPatientPhoneNumber(details) : '';
    const detailItems = !patientDetails ? [] : [
        {
            key: 'patient-name',
            hasIconSlot: true,
            label: 'Patient Name',
            value: <span className="pd-patient-demographics-data text-capitalize pd-patient-demographics-data-value patient-name" style={{ color: '#0E2C4B' }} title={details.patientName}>{details.patientName}</span>,
        },
        {
            key: 'gender',
            icon: getGenderIcon(details.gender),
            iconClassName: 'd-none',
            label: 'Gender',
            value: <span className="pd-patient-demographics-data pd-patient-demographics-data-value">{details.genderDesc}</span>,
        },
        {
            key: 'dob-age',
            label: 'DOB & Age',
            value: <span className="pd-patient-demographics-data pd-patient-demographics-data-value">{details.dateOfBirth}{age !== '' ? ` (${age}yrs)` : ''}</span>,
        },
        {
            key: 'emr-id',
            label: 'EMR Id',
            value: <span className="pd-patient-demographics-data pd-patient-demographics-data-value">{details.ehrEmrId}</span>,
        },
        // Email and Address are hidden in the current legacy design.
        ...(phoneNumber ? [{
            key: 'phone',
            icon: 'mdi-phone-outline',
            value: <span className="pd-patient-demographics-data">{phoneNumber}</span>,
        }] : []),
        {
            key: 'dsi-alert',
            className: 'pd-patient-chart-dsi-alerts',
            value: (<span className={`pd-patient-demographics-data patient-chart-dsi-alert-list-btn cursor-pointer ${dsiAlertCount > 0 ? 'alert-message' : ''}`}
                id="patient_chart_dsi_alert_icon" data-patient-id={patientId} aria-expanded="false" role="button"
                onClick={() => notifyNotMigrated('Patient Active DSI Alerts')}>
                <LegacyIcon icon="fa-sparkles" /> DSI Alert
            </span>),
        },
        {
            key: 'last-encounter',
            hasIconSlot: true,
            value: <span className="pd-patient-demographics-data">Last Encounter</span>,
        },
    ];
    // The strip stays on ONE line at every width: whatever does not fit moves into the
    // "+N More" panel instead of wrapping to a second row.
    const { containerRef, measureRef, visibleCount } = useOverflowCount(detailItems.length, { reserve: MORE_TOGGLE_RESERVE_PX });
    const visibleItems = detailItems.slice(0, visibleCount);
    const hiddenItems = detailItems.slice(visibleCount);

    // Dismiss the More panel on outside click / Escape, like any dropdown.
    useEffect(() => {
        if (!isMoreOpen)
            return undefined;
        const onDocumentPointerDown = (event) => {
            const insideToggle = moreToggleRef.current?.contains(event.target);
            const insidePanel = morePanelRef.current?.contains(event.target);
            if (!insideToggle && !insidePanel)
                setMoreOpen(false);
        };
        const onKeyDown = (event) => {
            if (event.key === 'Escape')
                setMoreOpen(false);
        };
        document.addEventListener('mousedown', onDocumentPointerDown);
        document.addEventListener('keydown', onKeyDown);
        return () => {
            document.removeEventListener('mousedown', onDocumentPointerDown);
            document.removeEventListener('keydown', onKeyDown);
        };
    }, [isMoreOpen]);

    const renderDetailCell = (item) => (
        <div key={item.key} className={`pd-patient-demographics-list-item ${item.className || ''}`.trim()}>
            {item.icon
                ? <LegacyIcon icon={item.icon} className={`pd-patient-demographics-icon ${item.iconClassName || ''}`.trim()} />
                : (item.hasIconSlot ? <span className="pd-patient-demographics-icon" /> : null)}
            {item.label ? <span className="pd-patient-demographics-data-label">{item.label}</span> : null}
            {item.value}
        </div>
    );
    if (patientDetails === undefined)
        return (
            <div className="patient-demographics-container-node">
                <div className="pd-patient-demographics-main-container">
                    <div className="pd-patient-profile-picture">
                        <div className="pd-skeleton-circle" />
                    </div>
                    <div className="pd-patient-demographics-details">
                        <div className="pd-patient-demographics-list">
                            {[150, 90, 140, 110, 90, 120].map((w, i) => (
                                <div key={i} className="pd-patient-demographics-list-item">
                                    <div className="pd-skeleton-bar" style={{ width: w }} />
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>
        );
    if (!patientDetails)
        return <div className="alert alert-warning m-2">Patient data unavailable.</div>;
    return (<div className="patient-demographics-container-node">
      <div className="pd-patient-demographics-main-container">
        <div className="pd-patient-profile-picture">
          <img className="pd-patient-image profile-image" src={doctorImage} alt="Profile Thumbnail" />
        </div>

        <div className="pd-patient-demographics-details">
          <div className="pd-patient-demographics-list" ref={containerRef}>
            {visibleItems.map(renderDetailCell)}

            {hiddenItems.length > 0 && (
              <div className="pd-patient-demographics-more">
                <button type="button" className="pd-more-toggle" ref={moreToggleRef} aria-expanded={isMoreOpen}
                  aria-controls={`pd_more_panel_${patientId}`} title={`Show ${hiddenItems.length} more detail${hiddenItems.length > 1 ? 's' : ''}`}
                  onClick={() => setMoreOpen((open) => !open)}>
                  <span>+{hiddenItems.length} More</span>
                  <LegacyIcon icon={isMoreOpen ? 'mdi-chevron-up' : 'mdi-chevron-down'} />
                </button>
              </div>
            )}
          </div>

          {/* Rendered OUTSIDE the strip: the strip is `overflow: hidden` (its safety net
              against a half-drawn cell), which would clip this panel away entirely. It is
              positioned against the bar instead. */}
          {isMoreOpen && hiddenItems.length > 0 && (
            <div className="pd-more-panel" id={`pd_more_panel_${patientId}`} ref={morePanelRef}>
              {hiddenItems.map(renderDetailCell)}
            </div>
          )}

          {/* Off-layout copy of every cell: the hook reads natural widths from here,
              since cells moved into the More panel have none in the strip. */}
          <div className="pd-patient-demographics-list pd-measure-row" ref={measureRef} aria-hidden="true">
            {detailItems.map(renderDetailCell)}
          </div>

          {actionMenu}
        </div>
      </div>
    </div>);
};
export default PatientDemographics;
