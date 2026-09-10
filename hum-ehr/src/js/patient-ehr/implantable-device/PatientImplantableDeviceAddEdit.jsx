import { useEffect, useMemo, useState } from 'react';
import moment, { userNow } from '../../../utils/dayjs';
import AsyncSelect from 'react-select/async';
import {
    buildImplantDeviceSavePayload, saveImplantDevice,
    fetchImplantBodySiteLookup, fetchImplantDeviceTypeLookup,
} from '../../../services/implantDeviceService';
import { LOOKUP_MIN_CHARS } from '../../../constants/timing';
import { fetchPatientDetails } from '../../../services/patientService';
import patientCache from '../../../utils/patientCache';
import FlatpickrDateTimeInput from '../../../components/common/FlatpickrDateTimeInput';
import { useNotify } from '../../../context/NotificationContext';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import FormStatusFooter from '../../../components/common/FormStatusFooter';

const dateOnly = (value) => (value ? moment(value).format('MM-DD-YYYY') : '');
const md = (d) => (d ? moment(d, 'MM-DD-YYYY', true) : null);

const buildInitialForm = (seed) => {
    const dd = seed?.deviceData || {};
    const explanted = dd.explantDate && moment(dd.explantDate).isSameOrBefore(userNow());
    return {
        id: seed?.implantableId || dd.id || '',
        uniqueDeviceId: dd.uniqueDeviceId || 'Unknown',
        status: seed?.status || (dd.explantDate ? (explanted ? 'Inactive' : 'Active') : 'Active'),
        deviceType: dd.deviceType || '', deviceTypeId: dd.deviceTypeId || '', snomedCode: dd.deviceSnomedCode || dd.snomedCode || '',
        deviceIdentifier: dd.deviceIdentifier || '', lotNumber: dd.lotNumber || '', serialNumber: dd.serialNumber || '',
        manufacturedDate: dateOnly(dd.manufacturedDate), expiryDate: dateOnly(dd.expiryDate), hcpCode: dd.hcpCode || '',
        deviceName: dd.deviceName || '', deviceDescription: dd.deviceDescription || '',
        brandName: dd.brandName || '', model: dd.model || '', companyName: dd.companyName || '',
        mriSafetyInfo: dd.mriSafetyInfo || '', naturalRubberLatexStatus: dd.naturalRubberLatexStatus || '',
        implantDate: dateOnly(dd.implantDate), bodySite: dd.bodySiteDesc || '', bodySiteId: dd.bodySiteId || '',
        implantProviderName: dd.implantProviderName || '', reasonForImplant: dd.reasonForImplant || '', notes: dd.notes || '',
        explantFlag: !!dd.explantDate, explantDate: dateOnly(dd.explantDate), reasonForExplant: dd.reasonForExplant || '',
        procedureChips: dd.implantProcedures || [], surgicalChips: dd.implantSurgicalHistories || [],
        explantProcedureChips: dd.explantProcedures || [], explantSurgicalChips: dd.explantSurgicalHistories || [],
    };
};

const FieldError = ({ message }) => message ? <div className="small text-danger mt-1">{message}</div> : null;

/**
 * Add / Edit implantable device (legacy PatientImplantableDeviceDetailViewAddEdit).
 * GUDID-fetched devices lock their attribute fields (only implant/explant/clinical
 * fields stay editable); UDI-unknown / manually-typed devices unlock everything and
 * require a Device Type (SNOMED). Save handles the duplicate-override warning.
 * TODO: "Add New Procedure / Surgical History" opens the Procedure / Surgical History
 * sections, which are not migrated to React yet — buttons preserved but disabled.
 */
