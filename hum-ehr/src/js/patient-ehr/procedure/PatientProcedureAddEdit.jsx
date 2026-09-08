import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import moment from '../../../utils/dayjs';
import AsyncSelect from 'react-select/async';
import { Dialog } from 'primereact/dialog';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import {
    buildProcedureSavePayload, saveProcedure,
    fetchProcedureNameLookup, fetchReferralReasonLookup, fetchSdohInterventionLookup,
    fetchComplicationLookup, fetchLocationLookup,
} from '../../../services/procedureService';
import { fetchImplantBodySiteLookup, fetchImplantDeviceList } from '../../../services/implantDeviceService';
import { fetchProblemStatusMetadata } from '../../../services/lookupService';
import { fetchPatientDetails } from '../../../services/patientService';
import patientCache from '../../../utils/patientCache';
import { getSaveOutcome } from '../../../utils/saveResponse';
import { LOOKUP_MIN_CHARS } from '../../../constants/timing';
import FlatpickrDateTimeInput from '../../../components/common/FlatpickrDateTimeInput';
import UniversalFileUploader from '../../../components/common/UniversalFileUploader';
import DiagnosisPicker from '../../../components/common/DiagnosisPicker';
import FormStatusFooter from '../../../components/common/FormStatusFooter';
import PatientProblemsAddEdit from '../problems/PatientProblemsAddEdit';
import PatientImplantableDeviceUDI from '../implantable-device/PatientImplantableDeviceUDI';
import PatientImplantableDeviceAddEdit from '../implantable-device/PatientImplantableDeviceAddEdit';
import { useNotify } from '../../../context/NotificationContext';

const FieldError = ({ message }) => (message ? <div className="small text-danger mt-1">{message}</div> : null);
const asyncSelectProps = (loader) => ({
    classNamePrefix: 'react-select', isClearable: true, cacheOptions: true, defaultOptions: false,
    loadOptions: (input) => ((input || '').trim().length < LOOKUP_MIN_CHARS
        ? Promise.resolve([])
        : loader(input).then((list) => list.map((o) => ({ value: o.id, label: o.value, code: o.code })))),
    noOptionsMessage: ({ inputValue }) => ((inputValue || '').length < LOOKUP_MIN_CHARS ? `Type at least ${LOOKUP_MIN_CHARS} characters` : 'No results found'),
});

/**
 * Procedure add/edit (legacy patient-procedure-details-add-edit). Inline view swap (not
 * a modal): performer/date/location/category, PRCNA procedure lookup, body site, the
 * shared diagnosis picker (+ Add New Diagnosis → Problems form), implantable-device
 * linkage (+ Add New Implantable Device → UDI flow), SDOH / referral-reason lookups,
 * status/outcome/complications, follow-up block with interdependent requireds, the
 * Universal File Uploader, and notes. Save → POST /soap/plan/procedure/saveOrUpdate.
 */
