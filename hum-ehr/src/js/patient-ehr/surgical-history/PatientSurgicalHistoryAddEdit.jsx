import { useEffect, useMemo, useRef, useState } from 'react';
import moment from '../../../utils/dayjs';
import AsyncSelect from 'react-select/async';
import { Dialog } from 'primereact/dialog';
import {
    buildSurgicalHistorySavePayload, saveSurgicalHistory,
    fetchSurgeryNameLookup, deleteSurgicalHistoryReport,
} from '../../../services/surgicalHistoryService';
import { fetchImplantBodySiteLookup } from '../../../services/implantDeviceService';
import { fetchProblemStatusMetadata } from '../../../services/lookupService';
import { fetchPatientDetails } from '../../../services/patientService';
import patientCache from '../../../utils/patientCache';
import { getSaveOutcome } from '../../../utils/saveResponse';
import { LOOKUP_MIN_CHARS } from '../../../constants/timing';
import FlatpickrDateTimeInput from '../../../components/common/FlatpickrDateTimeInput';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import UniversalFileUploader from '../../../components/common/UniversalFileUploader';
import DiagnosisPicker from '../../../components/common/DiagnosisPicker';
import FormStatusFooter from '../../../components/common/FormStatusFooter';
import PatientProblemsAddEdit from '../problems/PatientProblemsAddEdit';
import { useNotify } from '../../../context/NotificationContext';

const FieldError = ({ message }) => (message ? <div className="small text-danger mt-1">{message}</div> : null);
const dateOnly = (value) => {
    if (!value) return '';
    const parsed = moment(value, ['MM-DD-YYYY hh:mm A', 'MM-DD-YYYY', moment.ISO_8601], true);
    return parsed.isValid() ? parsed.format('MM-DD-YYYY') : value;
};

/**
 * Surgical history add/edit (legacy patient-surgical-history-add-edit). Inline view
 * swap: surgery-name lookup (locked on edit), surgery date (DOB..today, date-only,
 * saved with the current time appended), surgeon/location, the shared diagnosis picker
 * ("Reason for Surgery"), body site, the Universal File Uploader (pdf/jpg/jpeg/png),
 * and notes. Save → /surgical-history/saveOrUpdate; a duplicate rejection from the
 * backend surfaces its message on the form.
 */
