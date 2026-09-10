import { useEffect, useMemo, useState } from 'react';
import { userNow } from '../../../utils/dayjs';
import Select from 'react-select';
import { savePatientGoal, saveSdohGoal } from '../../../services/goalService';
import { fetchPatientDetails } from '../../../services/patientService';
import patientCache from '../../../utils/patientCache';
import { getSaveOutcome } from '../../../utils/saveResponse';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import FlatpickrDateTimeInput from '../../../components/common/FlatpickrDateTimeInput';
import FormStatusFooter from '../../../components/common/FormStatusFooter';

const RANGE_OPTIONS = [
    { value: '>', label: 'Greater Than' },
    { value: '<', label: 'Less Than' },
    { value: '=', label: 'Equal To' },
    { value: 'IN_BETWEEN', label: 'In Between' },
];
const COMPLETED_REQUIRED_STATUSES = ['COMPLETED', 'CANCELLED'];
const onlyNumbersWithDecimals = (value) => /^\d*\.?\d*$/.test(value);

const createDefaultForm = () => ({
    id: '', code: '', groupCode: '', selectedGoalName: '', goalNameLabel: '',
    conditionOneType: '', conditionTwoType: '',
    frequencyType: '', frequencyValue: '',
    conditionOne: '', conditionOneValue: '', conditionOneValue2: '', conditionOneValueUnit: '',
    conditionTwo: '', conditionTwoValue: '', conditionTwoValue2: '', conditionTwoValueUnit: '',
    allowPatientToEdit: false,
    status: 'ACTIVE',
    startDate: '', completedDate: '', recordedDate: '', description: '',
});

// Per-goal range-option rules (legacy showHideLessThanAndEqualToOptionsForSleep / ...Gexe...).
const rangeOptionsFor = (groupCode, code) => {
    let options = RANGE_OPTIONS;
    if (groupCode === 'UNSL' && code === 'UNSL')
        options = options.filter((option) => !['=', '<'].includes(option.value));
    if (groupCode === 'GEXE' && code !== 'GEXE')
        options = options.filter((option) => !['IN_BETWEEN', '<'].includes(option.value));
    return options;
};

// Legacy filterGoalStatuses: add ⇒ ACTIVE/COMPLETED; edit ⇒ transitions from current.
const filterStatuses = (statuses, currentStatus, isEdit) => {
    let allowed = ['ACTIVE', 'COMPLETED'];
    if (isEdit) {
        const transitions = { ACTIVE: ['ACTIVE', 'COMPLETED', 'CANCELLED', 'ENTERED_ERR'] };
        allowed = transitions[currentStatus] || (currentStatus ? [currentStatus] : []);
    }
    return statuses.filter((status) => allowed.includes(status.code));
};