const PatientProcedureAddEdit = ({ patientId, record, reference, onClose }) => {
    const isEdit = !!record?.id;
    const { notifyError, notifySuccess } = useNotify();
    const uploaderRef = useRef(null);

    const [form, setForm] = useState(() => ({
        id: record?.id || '',
        procedureId: record?.procedureId || '',
        procedureName: record ? `${record.procedureCode} - ${record.procedureDescription}` : '',
        performedBy: record?.performedBy || '',
        dateOfService: record?.dateOfService || '',
        placeOfServiceId: record?.placeOfServiceId || '', placeOfService: record?.placeOfService || '',
        procedureCategory: record?.procedureCategory || '',
        bodySiteId: record?.bodySiteId || '', bodySite: record?.bodysiteDescription || '',
        sdohInterventionId: record?.sdohInterventionId || '', sdohInterventionDescription: record?.sdohInterventionDescription || '',
        referralReasonId: record?.referralReasonId || '', referralReason: record?.referralReasonDescription || '',
        procedureStatus: record?.procedureStatus || '',
        procedureOutcome: record?.procedureOutcome || '',
        procedureComplication: record?.procedureComplication || '', complicationDescription: record?.procedureComplicationDescription || '',
        followUp: !!(record?.followUpDate || record?.procedureFollowUp || record?.procedureFollowUpDescription),
        followUpDate: record?.followUpDate || '',
        procedureFollowUp: record?.procedureFollowUp || '',
        instruction: record?.instruction || '',
        notes: record?.notes || '',
    }));
    const [diagnosisList, setDiagnosisList] = useState(() => (record?.diagnosisList ? record.diagnosisList.map((d) => ({ ...d })) : []));
    const [devices, setDevices] = useState([]); // available active devices
    const [deviceLinks, setDeviceLinks] = useState(() => (Array.isArray(record?.deviceList)
        ? record.deviceList.filter((d) => d.invalidFlag === 'N').map((d) => ({ linkId: d.id, deviceId: d.deviceId, label: d.deviceName || d.deviceType, existing: true, removed: false, raw: d }))
        : []));
    const [devicePickerOpen, setDevicePickerOpen] = useState(false);
    const [dialog, setDialog] = useState({ type: null });
    const [problemMetadata, setProblemMetadata] = useState(null);
    const [diagnosisRefresh, setDiagnosisRefresh] = useState(0);
    const [dob, setDob] = useState('');
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [dirty, setDirty] = useState(false);
    const devicePickerRef = useRef(null);

    const update = (patch) => { setDirty(true); setForm((p) => ({ ...p, ...patch })); };
    const clearError = (key) => setErrors((prev) => { if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });

    // Active implantable devices for the linkage dropdown.
    const loadDevices = useCallback(async () => {
        try {
            const { records } = await fetchImplantDeviceList({ patientId, recordType: 'active' });
            setDevices(records);
        }
        catch (error) { console.error('Failed to fetch implanted device details.', error); }
    }, [patientId]);
    useEffect(() => { loadDevices(); }, [loadDevices]);

    // Patient DOB for the performed-date lower bound.
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

    useEffect(() => {
        if (!devicePickerOpen) return undefined;
        const close = (e) => { if (devicePickerRef.current && !devicePickerRef.current.contains(e.target)) setDevicePickerOpen(false); };
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [devicePickerOpen]);

    const openAddDiagnosis = async () => {
        try {
            if (!problemMetadata) setProblemMetadata(await fetchProblemStatusMetadata());
            setDialog({ type: 'diagnosis' });
        }
        catch (error) { console.error('Failed to load problem metadata.', error); notifyError('Failed to load diagnosis form. Please try again.'); }
    };

    const deviceChecked = (deviceId) => deviceLinks.some((l) => String(l.deviceId) === String(deviceId) && !l.removed);
    const toggleDevice = (device, checked) => {
        setDirty(true);
        setDeviceLinks((prev) => {
            const idx = prev.findIndex((l) => String(l.deviceId) === String(device.id));
            if (checked) {
                if (idx > -1) return prev.map((l, i) => (i === idx ? { ...l, removed: false } : l));
                return [...prev, { linkId: null, deviceId: device.id, label: device.deviceName || device.deviceType, existing: false, removed: false }];
            }
            if (idx > -1) {
                const link = prev[idx];
                // brand-new selections just drop; existing links are kept + flagged for deletion
                return link.existing ? prev.map((l, i) => (i === idx ? { ...l, removed: true } : l)) : prev.filter((_, i) => i !== idx);
            }
            return prev;
        });
    };

    const validate = () => {
        const next = {};
        if (!form.procedureId || !form.procedureName.trim()) next.procedureName = 'Procedure is required';
        if (!form.dateOfService) next.dateOfService = 'Performed date is required';
        if (!form.performedBy.trim()) next.performedBy = 'performer is required.';
        else if (form.performedBy.length > 100) next.performedBy = 'Maximum 100 characters.';
        // Legacy pcps_patient_procedure_performer_name → onlyAlphabets.
        else if (!/^([a-zA-Z][\s]?)*$/i.test(form.performedBy)) next.performedBy = 'Only alphabets and single space are allowed.';
        if (!form.procedureStatus) next.procedureStatus = 'Status is required.';
        if (!form.referralReasonId) next.referralReason = 'Reason for referral is required';
        if (form.followUp) {
            // legacy interdependent requires
            if ((form.instruction || form.procedureFollowUp) && !form.followUpDate) next.followUpDate = 'Follow up date is required.';
            if (form.followUpDate && !form.instruction) next.instruction = 'Follow up detail is required.';
            if (form.followUpDate && !form.procedureFollowUp) next.procedureFollowUp = 'Follow type is required.';
        }
        return next;
    };

    const handleSave = async () => {
        setSaveError(null);
        const v = validate();
        setErrors(v);
        if (Object.keys(v).length) return;
        setSaving(true);
        try {
            const { newFiles, deletedFiles } = uploaderRef.current
                ? uploaderRef.current.getUpdatePayload()
                : { newFiles: [], deletedFiles: [] };
            const deviceList = [
                ...deviceLinks.filter((l) => !l.existing && !l.removed).map((l) => ({ id: null, deviceId: l.deviceId })),
                ...deviceLinks.filter((l) => l.existing && l.removed).map((l) => l.raw),
            ];
            const payload = buildProcedureSavePayload({
                patientId,
                form: { ...form, followUpDate: form.followUp ? form.followUpDate : null, procedureFollowUp: form.followUp ? form.procedureFollowUp : null, instruction: form.followUp ? form.instruction : (form.instruction || null) },
                diagnosisList,
                fileDetail: [...newFiles, ...deletedFiles],
                deviceList,
            });
            const response = await saveProcedure(payload);
            const outcome = getSaveOutcome(response, 'Failed to update Procedure details. Please try again.');
            if (outcome.ok) {
                notifySuccess(form.id ? 'Procedure details updated successfully.' : 'Procedure details saved successfully.');
                onClose(true, form.id || null);
                return;
            }
            setSaveError(outcome);
        }
        catch (error) {
            console.error('Failed to save procedure details.', error);
            setSaveError({ tone: 'error', message: error?.message || 'Failed to update Procedure details. Please try again.' });
        }
        finally { setSaving(false); }
    };

    const dateTimeProps = { enableTime: true, dateFormat: 'm-d-Y h:i K', placeholder: 'MM-DD-YYYY HH:MM AM/PM' };
    const now = useMemo(() => moment().format('MM-DD-YYYY hh:mm A'), []);
    const followUpMax = useMemo(() => moment().add(10, 'years').format('MM-DD-YYYY'), []);
    const optionFor = (id, label) => (id ? { value: id, label } : null);

    return (<div className="container-fluid">
      <div className="row">
        <div className="d-flex align-items-center gap-2 mb-2">
          <LegacyIcon icon="mdi-arrow-left" className="back-to-icon" role="button" style={{ fontSize: 20 }} onClick={() => { if (window.confirm('Are u sure about to exit procedure form?')) onClose(false); }}/>
          <span className="fw-bold" style={{ fontSize: '1rem' }}>{isEdit ? 'Edit Procedure' : 'Add Procedure'}</span>
        </div>
      </div>
      <form id={`pcps_patient_procedure_add_edit_form_${patientId}`} autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSave(); }} noValidate>
        <div className="row g-3">
          <div className="col-md-3">
            <label className="label-name fw-bold">Performer <span className="text-danger">*</span></label>
            <input type="text" className="form-control text-capitalize" maxLength={100} value={form.performedBy} onChange={(e) => { update({ performedBy: e.target.value }); clearError('performedBy'); }}/>
            <FieldError message={errors.performedBy}/>
          </div>
          <div className="col-md-3">
            <label className="label-name fw-bold">Performed Date &amp; Time <span className="text-danger">*</span></label>
            <FlatpickrDateTimeInput value={form.dateOfService} {...dateTimeProps} minDate={dob || undefined} maxDate={now}
              onChange={(val) => { update({ dateOfService: val }); clearError('dateOfService'); }}/>
            <FieldError message={errors.dateOfService}/>
          </div>
          <div className="col-md-3">
            <label className="label-name fw-bold">Location</label>
            <AsyncSelect {...asyncSelectProps(fetchLocationLookup)} placeholder="Search Location"
              value={optionFor(form.placeOfServiceId, form.placeOfService)}
              onChange={(o) => update({ placeOfServiceId: o?.value || '', placeOfService: o?.label || '' })}/>
          </div>
          <div className="col-md-3">
            <label className="label-name fw-bold">Procedure Category</label>
            <select className="form-select form-control form-select-sm" value={form.procedureCategory} onChange={(e) => update({ procedureCategory: e.target.value })}>
              <option value="">Select Procedure Category</option>
              {(reference.categories || []).map((o) => <option key={o.id} value={o.id}>{o.description}</option>)}
            </select>
          </div>
        </div>
        <div className="row g-3 mt-1">
          <div className="col-md-6">
            <label className="label-name fw-bold">Procedure-Name <span className="text-danger">*</span></label>
            <AsyncSelect {...asyncSelectProps(fetchProcedureNameLookup)} placeholder="Search Procedure Name" isDisabled={isEdit}
              value={form.procedureId ? { value: form.procedureId, label: form.procedureName } : null}
              onChange={(o) => { update({ procedureId: o?.value || '', procedureName: o?.label || '' }); clearError('procedureName'); }}/>
            <FieldError message={errors.procedureName}/>
          </div>
          <div className="col-md-6">
            <label className="label-name fw-bold">Body Site</label>
            <AsyncSelect {...asyncSelectProps(fetchImplantBodySiteLookup)} placeholder="Search Body Site"
              value={optionFor(form.bodySiteId, form.bodySite)}
              onChange={(o) => update({ bodySiteId: o?.value || '', bodySite: o?.label || '' })}/>
          </div>
        </div>
        <div className="row g-3 mt-1">
          <div className="col-md-6">
            <DiagnosisPicker patientId={patientId} value={diagnosisList} onChange={(list) => { setDirty(true); setDiagnosisList(list); }}
              labels={{ problem: 'Problem List', encounter: 'Encounter List' }}
              onAddNew={openAddDiagnosis} refreshKey={diagnosisRefresh}/>
          </div>
          <div className="col-md-6">
            <div className="d-flex justify-content-between align-items-center mb-1">
              <label className="label-name mb-0">Implantable Device</label>
              <a href="#" className="pcps-add-new-device-link fw-bold small" onClick={(e) => { e.preventDefault(); setDialog({ type: 'deviceUdi' }); }}>Add New Implantable Device</a>
            </div>
            <div className="position-relative" ref={devicePickerRef}>
              <button type="button" className="form-control form-select form-select-sm text-start" onClick={() => setDevicePickerOpen((v) => !v)}>Select Implantable Device</button>
              {devicePickerOpen && (<div className="pcps-device-picker-menu">
                {devices.length ? devices.map((device) => (
                  <div key={device.id} className="form-group form-check d-flex align-items-center mx-2 mb-1">
                    <input type="checkbox" className="form-check-input me-2" id={`proc_dev_${device.id}`} checked={deviceChecked(device.id)} onChange={(e) => toggleDevice(device, e.target.checked)}/>
                    <label className="form-check-label" htmlFor={`proc_dev_${device.id}`}>{device.deviceName || device.deviceType}</label>
                  </div>
                )) : <div className="text-center text-muted p-2">Patient does not have any implantable device</div>}
              </div>)}
            </div>
            <div>
              {deviceLinks.filter((l) => !l.removed).map((l) => (
                <div key={`${l.deviceId}_${l.linkId || 'new'}`} className="pcps-device-chip">
                  <div className="d-flex p-1 gap-2 justify-content-between me-2 align-items-center">
                    <span style={{ color: '#37474F' }}>{l.label}</span>
                    <span className="pcps-device-chip-delete" role="button" onClick={() => toggleDevice({ id: l.deviceId }, false)}>
                      <svg width="10" height="8" viewBox="0 0 6 6" fill="none"><path d="M5.86827 0.769502C6.04448 0.593295 6.04448 0.308363 5.86827 0.13403C5.69207 -0.0403028 5.40713 -0.0421774 5.2328 0.13403L3.00209 2.36474L0.769502 0.132156C0.593295 -0.0440519 0.308363 -0.0440519 0.13403 0.132156C-0.0403028 0.308363 -0.0421774 0.593294 0.13403 0.767627L2.36474 2.99834L0.132156 5.23093C-0.0440519 5.40713 -0.0440519 5.69207 0.132156 5.8664C0.308363 6.04073 0.593295 6.04261 0.767628 5.8664L2.99834 3.63569L5.23093 5.86827C5.40713 6.04448 5.69207 6.04448 5.8664 5.86827C6.04073 5.69207 6.04261 5.40713 5.8664 5.2328L3.63569 3.00209L5.86827 0.769502Z" fill="#D50B0B"/></svg>
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <div className="row g-3 mt-1">
          <div className="col-md-6">
            <label className="label-name fw-bold">SDOH Interventions</label>
            <AsyncSelect {...asyncSelectProps(fetchSdohInterventionLookup)} placeholder="Search SDOH Interventions"
              value={optionFor(form.sdohInterventionId, form.sdohInterventionDescription)}
              onChange={(o) => update({ sdohInterventionId: o?.value || '', sdohInterventionDescription: o?.label || '' })}/>
          </div>
          <div className="col-md-6">
            <label className="label-name fw-bold">Reason for Referral <span className="text-danger">*</span></label>
            <AsyncSelect {...asyncSelectProps(fetchReferralReasonLookup)} placeholder="Search Reason for Referral"
              value={optionFor(form.referralReasonId, form.referralReason)}
              onChange={(o) => { update({ referralReasonId: o?.value || '', referralReason: o?.label || '' }); clearError('referralReason'); }}/>
            <FieldError message={errors.referralReason}/>
          </div>
        </div>
        <div className="row g-3 mt-1">
          <div className="col-md-3">
            <label className="label-name fw-bold">Status <span className="text-danger">*</span></label>
            <select className="form-select form-control form-select-sm" value={form.procedureStatus} onChange={(e) => { update({ procedureStatus: e.target.value }); clearError('procedureStatus'); }}>
              <option value="">Select Procedure Status</option>
              {(reference.statuses || []).map((o) => <option key={o.id} value={o.id} hidden={o.code === 'entered-in-error'}>{o.description}</option>)}
            </select>
            <FieldError message={errors.procedureStatus}/>
          </div>
          <div className="col-md-3">
            <label className="label-name fw-bold">Outcome</label>
            <select className="form-select form-control form-select-sm" value={form.procedureOutcome} onChange={(e) => update({ procedureOutcome: e.target.value })}>
              <option value="">Select Procedure Outcome</option>
              {(reference.outcomes || []).map((o) => <option key={o.id} value={o.id}>{o.description}</option>)}
            </select>
          </div>
          <div className="col-md-6">
            <label className="label-name fw-bold">Complications</label>
            <AsyncSelect {...asyncSelectProps(fetchComplicationLookup)} placeholder="Search Complications"
              value={optionFor(form.procedureComplication, form.complicationDescription)}
              onChange={(o) => update({ procedureComplication: o?.value || '', complicationDescription: o?.label || '' })}/>
          </div>
        </div>
        <div className="row g-3 mt-2">
          <div className="col-12 d-flex align-items-center gap-2">
            <label className="fw-semibold label-name mb-0">Follow Up</label>
            <div className="form-check form-switch mb-0">
              <input className="form-check-input" type="checkbox" role="switch" checked={form.followUp}
                onChange={(e) => { const on = e.target.checked; update(on ? { followUp: true } : { followUp: false, followUpDate: '', procedureFollowUp: '', instruction: isEdit ? form.instruction : '' }); }}/>
            </div>
          </div>
        </div>
        {form.followUp && (<div className="row g-3 mt-1">
          <div className="col-md-3">
            <label className="label-name fw-bold">Follow Up Date</label>
            <FlatpickrDateTimeInput value={form.followUpDate} {...dateTimeProps} minDate={now} maxDate={followUpMax}
              onChange={(val) => { update({ followUpDate: val }); clearError('followUpDate'); }}/>
            <FieldError message={errors.followUpDate}/>
          </div>
          <div className="col-md-3">
            <label className="label-name fw-bold">Follow Up Type</label>
            <select className="form-select form-control form-select-sm" value={form.procedureFollowUp} onChange={(e) => { update({ procedureFollowUp: e.target.value }); clearError('procedureFollowUp'); }}>
              <option value="">Select Type</option>
              {(reference.followUpTypes || []).map((o) => <option key={o.id} value={o.id}>{o.description}</option>)}
            </select>
            <FieldError message={errors.procedureFollowUp}/>
          </div>
          <div className="col-md-6">
            <label className="label-name fw-bold">Follow Up Details</label>
            <textarea className="form-control" style={{ height: 50 }} value={form.instruction} onChange={(e) => { update({ instruction: e.target.value }); clearError('instruction'); }}/>
            <FieldError message={errors.instruction}/>
          </div>
        </div>)}
        <div className="row g-3 mt-1">
          <div className="col-md-6">
            <label className="label-name fw-bold">Upload Documents</label>
            <UniversalFileUploader ref={uploaderRef} name={`patient_procedure_report_${patientId}`} maxFiles={5} maxSizeMB={5}
              allowedTypes="jpeg,jpg,png,docx,doc,pdf" initialAttachments={record?.fileDetail || null} onChange={() => setDirty(true)}/>
          </div>
          <div className="col-md-6">
            <label className="label-name fw-bold">Notes</label>
            <textarea className="form-control" style={{ height: 100 }} value={form.notes} onChange={(e) => update({ notes: e.target.value })}/>
          </div>
        </div>

        {saveError && (<div className={`mt-3 small ${saveError.tone === 'warning' ? 'text-warning' : 'text-danger'}`}><LegacyIcon icon="fa-exclamation-triangle" className="me-1"/>{saveError.message}</div>)}

        <FormStatusFooter
          dirty={dirty}
          saving={saving}
          onCancel={() => { if (window.confirm('Are you sure about cancel procedure form?')) onClose(false); }}
          saveLabel={isEdit ? 'Update' : 'Save'}
        />
      </form>

      {/* Add New Diagnosis → reuse the migrated Problems form */}
      <Dialog visible={dialog.type === 'diagnosis'} onHide={() => { setDialog({ type: null }); setDiagnosisRefresh((k) => k + 1); }} header="Add Problem" style={{ width: '75vw' }} breakpoints={{ '768px': '98vw' }}>
        {dialog.type === 'diagnosis' && problemMetadata && (
          <PatientProblemsAddEdit patientId={patientId} problemRecord={null} actionType="add" statusMetadata={problemMetadata}
            onClose={() => { setDialog({ type: null }); setDiagnosisRefresh((k) => k + 1); }}/>
        )}
      </Dialog>

      {/* Add New Implantable Device → reuse the migrated UDI flow */}
      <Dialog visible={dialog.type === 'deviceUdi'} onHide={() => setDialog({ type: null })} header="Verify the UDI (Unique Device Identifier)" style={{ width: '55vw' }} breakpoints={{ '768px': '95vw' }}>
        {dialog.type === 'deviceUdi' && (<PatientImplantableDeviceUDI patientId={patientId} prefillUdi=""
          onProceed={(seed) => setDialog({ type: 'deviceForm', seed })}
          onVerifiedLater={() => setDialog({ type: null })}
          onCancel={() => setDialog({ type: null })}/>)}
      </Dialog>
      <Dialog visible={dialog.type === 'deviceForm'} onHide={() => setDialog({ type: null })} header="Add Implantable Device Details" style={{ width: '80vw' }} breakpoints={{ '768px': '98vw' }}>
        {dialog.type === 'deviceForm' && (<PatientImplantableDeviceAddEdit patientId={patientId} seed={dialog.seed}
          onClose={(saved) => { setDialog({ type: null }); if (saved) loadDevices(); }}/>)}
      </Dialog>
    </div>);
};
export default PatientProcedureAddEdit;
