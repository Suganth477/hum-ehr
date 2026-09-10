import { useEffect, useMemo, useState } from 'react';
import { userNow } from '../../../utils/dayjs';
import Select from 'react-select';
import AsyncSelect from 'react-select/async';
import { buildImmunizationSavePayload, fetchVaccineSiteLookup, saveImmunization } from '../../../services/immunizationService';
import { fetchPatientDetails } from '../../../services/patientService';
import patientCache from '../../../utils/patientCache';
import { getSaveOutcome } from '../../../utils/saveResponse';
import { LOOKUP_MIN_CHARS } from '../../../constants/timing';
import FlatpickrDateTimeInput from '../../../components/common/FlatpickrDateTimeInput';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import FormStatusFooter from '../../../components/common/FormStatusFooter';

const physicianLabel = (p) => p.name || p.fullName || p.physicianName || p.providerName || p.userName || '';
const physicianValue = (p) => p.id ?? p.physicianId ?? p.userId ?? p.value ?? '';
const decimalOk = (value) => /^(0\.(?!0{1,2}$)[0-9]{1,2}|[1-9][0-9]{0,2}(\.[0-9]{1,2})?)$/i.test(value);

const createDefaultForm = () => ({
    id: '', vaccineName: '', vaccineId: '', cdcName: '', cdcType: '', publicityCode: '', manufacturerCode: '',
    routeId: '', siteId: '', siteName: '', doseFormId: '', quantity: '', unitId: '', doseNumber: '',
    administeredDate: '', expirationDate: '', administeringPhysician: '',
    manufacturerName: '', lotNumber: '', vaccineReason: '', notes: '',
});

const FieldError = ({ message }) => message ? <div className="small text-danger mt-1">{message}</div> : null;

