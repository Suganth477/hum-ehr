import { useEffect, useState } from 'react';
import PatientAllergyLookupInput from './PatientAllergyLookupInput';
import FlatpickrDateTimeInput from '../../../components/common/FlatpickrDateTimeInput';
const EMPTY_FORM = {
    id: '',
    reactionText: '',
    reactionId: '',
    severityId: '',
    lastOccurrence: '',
    notes: '',
};
const PatientAllergiesReactions = ({ patientId, lookups, existingReactionIds = [], editReaction = null, onSave, onCancel, }) => {
    const [rxForm, setRxForm] = useState(EMPTY_FORM);
    const [errors, setErrors] = useState({});
    const clearFieldError = (key) => setErrors((previous) => {
        if (!previous[key])
            return previous;
        const next = { ...previous };
        delete next[key];
        return next;
    });
    useEffect(() => {
        if (!editReaction)
            return;
        setRxForm({
            id: editReaction.id || '',
            reactionText: editReaction.reaction || '',
            reactionId: editReaction.reactionId || '',
            severityId: editReaction.severityId || '',
            lastOccurrence: editReaction.lastOccuranceDate || editReaction.lastOccurrence || '',
            notes: editReaction.notes || '',
        });
    }, [editReaction]);
    const validateForm = () => {
        const nextErrors = {};
        if (!rxForm.reactionText.trim())
            nextErrors.reaction = 'Reaction is required.';
        else if (!rxForm.reactionId)
            nextErrors.reaction = 'Please select reaction from the lookup list.';
        if (!rxForm.severityId)
            nextErrors.severity = 'Severity is required.';
        return nextErrors;
    };
    const handleSave = (event) => {
        event.preventDefault();
        const validationErrors = validateForm();
        setErrors(validationErrors);
        if (Object.keys(validationErrors).length)
            return;
        const matchedSeverity = lookups.severities.find((item) => String(item.id) === String(rxForm.severityId));
        onSave({
            id: rxForm.id || '',
            reactionId: rxForm.reactionId,
            reaction: rxForm.reactionText.trim(),
            severityId: rxForm.severityId,
            severity: matchedSeverity?.conceptName || '',
            lastOccuranceDate: rxForm.lastOccurrence || '',
            notes: rxForm.notes?.trim() || '',
        });
    };
    return (<form onSubmit={handleSave} className="p-2 bg-light-subtle rounded animate-fade-in" noValidate>
      <div className="row g-3">
        <div className="col-12 icon-input-group position-relative">
          <PatientAllergyLookupInput id={`pa_patient_allergy_reaction_${patientId}`} label="Reaction" conceptCategory="ALRE" value={rxForm.reactionText} required disabled={!!editReaction?.id} excludeIds={existingReactionIds.filter((id) => String(id) !== String(editReaction?.reactionId))} placeholder="Type at least 3 characters, then choose from list" onChange={(value) => { setRxForm((previous) => ({ ...previous, reactionText: value, reactionId: '' })); clearFieldError('reaction'); }} onSelect={(selected) => { setRxForm((previous) => ({ ...previous, reactionText: selected.value, reactionId: selected.id })); clearFieldError('reaction'); }}/>
          {errors.reaction ? (<div className="small text-danger mt-1">{errors.reaction}</div>) : (!rxForm.reactionId && rxForm.reactionText?.length >= 3 && (<div className="small text-danger mt-1">Please select reaction from the lookup list.</div>))}
        </div>

        <div className="col-md-6">
          <label className="form-label small fw-bold" htmlFor={`pa_patient_allergy_severity_${patientId}`}>
            Severity <span className="text-danger">*</span>
          </label>
          <select className="form-select" id={`pa_patient_allergy_severity_${patientId}`} value={rxForm.severityId} onChange={(event) => { setRxForm((previous) => ({ ...previous, severityId: event.target.value })); clearFieldError('severity'); }} required>
            <option value="">Select Severity</option>
            {lookups.severities.map((severity) => (<option key={severity.id} value={severity.id}>{severity.conceptName}</option>))}
          </select>
          {errors.severity && <div className="small text-danger mt-1">{errors.severity}</div>}
        </div>

        <div className="col-md-6">
          <label className="form-label small fw-bold" htmlFor={`pa_patient_allergy_last_occurrence_date_${patientId}`}>
            Last Occurrence Date
          </label>
          <FlatpickrDateTimeInput id={`pa_patient_allergy_last_occurrence_date_${patientId}`} value={rxForm.lastOccurrence} onChange={(value) => setRxForm((previous) => ({ ...previous, lastOccurrence: value }))} enableTime={false} dateFormat="m-d-Y" placeholder="MM-DD-YYYY"/>
        </div>

        <div className="col-12">
          <label className="form-label small fw-bold" htmlFor={`pa_patient_allergy_reaction_notes_${patientId}`}>
            Notes
          </label>
          <textarea id={`pa_patient_allergy_reaction_notes_${patientId}`} className="form-control font-13" rows={2} maxLength={500} value={rxForm.notes} onChange={(event) => setRxForm((previous) => ({ ...previous, notes: event.target.value }))}/>
        </div>
      </div>

      <div className="d-flex justify-content-end gap-2 border-top pt-3 mt-4">
        <button type="button" className="btn btn-sm btn-outline-secondary bs-modal-cancel-btn" onClick={onCancel}>Cancel</button>
        <button type="submit" className="btn btn-sm btn-primary pc-allergy-reaction-details-add-btn px-3">Save Reaction</button>
      </div>
    </form>);
};
export default PatientAllergiesReactions;