const PatientSurgicalHistoryAddEdit = ({ patientId, record, onClose }) => {
    const isEdit = !!record?.id;
    const { notifyError, notifySuccess } = useNotify();
    const uploaderRef = useRef(null);

    const [form, setForm] = useState(() => ({
        id: record?.id || '',
        surgeryName: record?.surgeryName || '',
        surgeryCode: record?.surgeryCode || '',
        surgeryId: record?.surgeryId || '',
        surgeryDate: record ? dateOnly(record.surgeryDateTime) : '',
        surgeonName: record?.surgeonName || '',
        surgeonFacilityName: record?.surgeonFacilityName || '',
        bodySiteId: record?.bodySiteId || '', bodySite: record?.bodysiteDescription || '',
        notes: record?.notes || '',
    }));
    const [diagnosisList, setDiagnosisList] = useState(() => (record?.diagnosisList ? record.diagnosisList.map((d) => ({ ...d })) : []));
    const [dialogOpen, setDialogOpen] = useState(false);
    const [problemMetadata, setProblemMetadata] = useState(null);
    const [diagnosisRefresh, setDiagnosisRefresh] = useState(0);
    const [dob, setDob] = useState('');
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [dirty, setDirty] = useState(false);

    const initialAttachments = useMemo(() => (record?.fileDetail || []).map((f) => ({
        attachmentId: f.attachmentId,
        fileName: f.fileName,
        fileFormat: f.fileFormat,
        fileSize: f.attachmentSize,
        file: f.file || null,
    })), [record]);

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

    const update = (patch) => { setDirty(true); setForm((p) => ({ ...p, ...patch })); };
    const clearError = (key) => setErrors((prev) => { if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });

    const loadSurgeryNames = (input) => ((input || '').trim().length < LOOKUP_MIN_CHARS
        ? Promise.resolve([])
        : fetchSurgeryNameLookup(input).then((list) => list.map((o) => ({ value: o.id, label: o.value, code: o.code }))));
    const loadBodySite = (input) => ((input || '').trim().length < LOOKUP_MIN_CHARS
        ? Promise.resolve([])
        : fetchImplantBodySiteLookup(input).then((list) => list.map((o) => ({ value: o.id, label: o.value }))));

    const openAddDiagnosis = async () => {
        try {
            if (!problemMetadata) setProblemMetadata(await fetchProblemStatusMetadata());
            setDialogOpen(true);
        }
        catch (error) { console.error('Failed to load problem metadata.', error); notifyError('Failed to load diagnosis form. Please try again.'); }
    };

    const validate = () => {
        const next = {};
        if (!form.surgeryName.trim()) next.surgeryName = 'Surgery Name is required';
        if (!form.surgeryDate) next.surgeryDate = 'Please enter surgery date.';
        if (form.surgeonName.length > 100) next.surgeonName = 'Maximum 100 characters.';
        // Legacy pc_patient_sh_surgeon → onlyAlphabets.
        else if (form.surgeonName.trim() && !/^([a-zA-Z][\s]?)*$/i.test(form.surgeonName)) next.surgeonName = 'Only alphabets and single space are allowed.';
        if (form.surgeonFacilityName.length > 100) next.surgeonFacilityName = 'Maximum 100 characters.';
        // Legacy pc_patient_sh_surgeon_facility → alphaNumericWithSpace.
        else if (form.surgeonFacilityName.trim() && !/^ ?\s*([a-zA-Z0-9.#',&-]+\s?)*$/i.test(form.surgeonFacilityName)) next.surgeonFacilityName = "Only alphanumeric characters, single space and special characters(.,#-'&) are allowed.";
        if (form.notes.length > 5000) next.notes = 'Maximum 5000 characters.';
        return next;
    };

    const handleSave = async () => {
        setSaveError(null);
        const v = validate();
        setErrors(v);
        if (Object.keys(v).length) return;
        setSaving(true);
        try {
            const { newFiles, existingFiles, deletedFiles } = uploaderRef.current
                ? uploaderRef.current.getUpdatePayload()
                : { newFiles: [], existingFiles: [], deletedFiles: [] };
            // Legacy deletes removed reports through the report-delete endpoint (the save
            // payload only carries kept + new files).
            for (const deleted of deletedFiles) {
                try { await deleteSurgicalHistoryReport(deleted.attachmentId); }
                catch (error) { console.error('Failed to delete the surgical history report.', error); }
            }
            const careplanId = patientCache.get(`${patientId}_details`)?.carePlanId ?? record?.careplanId ?? null;
            const payload = buildSurgicalHistorySavePayload({
                patientId, careplanId, form, diagnosisList,
                files: [
                    ...newFiles.map((f) => ({ ...f, displaySizeKb: (f.attachmentSize ?? 0).toFixed ? Number(f.attachmentSize).toFixed(2) : f.attachmentSize })),
                    ...existingFiles,
                ],
            });
            const response = await saveSurgicalHistory(payload);
            if (response?.status === 'failure') {
                // server-side duplicate validation — show its message on the form (legacy behavior)
                setSaveError({ tone: 'error', message: typeof response.data === 'string' ? response.data : 'Failed to get Patient Surgical History Details.Please try again.' });
                return;
            }
            const outcome = getSaveOutcome(response, 'Failed to get Patient Surgical History Details.Please try again.');
            if (outcome.ok) {
                notifySuccess(form.id ? 'Patient Surgical History updated successfully.' : 'Patient Surgical History saved successfully.');
                onClose(true, form.id || null);
                return;
            }
            setSaveError(outcome);
        }
        catch (error) {
            console.error('Failed to save surgical history.', error);
            setSaveError({ tone: 'error', message: error?.message || 'Failed to get Patient Surgical History Details.Please try again.' });
        }
        finally { setSaving(false); }
    };

    const today = useMemo(() => moment().format('MM-DD-YYYY'), []);

    return (<div className="pc-patient-surgical-history-add-edit-main-container">
      <div className="mb-3 d-flex align-items-center gap-2">
        <span role="button" onClick={() => { if (window.confirm('Are you sure about to exit surgical history form?')) onClose(false); }}>
          <LegacyIcon icon="mdi-arrow-left" style={{ fontSize: 20 }}/>
        </span>
        <span className="fw-bold">{isEdit ? 'Edit Surgical History' : 'Add Surgical History'}</span>
      </div>
      <form id={`pc_patient_surgical_history_add_edit_form_${patientId}`} autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSave(); }} noValidate>
        <fieldset style={{ borderRadius: 12, border: '1px solid #D7DDE3', padding: 12 }}>
          <div className="row g-3 mx-1">
            <div className="col-md-3">
              <label className="fw-semibold">Surgery Name <span className="text-danger">*</span></label>
              <AsyncSelect classNamePrefix="react-select" placeholder="Search Surgery Name" isClearable isDisabled={isEdit}
                cacheOptions defaultOptions={false} loadOptions={loadSurgeryNames}
                value={form.surgeryName ? { value: form.surgeryId || form.surgeryName, label: form.surgeryName } : null}
                onChange={(o) => { update({ surgeryId: o?.value || '', surgeryName: o?.label || '', surgeryCode: o?.code || '' }); clearError('surgeryName'); }}
                noOptionsMessage={({ inputValue }) => ((inputValue || '').length < LOOKUP_MIN_CHARS ? `Type at least ${LOOKUP_MIN_CHARS} characters` : 'No results found')}/>
              <FieldError message={errors.surgeryName}/>
            </div>
            <div className="col-md-3">
              <label className="fw-semibold">Surgery Date <span className="text-danger">*</span></label>
              <FlatpickrDateTimeInput value={form.surgeryDate} enableTime={false} dateFormat="m-d-Y" placeholder="MM-DD-YYYY"
                minDate={dob || undefined} maxDate={today}
                onChange={(val) => { update({ surgeryDate: val }); clearError('surgeryDate'); }}/>
              <FieldError message={errors.surgeryDate}/>
            </div>
            <div className="col-md-3">
              <label className="fw-semibold">Surgeon</label>
              <input type="text" className="form-control text-capitalize" maxLength={100} value={form.surgeonName} onChange={(e) => { update({ surgeonName: e.target.value }); clearError('surgeonName'); }}/>
              <FieldError message={errors.surgeonName}/>
            </div>
            <div className="col-md-3">
              <label className="fw-semibold">Surgery Location</label>
              <input type="text" className="form-control text-capitalize" maxLength={100} value={form.surgeonFacilityName} onChange={(e) => { update({ surgeonFacilityName: e.target.value }); clearError('surgeonFacilityName'); }}/>
              <FieldError message={errors.surgeonFacilityName}/>
            </div>
          </div>
          <div className="row g-3 mx-1 mt-1">
            <div className="col-md-6">
              <DiagnosisPicker patientId={patientId} value={diagnosisList} onChange={(list) => { setDirty(true); setDiagnosisList(list); }}
                title="Reason for Surgery" labels={{ problem: 'Problem Diagnosis', encounter: 'Encounter Diagnosis' }}
                onAddNew={openAddDiagnosis} refreshKey={diagnosisRefresh}/>
            </div>
            <div className="col-md-6">
              <label className="fw-semibold">Body Site</label>
              <AsyncSelect classNamePrefix="react-select" placeholder="Search Body Site" isClearable cacheOptions defaultOptions={false}
                loadOptions={loadBodySite}
                value={form.bodySiteId ? { value: form.bodySiteId, label: form.bodySite } : null}
                onChange={(o) => update({ bodySiteId: o?.value || '', bodySite: o?.label || '' })}
                noOptionsMessage={({ inputValue }) => ((inputValue || '').length < LOOKUP_MIN_CHARS ? `Type at least ${LOOKUP_MIN_CHARS} characters` : 'No results found')}/>
            </div>
          </div>
          <div className="row g-3 mx-1 mt-1">
            <div className="col-md-6">
              <fieldset className="pc-patient-surgical-history-add-edit-fieldset">
                <legend className="fw-semibold" style={{ fontSize: 14, float: 'none', marginBottom: 0 }}>Upload Documents</legend>
                <UniversalFileUploader ref={uploaderRef} name={`pc_patient_suh_surgical_report_${patientId}`}
                  maxFiles={5} maxSizeMB={5} allowedTypes="pdf,jpg,jpeg,png"
                  initialAttachments={isEdit ? initialAttachments : null} onChange={() => setDirty(true)}/>
              </fieldset>
            </div>
            <div className="col-md-6">
              <label className="fw-semibold">Notes</label>
              <textarea className="form-control" style={{ height: 50, resize: 'none' }} maxLength={5000} placeholder="Enter notes here..." value={form.notes} onChange={(e) => { update({ notes: e.target.value }); clearError('notes'); }}/>
              <FieldError message={errors.notes}/>
            </div>
          </div>
        </fieldset>

        {saveError && (<div className={`mt-3 small ${saveError.tone === 'warning' ? 'text-warning' : 'text-danger'}`}><LegacyIcon icon="fa-exclamation-triangle" className="me-1"/>{saveError.message}</div>)}

        <FormStatusFooter
          dirty={dirty}
          saving={saving}
          onCancel={() => { if (window.confirm('Are you sure about cancel surgical history form?')) onClose(false); }}
          saveLabel="Save"
        />
      </form>

      <Dialog visible={dialogOpen} onHide={() => { setDialogOpen(false); setDiagnosisRefresh((k) => k + 1); }} header="Add Problem" style={{ width: '75vw' }} breakpoints={{ '768px': '98vw' }}>
        {dialogOpen && problemMetadata && (
          <PatientProblemsAddEdit patientId={patientId} problemRecord={null} actionType="add" statusMetadata={problemMetadata}
            onClose={() => { setDialogOpen(false); setDiagnosisRefresh((k) => k + 1); }}/>
        )}
      </Dialog>
    </div>);
};
export default PatientSurgicalHistoryAddEdit;
