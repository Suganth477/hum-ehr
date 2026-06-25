import { useEffect, useMemo, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { savePatientAllergy } from '../../../services/allergyService';
import PatientAllergyLookupInput from './PatientAllergyLookupInput';
import PatientAllergiesReactions from './PatientAllergiesReactions';
import FlatpickrDateTimeInput from '../../../components/common/FlatpickrDateTimeInput';
import { useNotify } from '../../../context/NotificationContext';
const VERIFICATION_STATUS = {
    CONFIRMED: 'VERSTSC',
    UNCONFIRMED: 'VERSTSU',
    REFUTED: 'VERSTSR',
    ENTERED_IN_ERROR: 'VERSTSE',
};
const CLINICAL_STATUS = {
    ACTIVE: 'ACTIVE',
    INACTIVE: 'INACTIVE',
    RESOLVED: 'RESOLVED',
};
const createDefaultForm = () => ({
    allergyType: '',
    allergySubType: '',
    allergySubTypeId: '',
    description: '',
    recordedDate: '',
    onsetDate: '',
    endDate: '',
    criticalityId: '',
    verificationStatus: VERIFICATION_STATUS.CONFIRMED,
    clinicalStatus: CLINICAL_STATUS.ACTIVE,
    changeLogNotes: '',
});
const toFlatpickrDateTimeValue = (value) => {
    if (!value)
        return '';
    const stringValue = String(value).trim();
    if (/^\d{2}-\d{2}-\d{4}/.test(stringValue))
        return stringValue;
    const date = new Date(stringValue.replace(' ', 'T'));
    if (Number.isNaN(date.getTime()))
        return stringValue;
    const pad = (input) => String(input).padStart(2, '0');
    let hours = date.getHours();
    const minutes = pad(date.getMinutes());
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    return `${pad(date.getMonth() + 1)}-${pad(date.getDate())}-${date.getFullYear()} ${pad(hours)}:${minutes} ${period}`;
};
const PatientAllergiesAddEdit = ({ patientId, allergyRecord, actionType, recordType, lookups, onClose, }) => {
    const [form, setForm] = useState(createDefaultForm);
    const [reactionsList, setReactionsList] = useState([]);
    const [reactionModal, setReactionModal] = useState(false);
    const [editingReaction, setEditingReaction] = useState(null);
    const [saving, setSaving] = useState(false);
    // Field-level validation errors, keyed by field. Rendered inline beneath
    // each input (server/save failures go to a toast, never the top of the form).
    const [errors, setErrors] = useState({});
    const { notifyError } = useNotify();
    const isEditMode = !!allergyRecord?.allergyId;
    const isRecoverMode = actionType === 'recover';
    const isNKALocked = ['NKA', 'NKDA'].includes(form.allergyType);
    const existingReactionIds = useMemo(() => reactionsList.map((reaction) => reaction.reactionId), [reactionsList]);
    // Field ID helper — per-patient so multiple open charts don't collide.
    const fieldId = (base) => `${base}_${patientId}`;
    useEffect(() => {
        if (!isEditMode || !allergyRecord) {
            setForm(createDefaultForm());
            setReactionsList([]);
            return;
        }
        setForm({
            allergyType: allergyRecord.allergyTypeCode || '',
            allergySubType: allergyRecord.allergySubType || '',
            allergySubTypeId: allergyRecord.allergySubTypeId || '',
            description: allergyRecord.description || '',
            recordedDate: toFlatpickrDateTimeValue(allergyRecord.effectiveDate),
            onsetDate: toFlatpickrDateTimeValue(allergyRecord.onSetDate),
            endDate: toFlatpickrDateTimeValue(allergyRecord.lastEffectiveDate),
            criticalityId: allergyRecord.criticalityId || '',
            verificationStatus: allergyRecord.verificationStatusCode || VERIFICATION_STATUS.CONFIRMED,
            clinicalStatus: allergyRecord.allergyClinicalStatusCode || CLINICAL_STATUS.ACTIVE,
            changeLogNotes: '',
        });
        setReactionsList(allergyRecord.reactionMapping || []);
    }, [allergyRecord, isEditMode]);
    useEffect(() => {
        if (!isNKALocked)
            return;
        setForm((previous) => ({
            ...previous,
            allergySubType: '',
            allergySubTypeId: '',
            criticalityId: '',
            description: previous.allergyType === 'NKDA' ? 'No Known Drug Allergies' : 'No Known Allergies',
            clinicalStatus: CLINICAL_STATUS.ACTIVE,
            verificationStatus: VERIFICATION_STATUS.CONFIRMED,
            endDate: '',
        }));
        setReactionsList([]);
    }, [form.allergyType, isNKALocked]);
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
    };
    const handleClinicalStatusChange = (value) => {
        setForm((previous) => ({
            ...previous,
            clinicalStatus: value,
            endDate: value === CLINICAL_STATUS.ACTIVE ? '' : previous.endDate,
        }));
        clearFieldError('clinicalStatus');
    };
    const validateForm = () => {
        const nextErrors = {};
        if (!form.allergyType)
            nextErrors.allergyType = 'Allergy Type is required.';
        if (!isNKALocked && !form.allergySubTypeId)
            nextErrors.allergySubType = 'Please select Allergy Subtype from the lookup list.';
        if (!isNKALocked && !form.description.trim())
            nextErrors.description = 'Allergy Description is required.';
        if (!isNKALocked && !form.clinicalStatus && form.verificationStatus !== VERIFICATION_STATUS.ENTERED_IN_ERROR)
            nextErrors.clinicalStatus = 'Clinical status is required.';
        if ([CLINICAL_STATUS.INACTIVE, CLINICAL_STATUS.RESOLVED].includes(form.clinicalStatus) && !form.endDate)
            nextErrors.endDate = 'Date of Resolution is required.';
        if (form.endDate && !form.onsetDate)
            nextErrors.onsetDate = 'Onset Date and time is required when Date of Resolution is entered.';
        if (!form.changeLogNotes.trim())
            nextErrors.changeLogNotes = 'Change log message is required.';
        return nextErrors;
    };
    const buildSavePayload = () => ({
        activeFlag: recordType === 'history' ? 'N' : 'Y',
        patientId,
        careplanId: allergyRecord?.careplanId || null,
        allergyId: allergyRecord?.allergyId || null,
        allergyType: form.allergyType,
        allergySubType: isNKALocked ? null : form.allergySubType,
        allergySubTypeId: isNKALocked ? null : form.allergySubTypeId,
        description: form.description?.trim() || null,
        effectiveDate: form.recordedDate || null,
        lastEffectiveDate: form.endDate || null,
        onSetDate: form.onsetDate || null,
        criticalityId: isNKALocked ? null : form.criticalityId || null,
        verificationStatusCode: form.verificationStatus || null,
        allergyClinicalStatusCode: isNKALocked ? CLINICAL_STATUS.ACTIVE : form.clinicalStatus || null,
        allergyClinicalstatus: isNKALocked ? CLINICAL_STATUS.ACTIVE : form.clinicalStatus || null,
        reactionMapping: isNKALocked ? [] : reactionsList,
        allergyReactions: isNKALocked ? [] : reactionsList,
        PatientLogMessageUserInput: form.changeLogNotes.trim(),
        PatientLogMessage: form.changeLogNotes.trim(),
        actionType,
    });
    const handleFormSubmit = async (event) => {
        event.preventDefault();
        const validationErrors = validateForm();
        setErrors(validationErrors);
        if (Object.keys(validationErrors).length)
            return;
        setSaving(true);
        try {
            const response = await savePatientAllergy(buildSavePayload());
            if (!response || response.status === 'success')
                onClose(true);
            else
                notifyError(response.message || 'Failed to save allergy.');
        }
        catch (error) {
            console.error('Failed to save allergy.', error);
            notifyError(error?.message || 'Failed to save allergy. Please try again.');
        }
        finally {
            setSaving(false);
        }
    };
    const openReactionModal = (reaction = null) => {
        setEditingReaction(reaction);
        setReactionModal(true);
    };
    const handleSaveReaction = (reaction) => {
        setReactionsList((previous) => {
            const existingIndex = previous.findIndex((item) => String(item.reactionId) === String(reaction.reactionId));
            if (existingIndex === -1)
                return [...previous, reaction];
            return previous.map((item, index) => (index === existingIndex ? { ...item, ...reaction } : item));
        });
        setReactionModal(false);
        setEditingReaction(null);
    };
    const handleDeleteReaction = (reactionId) => {
        setReactionsList((previous) => previous.filter((item) => String(item.reactionId) !== String(reactionId)));
    };
    const renderWarningMessages = () => {
        if (isNKALocked)
            return null;
        return (<div id={fieldId('pa_patient_allergy_warning_message_container')} className="mt-2 small">
        <div id={fieldId('pa_clinical_status_mandatory')} className="alert-message d-none">Clinical status is mandatory.</div>
        {form.verificationStatus === VERIFICATION_STATUS.ENTERED_IN_ERROR && (<div className="alert-message text-danger" id={fieldId('pa_entered_error_warning_message')}><i className="fa fa-exclamation-triangle me-1"/>This Allergy Was Entered in Error.</div>)}
        {form.clinicalStatus === CLINICAL_STATUS.INACTIVE && form.verificationStatus === VERIFICATION_STATUS.REFUTED && (<div className="alert-message text-warning" id={fieldId('pa_inactive_refuted_warning_message')}><i className="fa fa-exclamation-triangle me-1"/>This Allergy was marked as Inactive or Refuted.</div>)}
        {form.clinicalStatus === CLINICAL_STATUS.RESOLVED && form.verificationStatus === VERIFICATION_STATUS.UNCONFIRMED && (<div className="alert-message text-warning" id={fieldId('pa_resolved_unconfirmed_warning_message')}><i className="fa fa-exclamation-triangle me-1"/>This Allergy was marked as Resolved or Unconfirmed.</div>)}
        {form.clinicalStatus === CLINICAL_STATUS.RESOLVED && form.verificationStatus === VERIFICATION_STATUS.REFUTED && (<div className="alert-message text-warning" id={fieldId('pa_resolved_refuted_warning_message')}><i className="fa fa-exclamation-triangle me-1"/>This Allergy was marked as Resolved or Refuted.</div>)}
      </div>);
    };
    return (<div className="pa-allergies-add-edit-main-container container-fluid animate-fade-in bg-white p-3 border rounded">
      <div className="row mb-2 border-bottom pb-2">
        <div className="d-flex align-items-center gap-2">
          <button type="button" className="pc-move-list-back back-to-icon btn btn-link p-0 text-dark" onClick={() => onClose(false)} aria-label="Back to allergies list">
            <span className="mdi mdi-arrow-left custom-pointer fs-4"/>
          </button>
          <span className="fw-bold pa-allergies-add-edit-container-title">
            {isRecoverMode ? 'Recover Allergy' : isEditMode ? 'Edit Allergy' : 'Add Allergy'}
          </span>
        </div>
      </div>

      <form id={fieldId('pa_patient_allergy_add_edit_form')} className="auto-save-form care-plan-data-entry" onSubmit={handleFormSubmit} noValidate>
        <input type="hidden" id={fieldId('pa_patient_allergy_unique_id')} value={allergyRecord?.allergyId || ''} readOnly/>
        <input type="hidden" id={fieldId('pa_patient_allergy_unique_validation')} value={isNKALocked || reactionsList.length || form.allergySubTypeId ? 1 : 0} readOnly/>
        <div className="row g-3">
          <div className="col-md-4">
            <label className="form-label fw-bold" htmlFor={fieldId('pa_patient_allergy_type')}>Allergy Type <span className="text-danger">*</span></label>
            <select id={fieldId('pa_patient_allergy_type')} className="form-select form-control" value={form.allergyType} onChange={(event) => updateForm('allergyType', event.target.value)} disabled={isEditMode} required>
              <option value="">Select Type</option>
              {lookups.allergyTypes.map((type) => <option key={type.code} value={type.code}>{type.description}</option>)}
            </select>
            {errors.allergyType && <div className="small text-danger mt-1">{errors.allergyType}</div>}
          </div>

          <div className="col-md-4">
            <PatientAllergyLookupInput id={fieldId('pa_patient_allergy_sub_type')} label="Allergy Subtype" conceptCategory="ALST" value={form.allergySubType} disabled={isNKALocked} required placeholder="Type at least 3 characters, then choose from list" onChange={(value) => { setForm((previous) => ({ ...previous, allergySubType: value, allergySubTypeId: '' })); clearFieldError('allergySubType'); }} onSelect={(selected) => { setForm((previous) => ({ ...previous, allergySubType: selected.value, allergySubTypeId: selected.id })); clearFieldError('allergySubType'); }}/>
            {(errors.allergySubType || (!isNKALocked && form.allergySubType?.length >= 3 && !form.allergySubTypeId)) && (<div className="small text-danger mt-1">Please select Allergy Subtype from the lookup list.</div>)}
          </div>

          <div className="col-md-4">
            <label className="form-label fw-bold" htmlFor={fieldId('pa_patient_allergy_criticality')}>Criticality</label>
            <select id={fieldId('pa_patient_allergy_criticality')} className="form-select form-control" value={form.criticalityId} onChange={(event) => updateForm('criticalityId', event.target.value)} disabled={isNKALocked}>
              <option value="">Select Criticality</option>
              {lookups.criticalities.map((criticality) => <option key={criticality.id} value={criticality.id}>{criticality.conceptName}</option>)}
            </select>
          </div>
        </div>

        <div className="row g-3 mt-2">
          <div className="col-md-4">
            <label className="fw-bold d-block mb-1">Clinical Reaction</label>
            <button type="button" className="btn btn-primary border-radius-button pa-allergies-add-reaction-btn w-100" disabled={isNKALocked} onClick={() => openReactionModal()}>
              Add Reaction
            </button>
            {isNKALocked && (<div className="alert-message mt-2 small text-warning" id={fieldId('pa_allergy_no_known_allergies_or_drug_allergies')}>
                <i className="fa fa-exclamation-triangle me-1"/>Reactions cannot be added when NKA/NKDA is selected.
              </div>)}
            <div className="pa-allergies-show-added-reaction-list-container mt-2">
              {reactionsList.length === 0 && !isNKALocked && <div className="small text-muted p-2 border rounded">No reactions added.</div>}
              {reactionsList.map((reaction) => (<div key={reaction.reactionId} className="pa-patient-selected-allergies-reaction-list-wrapper p-2 mb-2 shadow-sm small">
                  <div className="d-flex justify-content-between align-items-center">
                    <span><strong>{reaction.reaction}</strong> ({reaction.severity || '-'})</span>
                    <span className="d-flex gap-2">
                      <button type="button" className="btn btn-link p-0" onClick={() => openReactionModal(reaction)} title="Edit reaction"><i className="fa-regular fa-pencil"/></button>
                      <button type="button" className="btn btn-link p-0 text-danger" onClick={() => handleDeleteReaction(reaction.reactionId)} title="Delete reaction"><i className="fa-regular fa-trash-can"/></button>
                    </span>
                  </div>
                  {(reaction.lastOccuranceDate || reaction.notes) && (<div className="pa-reaction-detail-panel mt-2 pt-2 border-top">
                      {reaction.lastOccuranceDate && <div><span className="label-name">Last Occurrence: </span>{reaction.lastOccuranceDate}</div>}
                      {reaction.notes && <div><span className="label-name">Notes: </span>{reaction.notes}</div>}
                    </div>)}
                </div>))}
            </div>
          </div>

          <div className="col-md-4">
            <label className="form-label fw-bold" htmlFor={fieldId('pa_patient_allergy_clinical_status')}>Clinical Status {!isNKALocked && <span className="text-danger">*</span>}</label>
            <select id={fieldId('pa_patient_allergy_clinical_status')} className="form-select form-control pa-clinical-status" value={form.clinicalStatus} onChange={(event) => handleClinicalStatusChange(event.target.value)} disabled={isNKALocked} required={!isNKALocked}>
              <option value="">Select Status</option>
              {lookups.clinicalStatuses.map((status) => <option key={status.code} value={status.code}>{status.description}</option>)}
            </select>
            {errors.clinicalStatus && <div className="small text-danger mt-1">{errors.clinicalStatus}</div>}
          </div>

          <div className="col-md-4">
            <label className="form-label fw-bold" htmlFor={fieldId('pa_patient_allergy_verification_status')}>Verification Status</label>
            <select id={fieldId('pa_patient_allergy_verification_status')} className="form-select form-control" value={form.verificationStatus} onChange={(event) => updateForm('verificationStatus', event.target.value)} disabled={isNKALocked}>
              <option value="">Select Verification Status</option>
              {lookups.verificationStatuses.map((status) => <option key={status.code || status.id} value={status.code}>{status.conceptName || status.description}</option>)}
            </select>
            {renderWarningMessages()}
          </div>
        </div>

        <div className="row g-3 mt-2">
          <div className="col-md-4">
            <label className="form-label fw-bold" htmlFor={fieldId('pa_patient_allergy_onset_date')}>Onset Date &amp; Time</label>
            <FlatpickrDateTimeInput id={fieldId('pa_patient_allergy_onset_date')} value={form.onsetDate} onChange={(value) => updateForm('onsetDate', value)} enableTime dateFormat="m-d-Y h:i K" placeholder="MM-DD-YYYY hh:mm AM/PM"/>
            {errors.onsetDate && <div className="small text-danger mt-1">{errors.onsetDate}</div>}
          </div>
          <div className="col-md-4">
            <label className="form-label fw-bold" htmlFor={fieldId('pa_patient_allergy_recorded_date')}>Recorded Date &amp; Time</label>
            <FlatpickrDateTimeInput id={fieldId('pa_patient_allergy_recorded_date')} value={form.recordedDate} onChange={(value) => updateForm('recordedDate', value)} enableTime dateFormat="m-d-Y h:i K" placeholder="MM-DD-YYYY hh:mm AM/PM"/>
          </div>
          <div className="col-md-4">
            <label className="form-label fw-bold" htmlFor={fieldId('pa_patient_allergy_end_date')}>Date of Resolution</label>
            <FlatpickrDateTimeInput id={fieldId('pa_patient_allergy_end_date')} value={form.endDate} onChange={(value) => updateForm('endDate', value)} enableTime dateFormat="m-d-Y h:i K" placeholder="MM-DD-YYYY hh:mm AM/PM" disabled={form.clinicalStatus === CLINICAL_STATUS.ACTIVE || isNKALocked}/>
            {errors.endDate && <div className="small text-danger mt-1">{errors.endDate}</div>}
          </div>
        </div>

        <div className="row g-3 mt-2">
          <div className="col-md-12">
            <label className="form-label fw-bold" htmlFor={fieldId('pa_patient_allergy_description')}>Description {!isNKALocked && <span className="text-danger">*</span>}</label>
            <textarea id={fieldId('pa_patient_allergy_description')} className="form-control" style={{ height: 115 }} value={form.description} onChange={(event) => updateForm('description', event.target.value)} disabled={isNKALocked} maxLength={5000} required={!isNKALocked}/>
            <div className="small text-muted text-end">{form.description?.length || 0}/5000</div>
            {errors.description && <div className="small text-danger mt-1">{errors.description}</div>}
          </div>
          <div className="col-md-12">
            <label className="form-label fw-bold text-danger" htmlFor={fieldId('pa_patient_allergy_change_log_message')}>Audit Change Log Message <span className="text-danger">*</span></label>
            <input type="text" className="form-control border-danger" id={fieldId('pa_patient_allergy_change_log_message')} value={form.changeLogNotes} onChange={(event) => updateForm('changeLogNotes', event.target.value)} placeholder="Reason required for clinical audit logs" required/>
            {errors.changeLogNotes && <div className="small text-danger mt-1">{errors.changeLogNotes}</div>}
          </div>
        </div>

        <div className="row mt-4 pt-3 border-top m-0">
          <div className="form-add-edit-button-group d-flex justify-content-end gap-2 p-0">
            <button type="button" className="btn btn-secondary px-4 rounded-pill bs-modal-cancel-btn" onClick={() => onClose(false)} disabled={saving}>Cancel</button>
            <button type="submit" className="btn btn-primary px-4 rounded-pill bs-modal-save-btn" disabled={saving}>{saving ? 'Saving...' : isRecoverMode ? 'Recover Allergy' : 'Save Allergy'}</button>
          </div>
        </div>
      </form>

      <Dialog visible={reactionModal} onHide={() => { setReactionModal(false); setEditingReaction(null); }} header={editingReaction ? 'Edit Allergy Reaction Profile' : 'Add Allergy Reaction Profile'} style={{ width: '520px' }} breakpoints={{ '768px': '95vw' }}>
        <PatientAllergiesReactions patientId={patientId} lookups={lookups} existingReactionIds={existingReactionIds} editReaction={editingReaction} onSave={handleSaveReaction} onCancel={() => { setReactionModal(false); setEditingReaction(null); }}/>
      </Dialog>
    </div>);
};
export default PatientAllergiesAddEdit;