const PatientImplantableDeviceAddEdit = ({ patientId, seed, onClose }) => {
    const isEdit = !!(seed?.implantableId || seed?.deviceData?.id);
    const manualEntry = !!(seed?.unknownUDI || seed?.deviceData?.deviceTypeId);
    const deviceFieldsLocked = !manualEntry; // GUDID device → attributes read-only
    const [form, setForm] = useState(() => buildInitialForm(seed));
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [duplicatePrompt, setDuplicatePrompt] = useState(false);
    const [linkMode, setLinkMode] = useState(''); // '' | 'PROCEDURE' | 'SURGICAL'
    const [dirty, setDirty] = useState(false);
    const { notifyError, notifySuccess, notifyWarn } = useNotify();

    const update = (patch) => { setDirty(true); setForm((p) => ({ ...p, ...patch })); };
    const clearError = (key) => setErrors((prev) => { if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });

    const [dob, setDob] = useState('');
    // Patient DOB → ultimate lower bound for all device dates (legacy data-min).
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

    const today = useMemo(() => userNow().format('MM-DD-YYYY'), []);
    // Interdependent date bounds (mirror the legacy datepicker min/max wiring; DOB is the floor).
    const expiryMin = form.manufacturedDate || dob || undefined;
    const implantMax = (form.expiryDate && md(form.expiryDate)?.isSameOrBefore(userNow(), 'day')) ? form.expiryDate : today;
    const implantMin = form.manufacturedDate || dob || undefined;
    const explantMin = form.implantDate || dob || undefined;

    const loadBodySite = (input) => {
        if ((input || '').trim().length < LOOKUP_MIN_CHARS) return Promise.resolve([]);
        return fetchImplantBodySiteLookup(input).then((list) => list.map((s) => ({ value: s.id, label: s.value })));
    };
    const loadDeviceType = (input) => {
        if ((input || '').trim().length < LOOKUP_MIN_CHARS) return Promise.resolve([]);
        return fetchImplantDeviceTypeLookup({ search: input }).then(({ options }) => options.map((o) => ({ value: o.id, label: o.value, code: o.code })));
    };

    const validate = () => {
        const next = {};
        if (manualEntry && !form.deviceTypeId) next.deviceType = 'Please select the device type from the list';
        const impl = md(form.implantDate);
        if (!form.implantDate) next.implantDate = 'Please enter the implantation date';
        else if (!impl?.isValid()) next.implantDate = 'Please enter a valid implantation date';
        else if (impl.isAfter(userNow(), 'day')) next.implantDate = 'Implantation date cannot be a future date.';
        else if (form.manufacturedDate && impl.isBefore(md(form.manufacturedDate), 'day')) next.implantDate = 'Implantation date must be on/after the manufacture date.';
        else if (form.expiryDate && impl.isAfter(md(form.expiryDate), 'day')) next.implantDate = 'Implantation date must be on/before the expiration date.';
        if (form.manufacturedDate && md(form.manufacturedDate)?.isAfter(userNow(), 'day')) next.manufacturedDate = 'Manufacture date cannot be a future date.';
        if (form.expiryDate && form.manufacturedDate && md(form.expiryDate)?.isBefore(md(form.manufacturedDate), 'day')) next.expiryDate = 'Expiration date must be later than the manufacture date.';
        if (form.bodySite.trim() && !form.bodySiteId) next.bodySite = 'Please select the body site from the list';
        if (form.explantFlag) {
            const exp = md(form.explantDate);
            if (!form.explantDate) next.explantDate = 'Please enter the explantation date';
            else if (!exp?.isValid()) next.explantDate = 'Please enter valid explantation date';
            else if (form.implantDate && exp.isBefore(md(form.implantDate), 'day')) next.explantDate = 'Explantation date must be on/after the implantation date.';
            else if (exp.isAfter(userNow(), 'day')) next.explantDate = 'Explantation date cannot be a future date.';
            else if (form.expiryDate && exp.isAfter(md(form.expiryDate), 'day')) next.explantDate = 'Explantation date cannot be after the device expiration date.';
            if (!form.reasonForExplant.trim()) next.reasonForExplant = 'Please enter the reason for explantation';
        }
        return next;
    };

    const doSave = async (overrideDuplicate) => {
        setSaving(true);
        setSaveError(null);
        try {
            const saveForm = {
                ...form,
                procedureId: form.procedureChips.map((p) => p.id),
                surgicalHistoryId: form.surgicalChips.map((s) => s.id),
                explantProcedureId: form.explantProcedureChips.map((p) => p.id),
                explantSurgicalId: form.explantSurgicalChips.map((s) => s.id),
            };
            const response = await saveImplantDevice(buildImplantDeviceSavePayload({ patientId, form: saveForm, overrideDuplicate }));
            if (response?.status === 'success') {
                notifySuccess(response.data?.message || 'Implantable device saved successfully.');
                onClose(true);
            }
            else if (response?.status === 'warning') {
                if (response.data?.duplicate === 'Y') { setDuplicatePrompt(true); }
                else { notifyWarn ? notifyWarn(response.data?.message || 'Saved with a warning.') : notifyError(response.data?.message || 'Saved with a warning.'); onClose(true); }
            }
            else setSaveError({ tone: 'error', message: response?.message || 'Failed to save the implanted device details. Please try again.' });
        }
        catch (error) {
            console.error('Failed to save implanted device details.', error);
            setSaveError({ tone: 'error', message: error?.message || 'Failed to save the implanted device details. Please try again.' });
        }
        finally { setSaving(false); }
    };

    const handleSave = () => {
        setSaveError(null);
        const v = validate();
        setErrors(v);
        if (Object.keys(v).length) return;
        doSave(false);
    };

    const removeChip = (key, id) => update({ [key]: form[key].filter((c) => c.id !== id) });
    const addNewDisabled = true; // depends on Procedure / Surgical History sections (not migrated yet)

    const ro = (locked) => ({ disabled: locked });

    return (<div className="pcid-explanation-details-wrapper">
      {/* ---- Device (GUDID) attributes ---- */}
      <div className="pcid-non-editable-device-details px-3 p-2 mt-1 mb-3">
        <div className="row g-3 mb-1">
          <div className="col-md-4">
            <label className="pcid-label-name-header">Unique Device Identifier <span className="text-danger">*</span></label>
            <input type="text" className="form-control" value={form.uniqueDeviceId} disabled/>
          </div>
          <div className="col-md-2">
            <label className="pcid-label-name-header">Status</label>
            <select className="form-control form-select" value={form.status} disabled>
              <option value="Active">Active</option>
              <option value="Inactive">Inactive</option>
            </select>
          </div>
          {manualEntry && (<div className="col-md-4">
            <label className="pcid-label-name-header">Device Type <span className="text-danger">*</span></label>
            <AsyncSelect classNamePrefix="react-select" placeholder="Enter at least 3 characters to search" isClearable cacheOptions defaultOptions={false}
              value={form.deviceTypeId ? { value: form.deviceTypeId, label: form.deviceType } : null}
              loadOptions={loadDeviceType}
              onChange={(o) => { update({ deviceTypeId: o?.value || '', deviceType: o?.label || '', snomedCode: o?.code || '' }); clearError('deviceType'); }}
              noOptionsMessage={({ inputValue }) => ((inputValue || '').length < LOOKUP_MIN_CHARS ? `Type at least ${LOOKUP_MIN_CHARS} characters` : 'No results found')}/>
            <FieldError message={errors.deviceType}/>
          </div>)}
        </div>
        <div className="row g-3 mb-1">
          <div className="col-md-3">
            <label className="pcid-label-name-header">Device Identifier (DI)</label>
            <input type="text" className="form-control" maxLength={25} value={form.deviceIdentifier} {...ro(deviceFieldsLocked)} onChange={(e) => update({ deviceIdentifier: e.target.value })}/>
          </div>
          <div className="col-md-3">
            <label className="pcid-label-name">Lot or batch number</label>
            <input type="text" className="form-control" value={form.lotNumber} {...ro(deviceFieldsLocked)} onChange={(e) => update({ lotNumber: e.target.value })}/>
          </div>
          <div className="col-md-3">
            <label className="pcid-label-name">Serial Number</label>
            <input type="text" className="form-control" value={form.serialNumber} {...ro(deviceFieldsLocked)} onChange={(e) => update({ serialNumber: e.target.value })}/>
          </div>
        </div>
        <div className="row g-3 mb-1">
          <div className="col-md-3">
            <label className="pcid-label-name">Manufacture date</label>
            <FlatpickrDateTimeInput value={form.manufacturedDate} enableTime={false} dateFormat="m-d-Y" placeholder="MM-DD-YYYY" minDate={dob || undefined} maxDate={today} disabled={deviceFieldsLocked}
              onChange={(v) => { update({ manufacturedDate: v }); clearError('manufacturedDate'); }}/>
            <FieldError message={errors.manufacturedDate}/>
          </div>
          <div className="col-md-3">
            <label className="pcid-label-name">Expiration date</label>
            <FlatpickrDateTimeInput value={form.expiryDate} enableTime={false} dateFormat="m-d-Y" placeholder="MM-DD-YYYY" minDate={expiryMin} disabled={deviceFieldsLocked}
              onChange={(v) => { update({ expiryDate: v }); clearError('expiryDate'); }}/>
            <FieldError message={errors.expiryDate}/>
          </div>
          <div className="col-md-4">
            <label className="pcid-label-name">Distinct identification code for HCT/P</label>
            <input type="text" className="form-control" value={form.hcpCode} {...ro(deviceFieldsLocked)} onChange={(e) => update({ hcpCode: e.target.value })}/>
          </div>
        </div>
        <div className="row g-3 mb-1">
          <div className="col-md-5">
            <label className="pcid-label-name">Device Name</label>
            <input type="text" className="form-control" maxLength={50} value={form.deviceName} {...ro(deviceFieldsLocked)} onChange={(e) => update({ deviceName: e.target.value })}/>
          </div>
          <div className="col-md-7">
            <label className="pcid-label-name">Device Description</label>
            <textarea className="form-control" style={{ height: 60 }} maxLength={500} value={form.deviceDescription} {...ro(deviceFieldsLocked)} onChange={(e) => update({ deviceDescription: e.target.value })}/>
            <div style={{ textAlign: 'end' }}><label>({form.deviceDescription.trim().length}/500)</label></div>
          </div>
        </div>
        <div className="row g-3">
          <div className="col-12"><label className="pcid-label-name-header">GUDID Attributes</label></div>
          <div className="col-md-3"><label className="pcid-label-name">Brand Name</label><input type="text" className="form-control" value={form.brandName} {...ro(deviceFieldsLocked)} onChange={(e) => update({ brandName: e.target.value })}/></div>
          <div className="col-md-3"><label className="pcid-label-name">Version or Model</label><input type="text" className="form-control" value={form.model} {...ro(deviceFieldsLocked)} onChange={(e) => update({ model: e.target.value })}/></div>
          <div className="col-md-3"><label className="pcid-label-name">Company Name</label><input type="text" className="form-control" maxLength={250} value={form.companyName} {...ro(deviceFieldsLocked)} onChange={(e) => update({ companyName: e.target.value })}/></div>
          <div className="col-md-3"><label className="pcid-label-name">MRI Safety information from labelling</label><input type="text" className="form-control" value={form.mriSafetyInfo} {...ro(deviceFieldsLocked)} onChange={(e) => update({ mriSafetyInfo: e.target.value })}/></div>
          <div className="col-md-3"><label className="pcid-label-name">Natural Rubber Latex Status</label><input type="text" className="form-control" value={form.naturalRubberLatexStatus} {...ro(deviceFieldsLocked)} onChange={(e) => update({ naturalRubberLatexStatus: e.target.value })}/></div>
        </div>
      </div>

      {/* ---- Implantation details ---- */}
      <div className="pcid-add-edit-device-details px-3 p-2 my-3">
        <div className="row g-3">
          <div className="col-12"><label className="pcid-label-name-header">Implantation Details</label></div>
          <div className="col-md-3">
            <label className="pcid-label-name">Implantation Date <span className="text-danger">*</span></label>
            <FlatpickrDateTimeInput value={form.implantDate} enableTime={false} dateFormat="m-d-Y" placeholder="MM-DD-YYYY" minDate={implantMin} maxDate={implantMax}
              onChange={(v) => { update({ implantDate: v }); clearError('implantDate'); }}/>
            {form.expiryDate && form.implantDate && md(form.expiryDate)?.isSame(md(form.implantDate), 'day') && (
              <p className="implantation-alert-message m-0 mt-2"><LegacyIcon icon="fa-exclamation-triangle"/> <b>Device is expiring on the implantation date, Please verify.</b></p>
            )}
            <FieldError message={errors.implantDate}/>
          </div>
          <div className="col-md-3">
            <label className="pcid-label-name">Body Site</label>
            <AsyncSelect classNamePrefix="react-select" placeholder="Enter at least 3 characters to search" isClearable cacheOptions defaultOptions={false}
              value={form.bodySiteId ? { value: form.bodySiteId, label: form.bodySite } : null}
              loadOptions={loadBodySite}
              onChange={(o) => { update({ bodySiteId: o?.value || '', bodySite: o?.label || '' }); clearError('bodySite'); }}
              noOptionsMessage={({ inputValue }) => ((inputValue || '').length < LOOKUP_MIN_CHARS ? `Type at least ${LOOKUP_MIN_CHARS} characters` : 'No results found')}/>
            <FieldError message={errors.bodySite}/>
          </div>
          <div className="col-md-3">
            <label className="pcid-label-name">Provider Name</label>
            <input type="text" className="form-control" maxLength={50} value={form.implantProviderName} onChange={(e) => update({ implantProviderName: e.target.value })}/>
          </div>
          <div className="col-md-3">
            <label className="pcid-label-name">Reason for Implantation</label>
            <input type="text" className="form-control" maxLength={1000} value={form.reasonForImplant} onChange={(e) => update({ reasonForImplant: e.target.value })}/>
          </div>
        </div>
        {/* Link to Procedure / Surgical History (selection list is inactive in legacy; chips + add-new preserved) */}
        <div className="row g-3 mt-1">
          <div className="col-12"><label className="pcid-label-name">Link to Procedure / Surgical History</label></div>
          <div className="col-12 d-flex align-items-center gap-4">
            <div className="form-check"><label className="form-check-label pcid-label-name"><input className="form-check-input me-1" type="radio" name="implantLink" checked={linkMode === 'PROCEDURE'} onChange={() => setLinkMode('PROCEDURE')}/> Procedure Entry</label></div>
            <div className="form-check"><label className="form-check-label pcid-label-name"><input className="form-check-input me-1" type="radio" name="implantLink" checked={linkMode === 'SURGICAL'} onChange={() => setLinkMode('SURGICAL')}/> Surgical History</label></div>
            {linkMode === 'PROCEDURE' && <button type="button" className="btn btn-sm btn-outline-secondary" disabled={addNewDisabled} title="Available after the Procedure section is migrated"><LegacyIcon icon="mdi-plus"/> Add New Procedure</button>}
            {linkMode === 'SURGICAL' && <button type="button" className="btn btn-sm btn-outline-secondary" disabled={addNewDisabled} title="Available after the Surgical History section is migrated"><LegacyIcon icon="mdi-plus"/> Add Surgical History</button>}
          </div>
          {!!form.procedureChips.length && (<div className="col-md-6 pcid-show-selected-implant-procedure-list-container">
            {form.procedureChips.map((c) => (<div key={c.id} className="pcid-selected-link-chip p-2 my-1 d-flex justify-content-between align-items-center">
              <span>{`${c.procedureCode || ''}${c.procedureCode ? '-' : ''}${c.procedureDescription || ''}`}</span>
              <span role="button" className="cursor-pointer" onClick={() => removeChip('procedureChips', c.id)}>X</span>
            </div>))}
          </div>)}
          {!!form.surgicalChips.length && (<div className="col-md-6 pcid-show-selected-implant-surgical-list-container">
            {form.surgicalChips.map((c) => (<div key={c.id} className="pcid-selected-link-chip p-2 my-1 d-flex justify-content-between align-items-center">
              <span>{c.surgeryName || c.surgeryCode}</span>
              <span role="button" className="cursor-pointer" onClick={() => removeChip('surgicalChips', c.id)}>X</span>
            </div>))}
          </div>)}
        </div>
        <div className="row g-3 mt-1">
          <div className="col-12">
            <label className="pcid-label-name">Notes</label>
            <textarea className="form-control" style={{ height: 50 }} maxLength={5000} value={form.notes} onChange={(e) => update({ notes: e.target.value })}/>
            <div style={{ textAlign: 'end' }}><label>({form.notes.trim().length}/5000)</label></div>
          </div>
        </div>
      </div>

      {/* ---- Explantation details ---- */}
      <div className="pcid-add-edit-explantation-details px-3 p-2 my-3">
        <label className="pcid-label-name" style={{ fontWeight: 600 }}>
          <input type="checkbox" className="form-check-input me-2" checked={form.explantFlag} onChange={(e) => { update({ explantFlag: e.target.checked }); clearError('explantDate'); clearError('reasonForExplant'); }}/>Explantation Details
        </label>
        {form.explantFlag && (<div className="row g-3 mt-1">
          <div className="col-md-4">
            <label className="pcid-label-name">Explantation Date <span className="text-danger">*</span></label>
            <FlatpickrDateTimeInput value={form.explantDate} enableTime={false} dateFormat="m-d-Y" placeholder="MM-DD-YYYY" minDate={explantMin} maxDate={today}
              onChange={(v) => { update({ explantDate: v }); clearError('explantDate'); }}/>
            <FieldError message={errors.explantDate}/>
          </div>
          <div className="col-md-12">
            <label className="pcid-label-name">Reason for Explantation <span className="text-danger">*</span></label>
            <textarea className="form-control" maxLength={500} value={form.reasonForExplant} onChange={(e) => { update({ reasonForExplant: e.target.value }); clearError('reasonForExplant'); }}/>
            <div style={{ textAlign: 'end' }}><label>({form.reasonForExplant.trim().length}/500)</label></div>
            <FieldError message={errors.reasonForExplant}/>
          </div>
        </div>)}
      </div>

      {saveError && (<div className={`mt-2 small ${saveError.tone === 'warning' ? 'text-warning' : 'text-danger'}`}><LegacyIcon icon="fa-exclamation-triangle" className="me-1"/>{saveError.message}</div>)}

      {duplicatePrompt && (<div className="alert alert-warning mt-2">
        This device appears to already exist for the patient. Add it anyway?
        <div className="d-flex gap-2 mt-2">
          <button type="button" className="btn btn-sm btn-secondary" onClick={() => setDuplicatePrompt(false)} disabled={saving}>No</button>
          <button type="button" className="btn btn-sm btn-primary" onClick={() => { setDuplicatePrompt(false); doSave(true); }} disabled={saving}>Yes, add</button>
        </div>
      </div>)}

      <FormStatusFooter
        dirty={dirty}
        saving={saving}
        onCancel={() => onClose(false)}
        onSave={handleSave}
        saveType="button"
        saveLabel={isEdit ? 'Update' : 'Save'}
      />
    </div>);
};
export default PatientImplantableDeviceAddEdit;
