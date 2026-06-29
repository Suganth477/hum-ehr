import { useEffect, useState } from 'react';
import AsyncSelect from 'react-select/async';
import { fetchAllergyLookup } from '../../../services/lookupService';
import { LOOKUP_MIN_CHARS } from '../../../constants/timing';
import FlatpickrDateTimeInput from '../../../components/common/FlatpickrDateTimeInput';

const EMPTY_FORM = {
    id: '',
    reactionText: '',
    reactionId: '',
    severityId: '',
    lastOccurrence: '',
    notes: '',
};

const PatientAllergiesReactions = ({ patientId, lookups, existingReactionIds = [], editReaction = null, onSave, onCancel }) => {
    const [rxForm, setRxForm] = useState(EMPTY_FORM);
    const [errors, setErrors] = useState({});

    const clearError = (key) => setErrors((prev) => { const next = { ...prev }; delete next[key]; return next; });

    useEffect(() => {
        if (!editReaction) { setRxForm(EMPTY_FORM); return; }
        setRxForm({
            id: editReaction.id || '',
            reactionText: editReaction.reaction || '',
            reactionId: editReaction.reactionId || '',
            severityId: editReaction.severityId || '',
            lastOccurrence: editReaction.lastOccuranceDate || editReaction.lastOccurrence || '',
            notes: editReaction.notes || '',
        });
    }, [editReaction]);

    const loadReactionOptions = (inputValue) => {
        if (!inputValue || inputValue.trim().length < LOOKUP_MIN_CHARS) return Promise.resolve([]);
        return fetchAllergyLookup({ conceptCategory: 'ALRE', searchParameter: inputValue.trim() })
            .then((res) => {
                const items = res?.status === 'success' ? res.data || [] : [];
                return items
                    .filter((item) => !existingReactionIds.includes(String(item.id)) || String(item.id) === String(editReaction?.reactionId))
                    .map((item) => ({ value: String(item.id), label: item.conceptName || item.value || '', code: item.code }));
            })
            .catch(() => []);
    };

    const validate = () => {
        const errs = {};
        if (!rxForm.reactionText.trim()) errs.reaction = 'Reaction is required.';
        else if (!rxForm.reactionId) errs.reaction = 'Please select reaction from the search list.';
        if (!rxForm.severityId) errs.severity = 'Severity is required.';
        return errs;
    };

    const handleSave = (event) => {
        event.preventDefault();
        const errs = validate();
        setErrors(errs);
        if (Object.keys(errs).length) return;
        const matchedSeverity = lookups.severities.find((s) => String(s.id) === String(rxForm.severityId));
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

    const reactionSelectValue = rxForm.reactionId
        ? { value: rxForm.reactionId, label: rxForm.reactionText }
        : null;

    const selectErrorStyles = (hasError) => ({
        control: (base, state) => ({
            ...base,
            borderColor: hasError ? '#dc3545' : state.isFocused ? '#1D9CA6' : '#ced4da',
            boxShadow: hasError
                ? '0 0 0 0.2rem rgba(220,53,69,.25)'
                : state.isFocused ? '0 0 0 0.2rem rgba(29,156,166,.2)' : 'none',
            '&:hover': { borderColor: hasError ? '#dc3545' : '#1D9CA6' },
        }),
    });

    return (
        <form onSubmit={handleSave} noValidate>
            <div className="row g-3">
                <div className="col-12">
                    <label className="form-label fw-bold" htmlFor={`pa_rx_reaction_${patientId}`}>
                        Reaction <span className="text-danger">*</span>
                    </label>
                    <AsyncSelect
                        inputId={`pa_rx_reaction_${patientId}`}
                        cacheOptions
                        defaultOptions={false}
                        loadOptions={loadReactionOptions}
                        value={reactionSelectValue}
                        onChange={(selected) => {
                            setRxForm((prev) => ({
                                ...prev,
                                reactionText: selected ? selected.label : '',
                                reactionId: selected ? selected.value : '',
                            }));
                            clearError('reaction');
                        }}
                        isDisabled={!!editReaction?.id}
                        isClearable
                        placeholder="Type at least 3 characters, then choose from list"
                        noOptionsMessage={({ inputValue }) =>
                            !inputValue || inputValue.length < LOOKUP_MIN_CHARS
                                ? `Type at least ${LOOKUP_MIN_CHARS} characters to search`
                                : 'No results found'
                        }
                        loadingMessage={() => 'Searching…'}
                        classNamePrefix="react-select"
                        styles={selectErrorStyles(!!errors.reaction)}
                    />
                    {errors.reaction && <div className="small text-danger mt-1">{errors.reaction}</div>}
                </div>

                <div className="col-md-6">
                    <label className="form-label fw-bold" htmlFor={`pa_rx_severity_${patientId}`}>
                        Severity <span className="text-danger">*</span>
                    </label>
                    <select
                        id={`pa_rx_severity_${patientId}`}
                        className={`form-select ${errors.severity ? 'is-invalid' : ''}`}
                        value={rxForm.severityId}
                        onChange={(e) => { setRxForm((prev) => ({ ...prev, severityId: e.target.value })); clearError('severity'); }}
                    >
                        <option value="">Select Severity</option>
                        {lookups.severities.map((s) => (
                            <option key={s.id} value={s.id}>{s.conceptName}</option>
                        ))}
                    </select>
                    {errors.severity && <div className="small text-danger mt-1">{errors.severity}</div>}
                </div>

                <div className="col-md-6">
                    <label className="form-label fw-bold" htmlFor={`pa_rx_last_occurrence_${patientId}`}>
                        Last Occurrence Date &amp; Time
                    </label>
                    <FlatpickrDateTimeInput
                        id={`pa_rx_last_occurrence_${patientId}`}
                        value={rxForm.lastOccurrence}
                        onChange={(value) => setRxForm((prev) => ({ ...prev, lastOccurrence: value }))}
                        enableTime
                        dateFormat="m-d-Y h:i K"
                        placeholder="MM-DD-YYYY hh:mm AM/PM"
                    />
                </div>

                <div className="col-12">
                    <label className="form-label fw-bold" htmlFor={`pa_rx_notes_${patientId}`}>Notes</label>
                    <textarea
                        id={`pa_rx_notes_${patientId}`}
                        className="form-control"
                        rows={4}
                        maxLength={500}
                        value={rxForm.notes}
                        onChange={(e) => setRxForm((prev) => ({ ...prev, notes: e.target.value }))}
                    />
                </div>
            </div>

            <div className="d-flex justify-content-end gap-2 border-top pt-3 mt-3">
                <button type="button" className="btn btn-outline-secondary border-radius-button px-4" onClick={onCancel}>
                    Cancel
                </button>
                <button type="submit" className="btn btn-primary border-radius-button px-4">
                    {editReaction ? 'Save Reaction' : 'Add'}
                </button>
            </div>
        </form>
    );
};

export default PatientAllergiesReactions;
