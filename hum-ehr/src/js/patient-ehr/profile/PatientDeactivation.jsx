import { useRef, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { getPatientDetails, fetchDeactivationReasons, deactivatePatientUser } from '../../../services/patientProfileService';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import { useNotify } from '../../../context/NotificationContext';

const FieldError = ({ message }) => (message ? <div className="small text-danger mt-1">{message}</div> : null);
const MAX_FILE_SIZE = 5 * 1024 * 1024;

/**
 * Patient Deactivation tab (legacy patient-profile-patient-deactivation):
 * toggle → confirmation modal with reason (POTHR shows notes), an optional
 * single PDF (≤5 MB), save → POST /deactivate/user (multipart). On success the
 * patient workspace tab closes and the app returns to the patient list.
 */
const PatientDeactivation = ({ patientId }) => {
    const { notifySuccess, notifyError } = useNotify();
    const [toggleOn, setToggleOn] = useState(false);
    const [modalOpen, setModalOpen] = useState(false);
    const [reasons, setReasons] = useState([]);
    const [patientName, setPatientName] = useState('');
    const [reason, setReason] = useState('');
    const [notes, setNotes] = useState('');
    const [file, setFile] = useState(null);
    const [errors, setErrors] = useState({});
    const [fileError, setFileError] = useState('');
    const [saving, setSaving] = useState(false);
    const fileInputRef = useRef(null);
    const patientUserIdRef = useRef(null);

    const openModal = async () => {
        try {
            const details = await getPatientDetails(patientId);
            patientUserIdRef.current = details?.userId;
            setPatientName(details?.patientName || '');
            setReasons(await fetchDeactivationReasons(patientId));
            setReason('');
            setNotes('');
            setFile(null);
            setErrors({});
            setFileError('');
            setToggleOn(true);
            setModalOpen(true);
        }
        catch (error) { console.error(error); notifyError('Failed to fetch patient deactivate reasons.'); }
    };

    const closeModal = () => {
        setModalOpen(false);
        setToggleOn(false);
    };

    const handleFileChange = (event) => {
        const selected = event.target.files?.[0];
        event.target.value = '';
        if (!selected) return;
        if (selected.type !== 'application/pdf') {
            setFile(null);
            setFileError('Only PDF files are allowed.');
            return;
        }
        if (selected.size > MAX_FILE_SIZE) {
            setFile(null);
            setFileError(`File "${selected.name}" must be less than 5 MB`);
            return;
        }
        setFileError('');
        setFile(selected);
    };

    const handleSave = async () => {
        const validation = {};
        if (!reason) validation.reason = 'Please provide a reason for deactivation.';
        if (reason === 'POTHR' && !notes.trim()) validation.notes = 'Please provide a reason for deactivation.';
        setErrors(validation);
        if (Object.keys(validation).length || fileError) return;
        setSaving(true);
        try {
            const response = await deactivatePatientUser({ userId: patientUserIdRef.current, code: reason, notes, exitForm: file });
            if (response?.status === 'success') {
                setModalOpen(false);
                notifySuccess('Patient deactivated successfully.');
                // Close the patient workspace tab and return to the list (legacy behavior).
                window.dispatchEvent(new CustomEvent('hum-ehr:closePatientTab', { detail: { patientId } }));
            }
            else if (response?.status === 'warning') {
                notifyError(typeof response.data === 'string' ? response.data : 'Failed to deactivate the patient.');
            }
            else notifyError('Failed to Deactivate user.');
        }
        catch (error) { console.error(error); notifyError('Failed to Deactivate user.'); }
        finally { setSaving(false); }
    };

    return (<div className="p-4">
      <div className="d-flex align-items-center gap-2">
        <label className="mb-0 fw-semibold">Deactivate Patient</label>
        <div className="form-check form-switch m-0">
          <input className="form-check-input pp-deactivate-toggle" type="checkbox" checked={toggleOn}
            onChange={(e) => { if (e.target.checked) openModal(); else setToggleOn(false); }}/>
        </div>
      </div>

      <Dialog visible={modalOpen} onHide={() => { if (window.confirm('Are you sure you want to cancel?')) closeModal(); }}
        header={<div>Patient Deactivation <span className="ms-2 small text-muted text-capitalize">{patientName}</span></div>}
        style={{ width: '45vw' }} breakpoints={{ '992px': '95vw' }}>
        <form autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSave(); }} noValidate>
          <div className="mb-3">
            <label>Reason <span className="text-danger">*</span></label>
            <select className="form-select" value={reason} onChange={(e) => { setReason(e.target.value); setErrors({}); }}>
              <option value="">Select Reason</option>
              {reasons.map((entry) => <option key={entry.code} value={entry.code}>{entry.description}</option>)}
            </select>
            <FieldError message={errors.reason}/>
          </div>
          {reason === 'POTHR' && (<div className="mb-3">
            <textarea className="form-control" placeholder="Enter reason..." value={notes} onChange={(e) => { setNotes(e.target.value); setErrors((prev) => ({ ...prev, notes: undefined })); }}/>
            <div className="text-end"><label>({notes.trim().length})</label></div>
            <FieldError message={errors.notes}/>
          </div>)}
          <div className="mb-3">
            <button type="button" className="btn btn-primary border-radius-button" onClick={() => fileInputRef.current?.click()}>
              <LegacyIcon icon="mdi-upload" className="me-1"/>Upload File
            </button>
            <input ref={fileInputRef} type="file" accept="application/pdf" className="d-none" onChange={handleFileChange}/>
            <FieldError message={fileError}/>
            {file && (
              <div className="pp-file-chip mt-2">
                <div className="pp-file-chip-text" title={file.name}>{file.name.length > 13 ? `${file.name.substring(0, 13)}...` : file.name}</div>
                <LegacyIcon icon="mdi-close-circle-outline" className="pp-file-chip-remove" role="button" onClick={() => setFile(null)}/>
              </div>
            )}
          </div>
          <div className="d-flex justify-content-end gap-2">
            <button type="button" className="btn btn-primary rounded-pill px-4" disabled={saving}
              onClick={() => { if (window.confirm('Are you sure you want to cancel?')) closeModal(); }}>Cancel</button>
            <button type="submit" className="btn btn-primary rounded-pill px-4" disabled={saving}>{saving ? 'Saving...' : 'Save'}</button>
          </div>
        </form>
      </Dialog>
    </div>);
};
export default PatientDeactivation;