const PatientGoalsAddEdit = ({ patientId, goalType, goal, referenceData, onClose }) => {
    const isSdoh = goalType === 'sdoh-goals';
    const isEdit = !!goal?.goalId;
    const [form, setForm] = useState(createDefaultForm);
    const [frequencyOptions, setFrequencyOptions] = useState([]);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [dob, setDob] = useState('');
    const [dirty, setDirty] = useState(false);
    // Start/Completed/Recorded dates: floor at patient DOB, cap at now (legacy data-min/max).
    const dateMax = isSdoh ? userNow().format('MM-DD-YYYY hh:mm A') : userNow().format('MM-DD-YYYY');
    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                let details = patientCache.get(`${patientId}_details`);
                if (!details) {
                    const response = await fetchPatientDetails(patientId);
                    details = response?.status === 'success' ? response.data?.patientDetails : null;
                }
                if (!ignore && details?.dateOfBirth) setDob(details.dateOfBirth);
            }
            catch (error) { console.error('Failed to load patient details.', error); }
        })();
        return () => { ignore = true; };
    }, [patientId]);

    const autocompleteSource = isSdoh ? referenceData.sdohGoalsAutoCompleteSource : referenceData.patientGoalsAutoCompleteSource;
    const goalOptions = useMemo(() => (autocompleteSource || []).map((item) => ({ value: item.id, label: item.value, itemDetails: item.itemDetails })), [autocompleteSource]);
    const statusOptions = useMemo(() => filterStatuses(referenceData.goalStatusCodes || [], goal?.statusCode, isEdit), [referenceData.goalStatusCodes, goal, isEdit]);

    const update = (patch) => { setDirty(true); setForm((previous) => ({ ...previous, ...patch })); };
    const clearError = (key) => setErrors((previous) => { if (!previous[key]) return previous; const next = { ...previous }; delete next[key]; return next; });

    // ---- populate condition/frequency state from a selected/saved goal definition ----
    const applyGoalDefinition = (def, saved) => {
        const patch = {
            code: def?.code ?? (saved ? (goal.goalCode || goal.code) : ''),
            groupCode: def?.groupCode ?? (saved ? (goal.goalGroupCode || goal.groupCode) : ''),
            conditionOneType: def?.goalValueTypeCode1 ?? (saved ? goal.goalValueTypeCode1 : ''),
            conditionTwoType: def?.goalValueTypeCode2 ?? (saved ? goal.goalValueTypeCode2 : ''),
        };
        // Condition one
        if (patch.conditionOneType === 'NUMERIC') {
            patch.conditionOne = saved ? (goal.numCondition1 || '') : (def?.goalDefaultCondition1 || '');
            if (patch.conditionOne === 'IN_BETWEEN') {
                patch.conditionOneValue = saved ? (goal.minValue1 || '') : (def?.goalDefaultValue1 || '');
                patch.conditionOneValue2 = saved ? (goal.maxValue1 || '') : '';
            }
            else {
                patch.conditionOneValue = saved ? (goal.numValue1 || goal.textValue1 || '') : (def?.goalDefaultValue1 || '');
                patch.conditionOneValue2 = '';
            }
            patch.conditionOneValueUnit = saved ? (goal.valueUnit1 || '') : (def?.goalValueUnit1 || '');
        }
        else {
            patch.conditionOne = ''; patch.conditionOneValue = ''; patch.conditionOneValue2 = ''; patch.conditionOneValueUnit = '';
        }
        // Condition two
        if (patch.conditionTwoType === 'NUMERIC') {
            patch.conditionTwo = saved ? (goal.numCondition2 || '') : (def?.goalDefaultCondition2 || '');
            if (patch.conditionTwo === 'IN_BETWEEN') {
                patch.conditionTwoValue = saved ? (goal.minValue2 || '') : (def?.goalDefaultValue2 || '');
                patch.conditionTwoValue2 = saved ? (goal.maxValue2 || '') : '';
            }
            else {
                patch.conditionTwoValue = saved ? (goal.numValue2 || goal.textValue2 || '') : (def?.goalDefaultValue2 || '');
                patch.conditionTwoValue2 = '';
            }
            patch.conditionTwoValueUnit = saved ? (goal.valueUnit2 || '') : (def?.goalValueUnit2 || '');
        }
        else {
            patch.conditionTwo = ''; patch.conditionTwoValue = ''; patch.conditionTwoValue2 = ''; patch.conditionTwoValueUnit = '';
        }
        // Frequency (only when condition one is NUMERIC and the goal defines a frequency list)
        if (patch.conditionOneType === 'NUMERIC' && def?.frequencyList?.length) {
            setFrequencyOptions(def.frequencyList);
            const defaultFreq = def.frequencyList.find((frequency) => frequency.defaultFrequencySelectorFlag === 'Y');
            patch.frequencyType = saved ? (goal.frequencyCode || '') : (defaultFreq?.code || '');
            patch.frequencyValue = saved ? (goal.frequencyValue || '') : (defaultFreq?.defaultFrequencyValue || '');
        }
        else {
            setFrequencyOptions([]);
            patch.frequencyType = ''; patch.frequencyValue = '';
        }
        return patch;
    };

    // Initialize (add: recorded date defaults to now; edit: populate from the saved record).
    useEffect(() => {
        const now = isSdoh ? userNow().format('MM-DD-YYYY hh:mm A') : userNow().format('MM-DD-YYYY');
        if (!isEdit) {
            setForm({ ...createDefaultForm(), recordedDate: now });
            setFrequencyOptions([]);
            return;
        }
        const fullDesc = isSdoh
            ? (goal.sdohGoalCodeDescription || goal.description || goal.goalName || '')
            : `${goal.goalName || ''} ${(goal.goalDescription || goal.description) ? `- ${goal.goalDescription || goal.description}` : ''}`.trim();
        const base = {
            ...createDefaultForm(),
            id: goal.goalId,
            selectedGoalName: goal.goalName || fullDesc,
            goalNameLabel: fullDesc || goal.goalName,
            allowPatientToEdit: goal.isPatientEditable === 'Y',
            status: goal.statusCode || 'ACTIVE',
            startDate: goal.effectiveDate || '',
            completedDate: goal.lastEffectiveDate || '',
            recordedDate: goal.recordedDate || now,
            // Legacy SED fix: the description lives in goalNotes, falling back to notes.
            description: goal.goalNotes || goal.notes || '',
        };
        if (isSdoh) {
            setForm({ ...base, code: goal.sdohGoalCode || '' });
            setFrequencyOptions([]);
        }
        else {
            const def = (referenceData.goalTypeListDetails || []).find((item) => item.code === (goal.goalCode || goal.code));
            setForm({ ...base, ...applyGoalDefinition(def, true) });
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [goal, isEdit, isSdoh]);

    const onGoalSelected = (option) => {
        setDirty(true);
        setSaveError(null);
        clearError('code');
        if (!option) {
            setForm((previous) => ({ ...previous, code: '', groupCode: '', selectedGoalName: '', goalNameLabel: '', conditionOneType: '', conditionTwoType: '', conditionOne: '', conditionOneValue: '', conditionOneValue2: '', conditionOneValueUnit: '', conditionTwo: '', conditionTwoValue: '', conditionTwoValue2: '', conditionTwoValueUnit: '', frequencyType: '', frequencyValue: '' }));
            setFrequencyOptions([]);
            return;
        }
        const def = option.itemDetails;
        const actualDesc = def.goalDescription || def.sdohGoalCodeDescription || def.description;
        const fullDesc = def.groupName ? `${def.groupName} ${actualDesc ? `- ${actualDesc}` : ''}`.trim() : actualDesc;
        setForm((previous) => ({
            ...previous,
            selectedGoalName: fullDesc || actualDesc || def.groupName || option.label,
            goalNameLabel: option.label,
            ...(isSdoh ? { code: def.code } : applyGoalDefinition(def, false)),
        }));
    };

    const handleStatusChange = (value) => {
        update({ status: value });
        clearError('status');
        clearError('completedDate');
    };
    const handleConditionOneChange = (value) => {
        update({ conditionOne: value, ...(value === 'IN_BETWEEN' ? {} : { conditionOneValue2: '' }) });
        clearError('conditionOne');
    };
    const handleConditionTwoChange = (value) => {
        update({ conditionTwo: value, ...(value === 'IN_BETWEEN' ? {} : { conditionTwoValue2: '' }) });
        clearError('conditionTwo');
    };

    const showConditionOne = !isSdoh && form.conditionOneType === 'NUMERIC';
    const showConditionTwo = !isSdoh && form.conditionTwoType === 'NUMERIC';
    const showFrequency = !isSdoh && frequencyOptions.length > 0;
    const conditionRequired = form.code !== 'GOTH';
    const completedEnabled = ['ACTIVE', ...COMPLETED_REQUIRED_STATUSES].includes(form.status);
    const rangeOpts = rangeOptionsFor(form.groupCode, form.code);
    const weightIndicator = form.code === 'HLTYETDT'
        ? (form.conditionOne === '>' ? ' (Weight Gain Goal)' : form.conditionOne === '<' ? ' (Weight Loss Goal)' : '')
        : '';

    const validateFrequencyValue = (type, value) => {
        const number = parseInt(value, 10);
        switch (type) {
            case 'DAYPWEEK': return number > 0 && number <= 7;
            case 'TIMEPMONTH':
            case 'TIMEPWEEK': return number > 0 && number <= 99;
            case 'DAYPMONTH': return number > 0 && number <= 31;
            default: return true;
        }
    };

    const validate = () => {
        const next = {};
        if (!form.code)
            next.code = 'Goal is required.';
        if (!form.status)
            next.status = 'Goal Status is required.';
        if (!form.startDate)
            next.startDate = isSdoh ? 'Start date and time is required.' : 'Start date is required.';
        if (!form.recordedDate)
            next.recordedDate = 'Recorded date and time is required.';
        if (COMPLETED_REQUIRED_STATUSES.includes(form.status) && !form.completedDate)
            next.completedDate = isSdoh ? 'Completed date and time is required.' : 'End date is required.';
        if (showConditionOne && conditionRequired) {
            if (!form.conditionOne)
                next.conditionOne = 'Range is required.';
            if (!form.conditionOneValue)
                next.conditionOneValue = 'Value is required.';
            else if (!onlyNumbersWithDecimals(form.conditionOneValue) || form.conditionOneValue.length > 9)
                next.conditionOneValue = 'Invalid value.';
            if (form.conditionOne === 'IN_BETWEEN') {
                if (!form.conditionOneValue2)
                    next.conditionOneValue2 = 'Max Value is required.';
                else if (Number(form.conditionOneValue2) <= Number(form.conditionOneValue))
                    next.conditionOneValue2 = 'Greater than min value.';
            }
        }
        if (showConditionTwo) {
            if (!form.conditionTwo)
                next.conditionTwo = 'Condition is required.';
            if (!form.conditionTwoValue)
                next.conditionTwoValue = 'Value is required.';
            if (form.conditionTwo === 'IN_BETWEEN' && !form.conditionTwoValue2)
                next.conditionTwoValue2 = 'Max Value is required.';
        }
        if (showFrequency && form.frequencyType && form.frequencyType !== 'DAILY') {
            if (!form.frequencyValue)
                next.frequencyValue = 'Frequency value is required.';
            else if (!validateFrequencyValue(form.frequencyType, form.frequencyValue))
                next.frequencyValue = 'Invalid value.';
        }
        if (form.description && (form.description.length < 2 || form.description.length > 5000))
            next.description = form.description.length < 2 ? 'Minimum 2 characters.' : 'Maximum 5000 characters.';
        return next;
    };

    const buildSdohPayload = () => {
        const lastEffective = form.status === 'ENTERED_ERR' ? userNow().format('MM-DD-YYYY hh:mm A') : (form.completedDate || null);
        return {
            id: form.id || null,
            patientId: parseInt(patientId, 10),
            sdohGoalCode: form.code,
            effectiveDate: form.startDate,
            lastEffectiveDate: lastEffective,
            recordedDate: form.recordedDate,
            notes: form.description,
            statusCode: form.status,
            invalidFlag: 'N',
        };
    };
    const buildPatientPayload = (changeLogMessage) => {
        const lastEffective = form.status === 'ENTERED_ERR' ? userNow().format('MM-DD-YYYY') : (form.completedDate || '');
        const numeric1 = form.conditionOneType === 'NUMERIC';
        const numeric2 = form.conditionTwoType === 'NUMERIC';
        return {
            isModified: !!form.id,
            patientDeviceId: goal?.patientDeviceId || null,
            deviceId: goal?.deviceId || null,
            isPatientEditable: form.allowPatientToEdit ? 'Y' : 'N',
            isCareTeamPrescribed: 'Y',
            patientId: String(patientId),
            goalId: form.id,
            goalCode: form.code,
            goalGroupCode: form.groupCode,
            valueUnit1: form.conditionOneValueUnit || '',
            numCondition1: form.conditionOne || '',
            numValue1: numeric1 && ['>', '<'].includes(form.conditionOne) ? form.conditionOneValue : null,
            minValue1: form.conditionOne === 'IN_BETWEEN' ? form.conditionOneValue : null,
            maxValue1: form.conditionOne === 'IN_BETWEEN' ? form.conditionOneValue2 : null,
            textValue1: numeric1 && form.conditionOne === '=' ? form.conditionOneValue : null,
            valueUnit2: form.conditionTwoValueUnit || '',
            numCondition2: form.conditionTwo || '',
            numValue2: numeric2 && ['>', '<'].includes(form.conditionTwo) ? form.conditionTwoValue : null,
            minValue2: form.conditionTwo === 'IN_BETWEEN' ? form.conditionTwoValue : null,
            maxValue2: form.conditionTwo === 'IN_BETWEEN' ? form.conditionTwoValue2 : null,
            textValue2: numeric2 && form.conditionTwo === '=' ? form.conditionTwoValue : null,
            frequencyCode: form.frequencyType || null,
            frequencyValue: form.frequencyType === 'DAILY' ? 1 : (form.frequencyType ? form.frequencyValue : null),
            goalNotes: form.description || null,
            effectiveDate: form.startDate,
            lastEffectiveDate: lastEffective,
            goalName: form.selectedGoalName,
            goalValueTypeCode1: form.conditionOneType,
            goalValueTypeCode2: form.conditionTwoType,
            planId: null,
            careplanLogMessageUserInput: changeLogMessage,
            careplanLogMessage: changeLogMessage,
            encounterId: '',
            logId: null,
            trackedPrograms: goal?.trackedPrograms || [],
            mappedIcdCodes: goal?.mappedIcdCodes || [],
            statusCode: form.status,
        };
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaveError(null);
        const validationErrors = validate();
        setErrors(validationErrors);
        if (Object.keys(validationErrors).length)
            return;
        setSaving(true);
        try {
            // Programmatic audit message (legacy patientChangeLog phrasing).
            const changeLogMessage = `${isEdit ? 'An existing' : 'A new'} goal "${form.selectedGoalName || form.goalNameLabel}" has been ${isEdit ? 'modified' : 'added'}`;
            const response = isSdoh ? await saveSdohGoal(buildSdohPayload()) : await savePatientGoal(buildPatientPayload(changeLogMessage));
            const outcome = getSaveOutcome(response, 'Failed to update goals. please try again.');
            if (outcome.ok) {
                onClose(true);
                return;
            }
            setSaveError(outcome);
        }
        catch (error) {
            console.error('Failed to save goal.', error);
            setSaveError({ tone: 'error', message: error?.message || 'Failed to update goals. please try again.' });
        }
        finally {
            setSaving(false);
        }
    };

    const fieldId = (base) => `${base}_${patientId}`;
    const dateProps = isSdoh
        ? { enableTime: true, dateFormat: 'm-d-Y h:i K', placeholder: 'MM-DD-YYYY HH:MM AM/PM' }
        : { enableTime: false, dateFormat: 'm-d-Y', placeholder: 'MM-DD-YYYY' };

    return (<form className="care-plan-data-entry" id={fieldId('pc_patient_goals_add_edit_form')} autoComplete="off" onSubmit={handleSubmit} noValidate>
      <div className="row g-3">
        <div className="col-12 col-md-4">
          <label className="form-label fw-bold" htmlFor={fieldId('pc_patient_goals_goal_name')}>Goal <span className="text-danger">*</span></label>
          {isEdit ? (<input type="text" id={fieldId('pc_patient_goals_goal_name')} className="form-control text-capitalize" value={form.goalNameLabel} disabled/>) : (<Select inputId={fieldId('pc_patient_goals_goal_name')} classNamePrefix="react-select" placeholder="Search Goal" isClearable options={goalOptions} value={goalOptions.find((option) => option.value === form.code) || null} onChange={onGoalSelected}/>)}
          {errors.code && <div className="small text-danger mt-1">{errors.code}</div>}
        </div>

        {showFrequency && (<div className="col-12 col-md-4">
            <label className="form-label fw-bold">Frequency <span className="text-danger">*</span></label>
            <div className="row g-2">
              <div className={form.frequencyType && form.frequencyType !== 'DAILY' ? 'col-md-6' : 'col-md-12'}>
                <select className="form-control form-select" value={form.frequencyType} onChange={(event) => { update({ frequencyType: event.target.value, ...(event.target.value === 'DAILY' || !event.target.value ? { frequencyValue: '' } : {}) }); clearError('frequencyValue'); }}>
                  {form.code === 'GOTH' && <option value="">Select Type</option>}
                  {frequencyOptions.map((frequency) => <option key={frequency.code} value={frequency.code}>{frequency.description}</option>)}
                </select>
              </div>
              {form.frequencyType && form.frequencyType !== 'DAILY' && (<div className="col-md-6">
                  <input type="text" autoComplete="off" placeholder="Value" className="form-control" value={form.frequencyValue} onChange={(event) => { update({ frequencyValue: event.target.value }); clearError('frequencyValue'); }} maxLength={2}/>
                  {errors.frequencyValue && <div className="small text-danger mt-1">{errors.frequencyValue}</div>}
                </div>)}
            </div>
          </div>)}

        {showConditionOne && (<div className="col-12 col-md-4">
            <label className="form-label fw-bold">Range {conditionRequired && <span className="text-danger">*</span>}<span className="pc-patient-goals-weight-alert-indicator" style={{ color: '#ff7801' }}>{weightIndicator}</span></label>
            <div className="row g-2">
              <div className={form.conditionOne === 'IN_BETWEEN' ? 'col-md-3' : 'col-md-4'}>
                <select className="form-control form-select" value={form.conditionOne} disabled={isEdit} onChange={(event) => handleConditionOneChange(event.target.value)}>
                  <option value="">Select Range</option>
                  {rangeOpts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div className={form.conditionOne === 'IN_BETWEEN' ? 'col-md-3' : 'col-md-4'}>
                <input type="text" autoComplete="off" placeholder={form.conditionOne === 'IN_BETWEEN' ? 'Min Value' : 'Value'} className="form-control" value={form.conditionOneValue} disabled={isEdit} onChange={(event) => { if (onlyNumbersWithDecimals(event.target.value)) { update({ conditionOneValue: event.target.value }); clearError('conditionOneValue'); } }} maxLength={9}/>
              </div>
              {form.conditionOne === 'IN_BETWEEN' && (<div className="col-md-3">
                  <input type="text" autoComplete="off" placeholder="Max Value" className="form-control" value={form.conditionOneValue2} disabled={isEdit} onChange={(event) => { if (onlyNumbersWithDecimals(event.target.value)) { update({ conditionOneValue2: event.target.value }); clearError('conditionOneValue2'); } }} maxLength={9}/>
                </div>)}
              <div className={form.conditionOne === 'IN_BETWEEN' ? 'col-md-3' : 'col-md-4'}>
                <input type="text" autoComplete="off" placeholder="Unit" className="form-control" readOnly value={form.conditionOneValueUnit}/>
              </div>
            </div>
            {(errors.conditionOne || errors.conditionOneValue || errors.conditionOneValue2) && <div className="small text-danger mt-1">{errors.conditionOne || errors.conditionOneValue || errors.conditionOneValue2}</div>}
          </div>)}

        {showConditionTwo && (<div className="col-12 col-md-4">
            <label className="form-label fw-bold">Condition 2 <span className="text-danger">*</span></label>
            <div className="row g-2">
              <div className={form.conditionTwo === 'IN_BETWEEN' ? 'col-md-3' : 'col-md-4'}>
                <select className="form-control form-select" value={form.conditionTwo} disabled={isEdit} onChange={(event) => handleConditionTwoChange(event.target.value)}>
                  <option value="">Select Condition</option>
                  {rangeOpts.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                </select>
              </div>
              <div className={form.conditionTwo === 'IN_BETWEEN' ? 'col-md-3' : 'col-md-4'}>
                <input type="text" autoComplete="off" placeholder={form.conditionTwo === 'IN_BETWEEN' ? 'Min Value' : 'Value'} className="form-control" value={form.conditionTwoValue} disabled={isEdit} onChange={(event) => { if (onlyNumbersWithDecimals(event.target.value)) { update({ conditionTwoValue: event.target.value }); clearError('conditionTwoValue'); } }} maxLength={9}/>
              </div>
              {form.conditionTwo === 'IN_BETWEEN' && (<div className="col-md-3">
                  <input type="text" autoComplete="off" placeholder="Max Value" className="form-control" value={form.conditionTwoValue2} disabled={isEdit} onChange={(event) => { if (onlyNumbersWithDecimals(event.target.value)) { update({ conditionTwoValue2: event.target.value }); clearError('conditionTwoValue2'); } }} maxLength={9}/>
                </div>)}
              <div className={form.conditionTwo === 'IN_BETWEEN' ? 'col-md-3' : 'col-md-4'}>
                <input type="text" autoComplete="off" placeholder="Unit" className="form-control" readOnly value={form.conditionTwoValueUnit}/>
              </div>
            </div>
            {(errors.conditionTwo || errors.conditionTwoValue || errors.conditionTwoValue2) && <div className="small text-danger mt-1">{errors.conditionTwo || errors.conditionTwoValue || errors.conditionTwoValue2}</div>}
          </div>)}

        {!isSdoh && (<div className="col-12 col-md-4 d-flex align-items-center">
            <label className="custom-switch me-2 mb-0"><input name="pc_patient_goals_allow_patient_to_edit" type="checkbox" checked={form.allowPatientToEdit} onChange={(event) => update({ allowPatientToEdit: event.target.checked })}/><span className="slider"/></label>
            <label className="form-check-label mb-0">Allow Patient To Edit Goal In Mobile Application</label>
          </div>)}
      </div>

      <div className="row g-3 mt-1">
        <div className="col-12 col-md-4">
          <label className="form-label fw-bold" htmlFor={fieldId('pc_patient_goals_status')}>Goal Status <span className="text-danger">*</span></label>
          <select id={fieldId('pc_patient_goals_status')} className="form-select form-control" value={form.status} onChange={(event) => handleStatusChange(event.target.value)}>
            <option value="">Select Status</option>
            {statusOptions.map((status) => <option key={status.code} value={status.code}>{status.description}</option>)}
          </select>
          {errors.status && <div className="small text-danger mt-1">{errors.status}</div>}
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label fw-bold" htmlFor={fieldId('pc_patient_goals_start_date')}>{isSdoh ? 'Start Date & Time' : 'Start Date'} <span className="text-danger">*</span></label>
          <FlatpickrDateTimeInput id={fieldId('pc_patient_goals_start_date')} value={form.startDate} onChange={(value) => { update({ startDate: value }); clearError('startDate'); }} disabled={isEdit} minDate={dob || undefined} maxDate={dateMax} {...dateProps}/>
          {errors.startDate && <div className="small text-danger mt-1">{errors.startDate}</div>}
        </div>
        <div className="col-12 col-md-4">
          <label className="form-label fw-bold" htmlFor={fieldId('pc_patient_goals_completed_date')}>{isSdoh ? 'Completed Date & Time' : 'End Date'} {COMPLETED_REQUIRED_STATUSES.includes(form.status) && <span className="text-danger">*</span>}</label>
          <FlatpickrDateTimeInput id={fieldId('pc_patient_goals_completed_date')} value={form.completedDate} onChange={(value) => { update({ completedDate: value }); clearError('completedDate'); }} disabled={!completedEnabled} minDate={form.startDate || dob || undefined} maxDate={dateMax} {...dateProps}/>
          {errors.completedDate && <div className="small text-danger mt-1">{errors.completedDate}</div>}
        </div>
      </div>

      <div className="row g-3 mt-1">
        <div className="col-12 col-md-4">
          <label className="form-label fw-bold" htmlFor={fieldId('pc_patient_goals_recorded_date')}>Recorded Date &amp; Time <span className="text-danger">*</span></label>
          <FlatpickrDateTimeInput id={fieldId('pc_patient_goals_recorded_date')} value={form.recordedDate} onChange={(value) => { update({ recordedDate: value }); clearError('recordedDate'); }} minDate={dob || undefined} maxDate={dateMax} {...dateProps}/>
          {errors.recordedDate && <div className="small text-danger mt-1">{errors.recordedDate}</div>}
        </div>
        <div className="col-12 col-md-8">
          <label className="form-label fw-bold" htmlFor={fieldId('pc_patient_goals_description')}>Description</label>
          <textarea id={fieldId('pc_patient_goals_description')} className="form-control" style={{ height: 70 }} value={form.description} onChange={(event) => { update({ description: event.target.value }); clearError('description'); }} maxLength={5000}/>
          {errors.description && <div className="small text-danger mt-1">{errors.description}</div>}
        </div>
      </div>

      {saveError && (<div className="row mt-2">
          <div className={`small ${saveError.tone === 'warning' ? 'text-warning' : 'text-danger'}`}><LegacyIcon icon="fa-exclamation-triangle" className="me-1"/>{saveError.message}</div>
        </div>)}

      <FormStatusFooter
        dirty={dirty}
        saving={saving}
        onCancel={() => onClose(false)}
        saveLabel="Save"
      />
    </form>);
};
export default PatientGoalsAddEdit;
