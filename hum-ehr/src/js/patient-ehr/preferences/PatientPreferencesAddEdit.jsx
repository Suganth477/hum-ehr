import { useEffect, useMemo, useRef, useState } from 'react';
import { userNow } from '../../../utils/dayjs';
import Select from 'react-select';
import {
    PREFERENCES_DESC_MAP, PREFERENCES_CONCURRENT_CODE, ALLOWED_STATUS_TRANSITIONS, NEW_STATUS_CODES,
    fetchPreferencesList, savePreference, buildPreferenceSavePayload,
} from '../../../services/preferencesService';
import { useSectionLock } from '../../../hooks/useSectionLock';
import { getLoggedInUser } from '../../../services/authService';
import { fetchPatientDetails } from '../../../services/patientService';
import patientCache from '../../../utils/patientCache';
import { getSaveOutcome } from '../../../utils/saveResponse';
import FlatpickrDateTimeInput from '../../../components/common/FlatpickrDateTimeInput';
import UniversalFileUploader from '../../../components/common/UniversalFileUploader';
import { useNotify } from '../../../context/NotificationContext';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import FormStatusFooter from '../../../components/common/FormStatusFooter';
import AdvanceDirectiveDeleteModal from './AdvanceDirectiveDeleteModal';

const nowDateTime = () => userNow().format('MM-DD-YYYY hh:mm A');
const FieldError = ({ message }) => (message ? <div className="small text-danger mt-1">{message}</div> : null);

/**
 * Preferences add/edit form (legacy EhrPatientChartPreferencesAddEdit), shown INLINE in place of
 * the list+detail (not a modal — matches the legacy preferences-add-edit-container swap). Title
 * comes from the type's lookup; status options follow the allowed-transition matrix; Last Effective
 * Date unlocks/requires only for CANCELLED. Advance Directives use the Universal File Uploader;
 * Treatment Preferences can link to active Advance Directives. Inactivating / entering-in-error an
 * Advance Directive that still has active linked Treatment Preferences prompts whether to inactivate
 * those too (deletePreferenceCode).
 */
