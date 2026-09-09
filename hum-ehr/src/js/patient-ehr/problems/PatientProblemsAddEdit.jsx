import { useCallback, useEffect, useMemo, useState } from 'react';
import Swal from 'sweetalert2';
import { buildProblemSavePayload, savePatientProblem } from '../../../services/problemService';
import { fetchProblemSnomedForIcd } from '../../../services/lookupService';
import { getFormattedIcdCode } from '../../../utils/commonUtility';
import { getSaveOutcome } from '../../../utils/saveResponse';
import ProblemIcdLookupInput from './ProblemIcdLookupInput';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import FlatpickrDateTimeInput from '../../../components/common/FlatpickrDateTimeInput';
import FormStatusFooter from '../../../components/common/FormStatusFooter';
import CommonSelect from '../../../components/common/CommonSelect';
import { fetchPatientDetails, triggerPatientDsiRefresh } from '../../../services/patientService';
import { useSectionLock } from '../../../hooks/useSectionLock';
import {
	checkAndSetRecordIdInCurrentSessionForLog,
	getRecordIdMessageInCurrentSessionForLog,
	setCarePlanLogSessionId,
} from '../../../services/changeLogService';
import patientCache from '../../../utils/patientCache';
import moment, { userNow } from '../../../utils/dayjs';
// Change-log section for the problems screen (legacy uses "DIAGNOSIS").
const CHANGE_LOG_SECTION = 'DIAGNOSIS';
// Current date/time in the LOGGED-IN USER's timezone (not the browser clock) — the backend
// treats recordedDate/dates as wall-clock in that zone, so a browser-clock default would
// save the record in the user's future and hide it from date-scoped list queries.
const nowDateTime = () => userNow().format('MM-DD-YYYY hh:mm A');
// Themed confirmation (legacy utility.initJqueryPopUpConfirmationWithSelector). Reuses the
// shared pa-swal-* classes; the container sits above the PrimeReact modal (z-index in CSS).
const swalConfirm = Swal.mixin({
    customClass: { container: 'pp-swal-container', popup: 'pa-swal-popup', title: 'pa-swal-title', confirmButton: 'pa-swal-confirm', cancelButton: 'pa-swal-cancel' },
    // reverseButtons: NO (cancel) on the left, YES (confirm) on the right — matching the legacy popup.
    buttonsStyling: false, showCancelButton: true, reverseButtons: true, allowOutsideClick: false, allowEscapeKey: false,
});
const createDefaultForm = () => ({
    icdCode: '',
    icdDescription: '',
    snomedCode: '',
    snomedDescription: '',
    diagnosisType: '',
    clinicalStatus: '',
    verificationStatus: '',
    diagnosisDate: '',
    // Legacy defaults Recorded Date & Time to the current logged-in-user time for new records.
    recordedDate: nowDateTime(),
    endDate: '',
    notes: '',
});
// Status classification by description keyword — the legacy code keys off the
// humcode response *order*; matching the human-readable label is more robust
// than hard-coding uncertain codes for recurrence/relapse/differential/etc.
const descOf = (statuses, code) => {
    const found = statuses.find((status) => String(status.code) === String(code));
    return (found?.description || '').toLowerCase();
};
const PatientProblemsAddEdit = ({ patientId, problemRecord, actionType, statusMetadata, onClose, }) => {
    const [form, setForm] = useState(createDefaultForm);
    const [snomedOptions, setSnomedOptions] = useState([]);
    const [snomedLocked, setSnomedLocked] = useState(false);
    const [noSnomed, setNoSnomed] = useState(false);
    const [saving, setSaving] = useState(false);
    const [errors, setErrors] = useState({});
    // Server save outcome for a 200 response whose envelope status is
    // warning/failure (kept separate from field validation so it can carry tone).
    const [saveError, setSaveError] = useState(null);
    const [dob, setDob] = useState('');
    const [dirty, setDirty] = useState(false);
    const now = nowDateTime();
    const isEditMode = !!problemRecord?.diagnosisId;
    const isRecoverMode = actionType === 'recover';
    // Concurrency lock (existing records only): the hook locks the record on mount,
    // heartbeats/resumes while the form is open, and releases it on close — unless we
    // saved, in which case the save releases it server-side. If another user already
    // holds the lock, the shared warning modal is shown and we close this form.
    const { markSaved } = useSectionLock({
        patientId,
        resourceNavigationCode: 'PROBLEM',
        sectionReferenceId: problemRecord?.diagnosisId || null,
        versionId: problemRecord?.versionId ?? 0,
        enabled: isEditMode,
        onLockDenied: () => onClose(false),
    });
    const clinicalStatuses = useMemo(() => statusMetadata?.clinicalStatuses || [], [statusMetadata]);
    const verificationStatuses = useMemo(() => statusMetadata?.verificationStatuses || [], [statusMetadata]);
    const fieldId = (base) => `${base}_${patientId}`;
    const clearFieldError = (key) => setErrors((previous) => {
        if (!previous[key])
            return previous;
        const next = { ...previous };
        delete next[key];
        return next;
    });
    const updateForm = (key, value) => {
        setForm((previous) => ({ ...previous, [key]: value }));
        clearFieldError(key);
        setDirty(true);
    };
    // ---- current status classification ----
    const clinicalDesc = descOf(clinicalStatuses, form.clinicalStatus);
    const verificationDesc = descOf(verificationStatuses, form.verificationStatus);
    const clinical = {
        active: clinicalDesc.includes('active') && !clinicalDesc.includes('inactive'),
        inactive: clinicalDesc.includes('inactive'),
        resolved: clinicalDesc.includes('resolv'),
        remission: clinicalDesc.includes('remission'),
        recurrence: clinicalDesc.includes('recurrence'),
        relapse: clinicalDesc.includes('relapse'),
    };
    const verification = {
        unconfirmed: verificationDesc.includes('unconfirm'),
        refuted: verificationDesc.includes('refut'),
        differential: verificationDesc.includes('differential') || verificationDesc.includes('provisional'),
        enteredError: verificationDesc.includes('error'),
    };
    const endDateEnabled = clinical.inactive || clinical.resolved;
    const clinicalRequired = !verification.enteredError;
    // ---- option visibility (mirrors the legacy clinical<->verification rules) ----
    const isVerificationAllowed = (status) => {
        const d = (status.description || '').toLowerCase();
        const isRefuted = d.includes('refut');
        const isError = d.includes('error');
        if (clinical.active || clinical.recurrence || clinical.relapse || clinical.remission)
            return !isRefuted && !isError;
        if (clinical.inactive || clinical.resolved)
            return !isError;
        if (!form.clinicalStatus)
            return isError; // clinical empty => only entered-in-error
        return true;
    };
    const isClinicalAllowed = (status) => {
        if (verification.enteredError)
            return false; // no clinical status when entered-in-error
        if (verification.refuted) {
            const d = (status.description || '').toLowerCase();
            return d.includes('recurrence') || d.includes('remission');
        }
        return true;
    };
    // Always keep the currently-selected option visible — the legacy hides the other
    // options via `d-none` but never drops the selected value, so the <select> can still
    // display it (e.g. Inactive stays shown after Verification → Refuted).
    const visibleClinical = clinicalStatuses.filter((status) => status.code === form.clinicalStatus || isClinicalAllowed(status));
    const visibleVerification = verificationStatuses.filter((status) => status.code === form.verificationStatus || isVerificationAllowed(status));
    // ---- warning message (the eight documented status combinations) ----
    const warningMessage = useMemo(() => {
        if (!form.clinicalStatus && verification.enteredError)
            return { tone: 'error', text: 'This Problem Was Entered in Error.' };
        if (clinical.inactive && verification.differential)
            return { tone: 'warning', text: 'This Problem was marked as Inactive or Differential.' };
        if (clinical.inactive && verification.refuted)
            return { tone: 'warning', text: 'This Problem was marked as Inactive or Refuted.' };
        if (clinical.remission && verification.unconfirmed)
            return { tone: 'warning', text: 'This Problem was marked as Remission or Unconfirmed.' };
        if (clinical.remission && verification.differential)
            return { tone: 'warning', text: 'This Problem was marked as Remission or Differential.' };
        if (clinical.resolved && verification.unconfirmed)
            return { tone: 'warning', text: 'This Problem was marked as Resolved or Unconfirmed.' };
        if (clinical.resolved && verification.refuted)
            return { tone: 'warning', text: 'This Problem was marked as Resolved or Refuted.' };
        if (clinical.resolved && verification.differential)
            return { tone: 'warning', text: 'This Problem was marked as Resolved or Differential.' };
        return null;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [form.clinicalStatus, form.verificationStatus]);
    const loadSnomedForIcd = useCallback(async (icdCode, prefillCode = '', prefillDesc = '') => {
        setNoSnomed(false);
        setSnomedLocked(false);
        setSnomedOptions([]);
        if (prefillCode) {
            // Editing an existing record: lock to the stored SNOMED value.
            setSnomedOptions([{ snomedId: prefillCode, snomedDesc: prefillDesc }]);
            setSnomedLocked(true);
            return;
        }
        try {
            const response = await fetchProblemSnomedForIcd(icdCode);
            const list = response?.status === 'success' ? response.data || [] : [];
            if (!list.length) {
                setNoSnomed(true);
                return;
            }
            setSnomedOptions(list);
            if (list.length === 1) {
                setSnomedLocked(true);
                setForm((previous) => ({ ...previous, snomedCode: String(list[0].snomedId), snomedDescription: list[0].snomedDesc || '' }));
            }
        }
        catch (error) {
            console.error('Failed to fetch SNOMED codes.', error);
            setNoSnomed(true);
        }
    }, []);
    useEffect(() => {
        if (!isEditMode || !problemRecord) {
            setForm(createDefaultForm());
            setSnomedOptions([]);
            setNoSnomed(false);
            setSnomedLocked(false);
            return;
        }
        const icdCode = getFormattedIcdCode(problemRecord.icdCode || '');
        setForm({
            icdCode,
            icdDescription: problemRecord.icdDescription || '',
            snomedCode: problemRecord.snomedCode ? String(problemRecord.snomedCode) : '',
            snomedDescription: problemRecord.snomedDesc || '',
            diagnosisType: problemRecord.diagnosisType || '',
            clinicalStatus: problemRecord.clinicalStatusCode || '',
            verificationStatus: problemRecord.verificationStatusCode || '',
            diagnosisDate: problemRecord.dateOfDiagnosis || '',
            recordedDate: problemRecord.recordedDate || '',
            endDate: problemRecord.dateOfResolution || '',
            notes: problemRecord.notes || '',
        });
        if (problemRecord.snomedCode)
            loadSnomedForIcd(icdCode, String(problemRecord.snomedCode), problemRecord.snomedDesc || '');
    }, [problemRecord, isEditMode, loadSnomedForIcd]);
    // Patient DOB → lower bound for the diagnosis/recorded/resolution dates
    // (legacy floors every date at the patient's date of birth).
    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                let details = patientCache.get(`${patientId}_details`);
                if (!details) {
                    const response = await fetchPatientDetails(patientId);
                    details = response?.status === 'success' ? response.data?.patientDetails : null;
                }
                if (!ignore && details?.dateOfBirth) setDob(`${details.dateOfBirth} 12:00 AM`);
            }
            catch (error) { console.error('Failed to load patient details.', error); }
        })();
        return () => { ignore = true; };
    }, [patientId]);
    // New record: default Clinical Status to the first (Active) status once the metadata
    // loads, matching the legacy preselect of clinicalStatusCode[0]. Keyed off the form's
    // own emptiness (not a one-shot ref) so it survives React StrictMode's double-mount —
    // where the create-form effect re-clears the form — while still never overriding a
    // value the user chose or intentionally cleared (those don't change this effect's deps).
    useEffect(() => {
        if (isEditMode || !clinicalStatuses.length) return;
        setForm((previous) => (previous.clinicalStatus ? previous : { ...previous, clinicalStatus: clinicalStatuses[0].code }));
    }, [isEditMode, clinicalStatuses]);
    const handleIcdSelect = (item) => {
        setDirty(true);
        setForm((previous) => ({
            ...previous,
            icdCode: item.code,
            icdDescription: item.description,
            diagnosisType: item.chronicIndicator === 1 || item.chronicIndicator === '1' ? 'CHRO' : 'ACUT',
            snomedCode: '',
            snomedDescription: '',
        }));
        clearFieldError('icdCode');
        clearFieldError('diagnosisType');
        loadSnomedForIcd(item.code);
    };
    const handleSnomedChange = (code) => {
        setDirty(true);
        const option = snomedOptions.find((item) => String(item.snomedId) === String(code));
        setForm((previous) => ({ ...previous, snomedCode: code, snomedDescription: option?.snomedDesc || '' }));
        clearFieldError('snomedCode');
    };
    const handleClinicalStatusChange = (value) => {
        setDirty(true);
        setForm((previous) => {
            const next = { ...previous, clinicalStatus: value };
            const vStatus = verificationStatuses.find((status) => String(status.code) === String(previous.verificationStatus));
            if (vStatus) {
                const d = (vStatus.description || '').toLowerCase();
                const cd = descOf(clinicalStatuses, value);
                const cActiveLike = (cd.includes('active') && !cd.includes('inactive')) || cd.includes('remission') || cd.includes('recurrence') || cd.includes('relapse');
                if (cActiveLike && (d.includes('refut') || d.includes('error')))
                    next.verificationStatus = '';
                else if ((cd.includes('inactive') || cd.includes('resolv')) && d.includes('error'))
                    next.verificationStatus = '';
            }
            const cd = descOf(clinicalStatuses, value);
            if (!(cd.includes('inactive') || cd.includes('resolv')))
                next.endDate = '';
            // Legacy: clearing Clinical Status auto-selects "Entered in Error" verification.
            if (!value) {
                const errCode = verificationStatuses.find((status) => (status.description || '').toLowerCase().includes('error'))?.code;
                if (errCode) next.verificationStatus = errCode;
            }
            return next;
        });
        clearFieldError('clinicalStatus');
        clearFieldError('endDate');
    };
    const validateForm = () => {
        const nextErrors = {};
        if (!form.icdCode || !form.icdDescription)
            nextErrors.icdCode = 'Please select a problem from the ICD search list.';
        if (!noSnomed && snomedOptions.length > 0 && !form.snomedCode)
            nextErrors.snomedCode = 'SNOMED Code is required.';
        if (!form.diagnosisType)
            nextErrors.diagnosisType = 'Problem Type is required.';
        if (clinicalRequired && !form.clinicalStatus)
            nextErrors.clinicalStatus = 'Clinical Status is required.';
        if (endDateEnabled && !form.endDate)
            nextErrors.endDate = 'Date of Resolution is required.';
        if (form.endDate && !form.diagnosisDate)
            nextErrors.diagnosisDate = 'Date of Diagnosis is required when Date of Resolution is entered.';
        if (form.endDate && form.diagnosisDate
            && moment(form.endDate, 'MM-DD-YYYY hh:mm A').isBefore(moment(form.diagnosisDate, 'MM-DD-YYYY hh:mm A')))
            nextErrors.endDate = 'Date of Resolution must be on or after Date of Diagnosis.';
        if (form.notes && form.notes.trim().length < 2)
            nextErrors.notes = 'Minimum 2 characters.';
        return nextErrors;
    };
    const handleFormSubmit = async (event) => {
        event.preventDefault();
        setSaveError(null);
        const validationErrors = validateForm();
        setErrors(validationErrors);
        if (Object.keys(validationErrors).length)
            return;
        // Legacy patient.chart.auto.save.js: once the form is valid, confirm before saving
        // ("Save/Update Changes" → "Are you sure about to Save/Update Changes?").
        const confirmed = await swalConfirm.fire({
            title: `${isEditMode ? 'Update' : 'Save'} Changes`,
            text: `Are you sure about to ${isEditMode ? 'Update' : 'Save'} Changes?`,
            confirmButtonText: 'YES',
            cancelButtonText: 'NO',
        });
        if (!confirmed.isConfirmed)
            return;
        setSaving(true);
        try {
            // Legacy constructProblemChangeLogMessage auto-fills the hidden change-log field
            // from the diagnosis label ("<icd> - <description>"), reusing any message already
            // tracked for this record in the session. Editing keys off the numeric diagnosisId
            // ("An existing problem … modified"); a new record keys off the ICD code string
            // ("A new problem … added").
            const diagnosisName = `${form.icdCode} - ${form.icdDescription}`;
            const recordIdForLog = isEditMode ? problemRecord?.diagnosisId : (form.icdCode || null);
            const changeLogMessage = getRecordIdMessageInCurrentSessionForLog(CHANGE_LOG_SECTION, recordIdForLog, { name: diagnosisName }, patientId);
            const response = await savePatientProblem(buildProblemSavePayload({ patientId, form, problemRecord, changeLogMessage }));
            // The save endpoint returns HTTP 200 even when it rejects the record:
            // only status === 'success' means saved. A 'warning'/'failure' body
            // (e.g. a duplicate problem) keeps the form open and the server message
            // is surfaced under the ICD search field, as the legacy form did.
            const outcome = getSaveOutcome(response, 'This problem could not be saved. Please review the details and try again.');
            if (outcome.ok) {
                // Record the session's change-log grouping (logId) + this record's message so a
                // subsequent save/delete in the same session appends to one audit entry.
                setCarePlanLogSessionId(CHANGE_LOG_SECTION, response?.logId, patientId);
                checkAndSetRecordIdInCurrentSessionForLog(CHANGE_LOG_SECTION, response?.id, changeLogMessage, isEditMode ? 'OLD' : 'NEW', patientId);
                // Item 2 — re-evaluate DSI alerts (a new/changed problem may raise a drug-disease alert).
                triggerPatientDsiRefresh(patientId);
                markSaved(); // the save released the lock server-side — skip the unlock on unmount
                // Item 3 — when opened from a section's diagnosis picker, hand back the saved
                // diagnosis so the parent auto-selects it (legacy constructNewSelectedDiagnosis).
                onClose(true, {
                    diagnosisId: response?.id ?? null,
                    icdCode: form.icdCode,
                    icdDescription: form.icdDescription,
                    snomedCode: form.snomedCode || null,
                    snomedDesc: form.snomedDescription || null,
                    diagnosisType: form.diagnosisType,
                    invalidFlag: 'N',
                });
                return;
            }
            setSaveError(outcome);
        }
        catch (error) {
            console.error('Failed to save problem.', error);
            setSaveError({ tone: 'error', message: error?.message || 'Failed to save problem. Please try again.' });
        }
        finally {
            setSaving(false);
        }
    };
    return (<div className="pp-problems-add-edit-main-container">
      <form id={fieldId('pp_patient_problem_add_edit_form')} className="care-plan-data-entry" onSubmit={handleFormSubmit} noValidate>
        <div className="pp-problem-form-body">
        {/* Row 1 — identification: ICD search · SNOMED code · Type. */}
        <div className="row g-3">
          <div className="col-12 col-sm-6 col-md-4">
            <ProblemIcdLookupInput id={fieldId('pp_patient_problem_icd_code')} label="Search By ICD Code (or) Description" required value={form.icdCode} disabled={isEditMode} placeholder="ICD Code" onChange={(value) => updateForm('icdCode', value)} onSelect={handleIcdSelect}/>
            {errors.icdCode && <div className="small text-danger mt-1">{errors.icdCode}</div>}
            {saveError && (<div className={`small mt-1 ${saveError.tone === 'warning' ? 'text-warning' : 'text-danger'}`} id={fieldId('pp_patient_problem_save_error')}>
                <LegacyIcon icon="fa-exclamation-triangle" className="me-1"/>{saveError.message}
              </div>)}
          </div>
          <div className="col-12 col-sm-6 col-md-4">
            <label className="form-label fw-bold" htmlFor={fieldId('pp_patient_problem_snomed_code')}>SNOMED Code <span className="text-danger">*</span></label>
            <CommonSelect inputId={fieldId('pp_patient_problem_snomed_code')} value={form.snomedCode} isDisabled={snomedLocked || noSnomed || !snomedOptions.length} placeholder="Select SNOMED Code" invalid={!!errors.snomedCode} onChange={handleSnomedChange} options={snomedOptions.map((option) => ({ value: String(option.snomedId), label: `${option.snomedId} - ${option.snomedDesc}` }))}/>
            {noSnomed && <div className="small text-warning mt-1">There is no SNOMED CT code linked to {form.icdCode}.</div>}
            {errors.snomedCode && <div className="small text-danger mt-1">{errors.snomedCode}</div>}
          </div>
          <div className="col-12 col-sm-6 col-md-4">
            <label className="form-label fw-bold" htmlFor={fieldId('pp_patient_problem_type')}>Type <span className="text-danger">*</span></label>
            <CommonSelect inputId={fieldId('pp_patient_problem_type')} value={form.diagnosisType} placeholder="Select Diagnosis Type" invalid={!!errors.diagnosisType} onChange={(value) => updateForm('diagnosisType', value)} options={[{ value: 'CHRO', label: 'Chronic' }, { value: 'ACUT', label: 'Acute' }]}/>
            {errors.diagnosisType && <div className="small text-danger mt-1">{errors.diagnosisType}</div>}
          </div>
        </div>

        {/* Row 2 — read-only descriptions (col-8) beside the stacked Clinical / Verification
            status (col-4), matching the legacy problem add/edit template layout. */}
        <div className="row g-3 mt-1">
          <div className="col-12 col-md-8">
            <div className="row g-3">
              <div className="col-12 col-md-6">
                <label className="form-label fw-bold" htmlFor={fieldId('pp_patient_problem_icd_description')}>ICD Description <span className="text-danger">*</span></label>
                <textarea id={fieldId('pp_patient_problem_icd_description')} className="form-control" style={{ height: 115 }} value={form.icdCode && form.icdDescription ? `${form.icdCode} - ${form.icdDescription}` : form.icdDescription} disabled maxLength={5000}/>
              </div>
              <div className="col-12 col-md-6">
                <label className="form-label fw-bold" htmlFor={fieldId('pp_patient_problem_snomed_description')}>Snomed Description</label>
                <textarea id={fieldId('pp_patient_problem_snomed_description')} className="form-control" style={{ height: 115 }} value={form.snomedDescription} disabled maxLength={5000}/>
              </div>
            </div>
          </div>
          <div className="col-12 col-md-4">
            <div className="mb-3">
              <label className="form-label fw-bold" htmlFor={fieldId('pp_patient_problem_clinical_status')}>Clinical Status {clinicalRequired && <span className="text-danger">*</span>}</label>
              <CommonSelect inputId={fieldId('pp_patient_problem_clinical_status')} className="pp-clinical-status" value={form.clinicalStatus} placeholder="Select Clinical Status" invalid={!!errors.clinicalStatus} onChange={handleClinicalStatusChange} options={visibleClinical.map((status) => ({ value: status.code, label: status.description }))}/>
              {errors.clinicalStatus && <div className="small text-danger mt-1">{errors.clinicalStatus}</div>}
            </div>
            <div>
              <label className="form-label fw-bold" htmlFor={fieldId('pp_patient_problem_verification_status')}>Verification Status</label>
              <CommonSelect inputId={fieldId('pp_patient_problem_verification_status')} value={form.verificationStatus} placeholder="Select Verification Status" onChange={(value) => updateForm('verificationStatus', value)} options={visibleVerification.map((status) => ({ value: status.code, label: status.description }))}/>
              {warningMessage && (<div className={`small mt-1 ${warningMessage.tone === 'error' ? 'text-danger' : 'text-warning'}`}>
                  <LegacyIcon icon="fa-exclamation-triangle" className="me-1"/>{warningMessage.text}
                </div>)}
            </div>
          </div>
        </div>

        {/* Row 3 — the three dates. */}
        <div className="row g-3 mt-1">
          <div className="col-12 col-sm-6 col-md-4">
            <label className="form-label fw-bold" htmlFor={fieldId('pp_patient_problem_diagnosis_date')}>Date of Diagnosis</label>
            <FlatpickrDateTimeInput id={fieldId('pp_patient_problem_diagnosis_date')} value={form.diagnosisDate} onChange={(value) => updateForm('diagnosisDate', value)} enableTime dateFormat="m-d-Y h:i K" placeholder="MM-DD-YYYY HH:MM AM/PM" minDate={dob || undefined} maxDate={now}/>
            {errors.diagnosisDate && <div className="small text-danger mt-1">{errors.diagnosisDate}</div>}
          </div>
          <div className="col-12 col-sm-6 col-md-4">
            <label className="form-label fw-bold" htmlFor={fieldId('pp_patient_problem_recorded_date')}>Recorded Date &amp; Time</label>
            <FlatpickrDateTimeInput id={fieldId('pp_patient_problem_recorded_date')} value={form.recordedDate} onChange={(value) => updateForm('recordedDate', value)} enableTime dateFormat="m-d-Y h:i K" placeholder="MM-DD-YYYY HH:MM AM/PM" minDate={dob || undefined} maxDate={now}/>
          </div>
          <div className="col-12 col-sm-6 col-md-4">
            <label className="form-label fw-bold" htmlFor={fieldId('pp_patient_problem_end_date')}>Date of Resolution {endDateEnabled && <span className="text-danger">*</span>}</label>
            <FlatpickrDateTimeInput id={fieldId('pp_patient_problem_end_date')} value={form.endDate} onChange={(value) => updateForm('endDate', value)} enableTime dateFormat="m-d-Y h:i K" placeholder="MM-DD-YYYY HH:MM AM/PM" disabled={!endDateEnabled} minDate={form.diagnosisDate || dob || undefined} maxDate={now}/>
            {errors.endDate && <div className="small text-danger mt-1">{errors.endDate}</div>}
          </div>
        </div>

        {/* Row 4 — notes. */}
        <div className="row g-3 mt-1">
          <div className="col-12">
            <label className="form-label fw-bold" htmlFor={fieldId('pp_patient_problem_notes')}>Notes</label>
            {/* Legacy collapses consecutive spaces as the user types (replace(/ +(?= )/g,'')). */}
            <textarea id={fieldId('pp_patient_problem_notes')} className="form-control" style={{ height: 90 }} value={form.notes} onChange={(event) => updateForm('notes', event.target.value.replace(/ +(?= )/g, ''))} maxLength={5000}/>
            <div className="d-flex justify-content-between">
              {errors.notes ? <div className="small text-danger mt-1">{errors.notes}</div> : <span/>}
              <div className="small text-muted mt-1">({form.notes.length}/5000)</div>
            </div>
          </div>
        </div>
        </div>

        <FormStatusFooter
          dirty={dirty}
          saving={saving}
          onCancel={() => onClose(false)}
          saveLabel={isRecoverMode ? 'Recover Problem' : isEditMode ? 'Update' : 'Save'}
          alwaysEnableSave={isRecoverMode}
        />
      </form>
    </div>);
};
export default PatientProblemsAddEdit;