const PatientImmunizationAddEdit = ({ patientId, record, reference, physicians, careplanId, onClose }) => {
    const isEdit = !!record?.id;
    const [form, setForm] = useState(createDefaultForm);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [dob, setDob] = useState('');
    const [dirty, setDirty] = useState(false);

    // Patient DOB → lower bound for administered/expiration dates (legacy data-min).
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

    const vaccineOptions = useMemo(() => (reference.vaccines || []).map((v) => ({ value: v.id, label: v.value, code: v.code })), [reference.vaccines]);
    const routeOptions = useMemo(() => (reference.routes || []).map((r) => ({ value: r.id, label: r.value })), [reference.routes]);
    const doseFormOptions = useMemo(() => (reference.doseForms || []).map((d) => ({ value: d.id, label: d.value })), [reference.doseForms]);
    const physicianOptions = useMemo(() => (physicians || []).map((p) => ({ value: physicianValue(p), label: physicianLabel(p) })).filter((o) => o.value !== ''), [physicians]);
    // Recorded By — the logged-in user, always shown disabled + sent as validatedUserId
    // (legacy reads the sidebar .user-name text, e.g. "John Doe (EST)" → "John Doe").
    const recordedBy = useMemo(() => (document.querySelector('.user-name')?.textContent || '').split('(')[0].trim(), []);

    const update = (patch) => { setDirty(true); setForm((p) => ({ ...p, ...patch })); };
    const clearError = (key) => setErrors((prev) => { if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });

    useEffect(() => {
        if (!isEdit) { setForm(createDefaultForm()); return; }
        // Legacy setValueInInputField: route/doseForm are names — match back to option ids.
        const routeId = (reference.routes || []).find((r) => r.value === record.route)?.id || '';
        const doseFormId = (reference.doseForms || []).find((d) => d.value === record.doseForm)?.id || '';
        setForm({
            id: record.id || '', vaccineName: record.vaccineName || '', vaccineId: record.vaccinId || record.vaccineId || '',
            cdcName: record.cdcName || '', cdcType: record.cdcType || '', publicityCode: record.publicityCode || '', manufacturerCode: record.manufacturerCode || '',
            routeId, siteId: record.siteId || '', siteName: record.site || '', doseFormId,
            quantity: record.quantity || '', unitId: record.unitId || '', doseNumber: record.doseNumber ?? '',
            administeredDate: record.administeredDate || '', expirationDate: record.expirationDate || '',
            administeringPhysician: record.administeringPhysician || '', manufacturerName: record.manufacturerName || '',
            lotNumber: record.lotNumber || '', vaccineReason: record.vaccineReason || record.reason || '', notes: record.notes || '',
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [record, isEdit]);

    // Per legacy enableDisableLookupInputFields: a catalogued vaccine (vaccinId) locks
    // the vaccine name, and locks route/site/doseForm only when each is already populated
    // from the catalog (empty ones stay editable).
    const catalogLocked = isEdit && !!form.vaccineId;
    const routeLocked = catalogLocked && !!form.routeId;
    const siteLocked = catalogLocked && !!form.siteId;
    const doseFormLocked = catalogLocked && !!form.doseFormId;

    const loadSiteOptions = (inputValue) => {
        if ((inputValue || '').trim().length < LOOKUP_MIN_CHARS) return Promise.resolve([]);
        return fetchVaccineSiteLookup(inputValue).then((list) => list.map((s) => ({ value: s.id, label: s.value })));
    };

    const onVaccineChange = (option) => {
        clearError('vaccineId');
        update({ vaccineId: option?.value || '', vaccineName: option?.label || '' });
    };
    const onQuantityChange = (value) => {
        // Enable unit only when a dose quantity is present (legacy enableDisableDoseUnitInputField).
        update({ quantity: value, unitId: value.trim() ? form.unitId : '' });
        clearError('quantity');
    };

    const validate = () => {
        const next = {};
        if (!form.vaccineId) next.vaccineId = 'Please select vaccination name from the search list.';
        if (!form.administeredDate) next.administeredDate = 'Administered date and time is required.';
        if (form.quantity && !decimalOk(form.quantity)) next.quantity = 'Invalid value.';
        if (form.quantity && form.quantity.trim() && !form.unitId) next.unitId = 'Dose unit is required.';
        // Backend requires a dose number (the dose's position in the vaccination series).
        if (!String(form.doseNumber).trim()) next.doseNumber = 'Dose number is required.';
        else if (!/^[1-9][0-9]?$/.test(String(form.doseNumber).trim())) next.doseNumber = 'Enter a valid dose number.';
        return next;
    };

    const handleSubmit = async (event) => {
        event.preventDefault();
        setSaveError(null);
        const validationErrors = validate();
        setErrors(validationErrors);
        if (Object.keys(validationErrors).length) return;
        setSaving(true);
        try {
            const changeLogMessage = `${isEdit ? 'An existing' : 'A new'} immunization "${form.vaccineName}" has been ${isEdit ? 'modified' : 'added'}`;
            const response = await saveImmunization(buildImmunizationSavePayload({ patientId, careplanId, form, changeLogMessage, validatedUserId: recordedBy }));
            const outcome = getSaveOutcome(response, 'Failed to update immunization details. Please try again.');
            if (outcome.ok) { onClose(true); return; }
            setSaveError(outcome);
        }
        catch (error) {
            console.error('Failed to save immunization.', error);
            setSaveError({ tone: 'error', message: error?.message || 'Failed to update immunization details. Please try again.' });
        }
        finally {
            setSaving(false);
        }
    };

    const dateProps = { enableTime: true, dateFormat: 'm-d-Y h:i K', placeholder: 'MM-DD-YYYY HH:MM AM/PM' };
    const administeredMax = form.expirationDate || userNow().add(1, 'year').format('MM-DD-YYYY');

    return (<form className="care-plan-data-entry" id={`add_edit_patient_immunization_details_${patientId}`} autoComplete="off" onSubmit={handleSubmit} noValidate>
      <div className="row g-3">
        <div className="col-md-4">
          <label className="form-label fw-bold">Vaccination Name <span className="text-danger">*</span></label>
          <Select classNamePrefix="react-select" placeholder="Search Vaccination" isClearable isDisabled={isEdit} options={vaccineOptions} value={vaccineOptions.find((o) => String(o.value) === String(form.vaccineId)) || null} onChange={onVaccineChange}/>
          <FieldError message={errors.vaccineId}/>
        </div>
        <div className="col-md-4">
          <label className="form-label fw-bold">Name Of Manufacturer</label>
          <input className="form-control text-capitalize" value={form.manufacturerName} onChange={(e) => update({ manufacturerName: e.target.value })}/>
        </div>
        <div className="col-md-4">
          <label className="form-label fw-bold">Vaccination administered on / will administer <span className="text-danger">*</span></label>
          <FlatpickrDateTimeInput value={form.administeredDate} onChange={(v) => { update({ administeredDate: v }); clearError('administeredDate'); }} {...dateProps} minDate={dob || undefined} maxDate={administeredMax}/>
          <FieldError message={errors.administeredDate}/>
        </div>
      </div>
      <div className="row g-3 mt-1">
        <div className="col-md-4">
          <label className="form-label fw-bold">Route of Administration</label>
          <Select classNamePrefix="react-select" placeholder="Select Route" isClearable isDisabled={routeLocked} options={routeOptions} value={routeOptions.find((o) => String(o.value) === String(form.routeId)) || null} onChange={(o) => update({ routeId: o?.value || '' })}/>
        </div>
        <div className="col-md-4">
          <label className="form-label fw-bold">Lot Number</label>
          <input className="form-control text-capitalize" value={form.lotNumber} onChange={(e) => update({ lotNumber: e.target.value })}/>
        </div>
        <div className="col-md-4">
          <label className="form-label fw-bold">Expiration Date &amp; Time</label>
          <FlatpickrDateTimeInput value={form.expirationDate} onChange={(v) => update({ expirationDate: v })} {...dateProps} minDate={dob || undefined}/>
        </div>
      </div>
      <div className="row g-3 mt-1">
        <div className="col-md-4">
          <label className="form-label fw-bold">Administered Physician</label>
          <select className="form-control form-select" value={form.administeringPhysician} onChange={(e) => update({ administeringPhysician: e.target.value })}>
            <option value="">Select</option>
            {physicianOptions.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label fw-bold">Dose Form</label>
          <Select classNamePrefix="react-select" placeholder="Select Dose Form" isClearable isDisabled={doseFormLocked} options={doseFormOptions} value={doseFormOptions.find((o) => String(o.value) === String(form.doseFormId)) || null} onChange={(o) => update({ doseFormId: o?.value || '' })}/>
        </div>
        <div className="col-md-4">
          <label className="form-label fw-bold">Site</label>
          <AsyncSelect classNamePrefix="react-select" placeholder="Enter at least 3 characters" isClearable isDisabled={siteLocked} cacheOptions defaultOptions={false}
            value={form.siteId ? { value: form.siteId, label: form.siteName } : null}
            loadOptions={loadSiteOptions}
            onChange={(o) => update({ siteId: o?.value || '', siteName: o?.label || '' })}
            noOptionsMessage={({ inputValue }) => (inputValue || '').length < LOOKUP_MIN_CHARS ? `Type at least ${LOOKUP_MIN_CHARS} characters` : 'No results found'}/>
        </div>
      </div>
      <div className="row g-3 mt-1">
        <div className="col-md-4">
          <label className="form-label fw-bold">Recorded By</label>
          <input className="form-control text-capitalize" value={recordedBy} disabled readOnly/>
        </div>
      </div>
      <div className="row g-3 mt-1">
        <div className="col-md-2">
          <label className="form-label fw-bold">Dose</label>
          <input className="form-control" maxLength={5} value={form.quantity} onChange={(e) => onQuantityChange(e.target.value)}/>
          <FieldError message={errors.quantity}/>
        </div>
        <div className="col-md-2">
          <label className="form-label fw-bold">Unit</label>
          <select className="form-control form-select" value={form.unitId} disabled={!form.quantity.trim()} onChange={(e) => { update({ unitId: e.target.value }); clearError('unitId'); }}>
            <option value="">Select Unit</option>
            {(reference.units || []).map((u) => <option key={u.id} value={u.id}>{u.value}</option>)}
          </select>
          <FieldError message={errors.unitId}/>
        </div>
        <div className="col-md-2">
          <label className="form-label fw-bold">Dose Number <span className="text-danger">*</span></label>
          <input className="form-control" inputMode="numeric" maxLength={2} placeholder="e.g. 1" value={form.doseNumber} onChange={(e) => { update({ doseNumber: e.target.value.replace(/[^0-9]/g, '') }); clearError('doseNumber'); }}/>
          <FieldError message={errors.doseNumber}/>
        </div>
        <div className="col-md-6">
          <label className="form-label fw-bold">Vaccination Reason</label>
          <textarea className="form-control" style={{ height: 38 }} value={form.vaccineReason} onChange={(e) => update({ vaccineReason: e.target.value })} maxLength={300}/>
        </div>
      </div>
      <div className="row g-3 mt-1">
        <div className="col-12">
          <label className="form-label fw-bold">Notes</label>
          <textarea className="form-control" style={{ height: 60 }} value={form.notes} onChange={(e) => update({ notes: e.target.value })} maxLength={5000}/>
        </div>
      </div>

      {saveError && (<div className={`mt-3 small ${saveError.tone === 'warning' ? 'text-warning' : 'text-danger'}`}><LegacyIcon icon="fa-exclamation-triangle" className="me-1"/>{saveError.message}</div>)}

      <FormStatusFooter
        dirty={dirty}
        saving={saving}
        onCancel={() => onClose(false)}
        saveLabel="Save"
      />
    </form>);
};
export default PatientImmunizationAddEdit;