const PatientPreferencesAddEdit = ({ patientId, preferencesType, record, lookups, statuses, treatmentLookups, onClose }) => {
    const isEdit = !!(record && record.id);
    const { notifySuccess } = useNotify();
    const uploaderRef = useRef(null);
    const [adModal, setAdModal] = useState({ open: false, linked: [], actionText: 'Inactivate' });

    // Concurrency lock (existing records only) — preferences lock PER sub-section, so the
    // resourceNavigationCode is the category's code (CAREPREF / TREATPREF / DIRCTPREF). The hook
    // locks on mount, heartbeats/resumes, and releases on close unless saved (the save's sessionId
    // releases it server-side); a record already held by another user closes this form.
    const { markSaved } = useSectionLock({
        patientId,
        resourceNavigationCode: PREFERENCES_CONCURRENT_CODE[preferencesType],
        sectionReferenceId: record?.id || null,
        versionId: record?.versionId ?? 0,
        enabled: isEdit,
        onLockDenied: () => onClose(false),
    });

    const titleOptions = useMemo(() => (lookups || []).map((l) => ({ value: l.code, label: l.label, code: l.code })), [lookups]);

    const [form, setForm] = useState(() => ({
        code: record?.code || '',
        title: record ? ((lookups || []).find((l) => l.code === record.code)?.label || record.description || '') : '',
        notes: record?.notes || '',
        effectiveDate: record?.effectiveDate || '',
        lastEffectiveDate: record?.lastEffectiveDate || '',
        recordedDate: record?.recordedDate || nowDateTime(),
        statusCode: record?.statusCode || '',
    }));
    const [selectedAds, setSelectedAds] = useState(() => (record?.advanceDirectives || []).map((ad) => ({ value: ad.id, label: ad.description || ad.code })));
    const [adOptions, setAdOptions] = useState([]);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [dob, setDob] = useState('');
    const [dirty, setDirty] = useState(false);

    // Patient DOB → lower bound for the date fields (legacy data-min = dateOfBirth 12:00 AM).
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

    const providerName = record?.validatingUserName || getLoggedInUser()?.name || getLoggedInUser()?.fullName || '';
    const descLabel = preferencesType === 'advance-directives' ? 'Description' : PREFERENCES_DESC_MAP[preferencesType];
    const descRequired = preferencesType !== 'advance-directives';
    // Legacy hideFieldsBasedOnPreferencesType labels (note the singular "Care Preference Title").
    const titleLabel = { 'care-preferences': 'Care Preference Title', 'treatment-preferences': 'Treatment Preferences Title', 'advance-directives': 'Advance Directives Title' }[preferencesType] || `${PREFERENCES_DESC_MAP[preferencesType]} Title`;

    // Status options: new → the standard set; edit → transitions allowed from the current status.
    const statusOptions = useMemo(() => {
        const allowed = isEdit ? (ALLOWED_STATUS_TRANSITIONS[record?.statusCode] || []) : NEW_STATUS_CODES;
        return (statuses || []).filter((s) => allowed.includes(s.code)).sort((a, b) => (a.sortOrder || 0) - (b.sortOrder || 0));
    }, [statuses, isEdit, record]);

    // Treatment preferences: load active advance directives to link.
    useEffect(() => {
        if (preferencesType !== 'treatment-preferences') return;
        let ignore = false;
        (async () => {
            try {
                const { records } = await fetchPreferencesList({ patientId, recordType: 'active', preferencesType: 'advance-directives' });
                if (ignore) return;
                setAdOptions(records.filter((r) => r.invalidFlag === 'N' || !r.invalidFlag).map((r) => {
                    const label = (lookups && lookups.find((l) => l.code === r.code)?.label) || r.description || r.code;
                    const docs = r.attachment ? r.attachment.length : 0;
                    return { value: r.id, label: `${label} (${docs} doc(s))` };
                }));
            }
            catch (error) { console.error('Failed to load advance directives.', error); }
        })();
        return () => { ignore = true; };
    }, [preferencesType, patientId, lookups]);

    const update = (patch) => { setDirty(true); setForm((p) => ({ ...p, ...patch })); };
    const clearError = (key) => setErrors((prev) => { if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });

    const validate = () => {
        const next = {};
        if (!form.code) next.title = 'Title is required.';
        if (!form.statusCode) next.statusCode = 'Preferences Status is required.';
        if (!form.effectiveDate) next.effectiveDate = 'Effective Date & Time is required.';
        if (!form.recordedDate) next.recordedDate = 'Recorded Date & Time is required.';
        if (descRequired) {
            // Legacy care/treatment description rule: required, min 2, max 5000 (max enforced by maxLength).
            if (!form.notes.trim()) next.notes = `${descLabel} is required.`;
            else if (form.notes.trim().length < 2) next.notes = 'Minimum 2 characters.';
        }
        if (form.statusCode === 'CANCELLED' && !form.lastEffectiveDate) next.lastEffectiveDate = 'Last Effective Date & Time is required.';
        if (preferencesType === 'advance-directives' && uploaderRef.current && !uploaderRef.current.isValid()) next.attachment = 'Please attach a valid file.';
        return next;
    };

    const buildAttachmentPayload = () => {
        if (preferencesType === 'advance-directives' && uploaderRef.current) {
            const { newFiles, existingFiles, deletedFiles } = uploaderRef.current.getUpdatePayload();
            return [
                ...newFiles.map((f) => ({ ...f, invalidFlag: 'N' })),
                ...existingFiles.map((f) => ({ ...f, invalidFlag: 'N' })),
                ...deletedFiles,
            ];
        }
        return null;
    };

    const doSave = async (deletePreferenceCode = null) => {
        setSaving(true);
        try {
            const payload = buildPreferenceSavePayload({
                preferencesId: record?.id, patientId, preferencesType,
                code: form.code, title: form.title, effectiveDate: form.effectiveDate,
                lastEffectiveDate: form.lastEffectiveDate, recordedDate: form.recordedDate,
                notes: form.notes, statusCode: form.statusCode, attachment: buildAttachmentPayload(),
                advanceDirectiveIds: selectedAds.map((a) => a.value), deletePreferenceCode,
            });
            const response = await savePreference(preferencesType, payload);
            const outcome = getSaveOutcome(response, 'Failed to save or update preference.');
            if (outcome.ok) { markSaved(); notifySuccess(`${PREFERENCES_DESC_MAP[preferencesType]} saved successfully.`); onClose(true); return; }
            setSaveError(outcome);
        }
        catch (error) {
            console.error('Failed to save preference.', error);
            setSaveError({ tone: 'error', message: error?.message || 'Failed to save or update preference.' });
        }
        finally { setSaving(false); }
    };

    const handleSave = async () => {
        setSaveError(null);
        const v = validate();
        setErrors(v);
        if (Object.keys(v).length) return;
        // Legacy save-button intercept: inactivating (Last Effective set) or entering-in-error an advance
        // directive that still has active linked treatment preferences prompts whether to inactivate them too.
        if (isEdit && preferencesType === 'advance-directives' && (form.lastEffectiveDate || form.statusCode === 'ENTERED_ERR')) {
            try {
                const { records } = await fetchPreferencesList({ patientId, recordType: 'active', preferencesType: 'treatment-preferences', advanceDirectiveId: record.id });
                if (records && records.length) {
                    setAdModal({ open: true, linked: records, actionText: form.statusCode === 'ENTERED_ERR' ? 'Delete' : 'Inactivate' });
                    return;
                }
            }
            catch (error) { console.error('Failed to check linked treatment preferences.', error); }
        }
        doSave(null);
    };

    const dateProps = { enableTime: true, dateFormat: 'm-d-Y h:i K', placeholder: 'MM-DD-YYYY HH:MM AM/PM' };
    const lastEffectiveEnabled = form.statusCode === 'CANCELLED';
    const notesCount = (form.notes || '').replace(/\r\n/g, '\n').trimEnd().length;

    return (<div className="pc-patient-Preferences-add-edit-main-container">
      <div className="Preferences-add-edit-header d-flex align-items-center mb-3">
        <LegacyIcon icon="mdi-arrow-left" className="me-3 ehr-preferences-add-edit-back-btn ehr-add-edit-back-btn" role="button" style={{ cursor: 'pointer', fontSize: 22 }} title="Back" onClick={() => onClose(false)}/>
        <span className="pc-add-edit-explanation-detail-label fw-bold" style={{ fontSize: '1rem' }}>{isEdit ? 'Update' : 'Add New'} {PREFERENCES_DESC_MAP[preferencesType]}</span>
      </div>
      <form className="care-plan-data-entry" id={`pc_patient_chart_preferences_form_${patientId}`} autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSave(); }} noValidate>
      {/* Field order/columns mirror the legacy pc_patient_chart_preferences_add_edit_template exactly:
          Title (col-md-4, alone) → Upload Documents (col-md-8, advance directives only) → Description
          (col-12) → Advance Directives to link (treatment only) → Preferences Status | Validating
          Provider | Effective | Last Effective (4× col-md-3) → Recorded Date (col-md-3, alone). */}
      <div className="row g-3 mx-0">
        <div className="col-md-4">
          <label className="form-label fw-bold">{titleLabel} <span className="text-danger">*</span></label>
          <Select classNamePrefix="react-select" placeholder="Select Title" isClearable isDisabled={isEdit} options={titleOptions}
            value={titleOptions.find((o) => o.value === form.code) || null}
            onChange={(o) => { update({ code: o?.value || '', title: o?.label || '' }); clearError('title'); }}/>
          <FieldError message={errors.title}/>
        </div>
      </div>

      {preferencesType === 'advance-directives' && (
        <div className="row g-3 mt-1 mx-0">
          <div className="col-md-8 upload-document-container pc-patient-preferences-history-add-edit-fieldset">
            <label className="form-label fw-bold">Upload Documents</label>
            <UniversalFileUploader ref={uploaderRef} name={`preferences_files_${patientId}`} maxFiles={5} maxSizeMB={5}
              allowedTypes="jpeg,jpg,png,docx,doc,pdf" initialAttachments={record?.attachment || null}
              onChange={() => { setDirty(true); clearError('attachment'); }}/>
            <FieldError message={errors.attachment}/>
          </div>
        </div>
      )}

      <div className="row g-3 mt-1 mx-0">
        <div className="col-12">
          <label className="form-label fw-bold">{descLabel} {descRequired && <span className="text-danger">*</span>}</label>
          <textarea className="form-control" style={{ height: 80 }} maxLength={5000} value={form.notes}
            disabled={isEdit && preferencesType !== 'advance-directives'}
            onChange={(e) => { update({ notes: e.target.value }); clearError('notes'); }}/>
          <div className="d-flex justify-content-between preferences-notes-count-container">
            <div className="preferences-notes-error"><FieldError message={errors.notes}/></div>
            <label className="text-muted small mb-0">({notesCount}/5000)</label>
          </div>
        </div>
      </div>

      {preferencesType === 'treatment-preferences' && (
        <div className="row g-3 mt-1 mx-0 treatment-preferences-advance-directive-container">
          <div className="col-12">
            <label className="form-label fw-bold">Advance Directives to be linked</label>
            <Select classNamePrefix="react-select" isMulti placeholder="Select Advance Directive" options={adOptions}
              value={selectedAds} onChange={(vals) => { setDirty(true); setSelectedAds(vals || []); }}/>
          </div>
        </div>
      )}

      <div className="row g-3 mt-1 mx-0">
        <div className="col-md-3">
          <label className="form-label fw-bold">Preferences Status <span className="text-danger">*</span></label>
          <select className="form-control form-select" value={form.statusCode} onChange={(e) => { update({ statusCode: e.target.value, ...(e.target.value !== 'CANCELLED' ? { lastEffectiveDate: '' } : {}) }); clearError('statusCode'); }}>
            <option value="">Select Status</option>
            {statusOptions.map((s) => <option key={s.code} value={s.code}>{s.description}</option>)}
          </select>
          <FieldError message={errors.statusCode}/>
        </div>
        <div className="col-md-3">
          <label className="form-label fw-bold">Validating Provider</label>
          <input className="form-control" value={providerName} disabled/>
        </div>
        <div className="col-md-3">
          <label className="form-label fw-bold">Effective Date &amp; Time <span className="text-danger">*</span></label>
          <FlatpickrDateTimeInput value={form.effectiveDate} disabled={isEdit} {...dateProps} minDate={dob || undefined} maxDate={nowDateTime()}
            onChange={(v) => { update({ effectiveDate: v }); clearError('effectiveDate'); }}/>
          <FieldError message={errors.effectiveDate}/>
        </div>
        <div className="col-md-3">
          <label className="form-label fw-bold">Last Effective Date &amp; Time {lastEffectiveEnabled && <span className="text-danger">*</span>}</label>
          <FlatpickrDateTimeInput value={form.lastEffectiveDate} disabled={!lastEffectiveEnabled} {...dateProps} minDate={form.effectiveDate || undefined} maxDate={lastEffectiveEnabled ? nowDateTime() : undefined}
            onChange={(v) => { update({ lastEffectiveDate: v }); clearError('lastEffectiveDate'); }}/>
          <FieldError message={errors.lastEffectiveDate}/>
        </div>
      </div>

      <div className="row g-3 mt-1 mx-0">
        <div className="col-md-3">
          <label className="form-label fw-bold">Recorded Date &amp; Time <span className="text-danger">*</span></label>
          <FlatpickrDateTimeInput value={form.recordedDate} {...dateProps} minDate={dob || undefined} maxDate={nowDateTime()}
            onChange={(v) => { update({ recordedDate: v }); clearError('recordedDate'); }}/>
          <FieldError message={errors.recordedDate}/>
        </div>
      </div>

      {saveError && (<div className={`mt-3 small ${saveError.tone === 'warning' ? 'text-warning' : 'text-danger'}`}><LegacyIcon icon="fa-exclamation-triangle" className="me-1"/>{saveError.message}</div>)}

      <FormStatusFooter
        dirty={dirty}
        saving={saving}
        onCancel={() => onClose(false)}
        saveLabel={isEdit ? 'Update' : 'Save'}
      />
      </form>

      <AdvanceDirectiveDeleteModal visible={adModal.open} titleLabel={form.title} actionText={adModal.actionText}
        confirmLabel="Proceed" confirmVariant="primary" linkedPreferences={adModal.linked} treatmentLookups={treatmentLookups}
        onHide={() => setAdModal({ open: false, linked: [], actionText: 'Inactivate' })}
        onConfirm={(code) => { setAdModal({ open: false, linked: [], actionText: 'Inactivate' }); doSave(code); }}/>
    </div>);
};
export default PatientPreferencesAddEdit;
