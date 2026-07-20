import { useState } from 'react';
import moment from '../../../utils/dayjs';
import { buildImplantDeviceExplantPayload, saveImplantDeviceExplant } from '../../../services/implantDeviceService';
import { getSaveOutcome } from '../../../utils/saveResponse';
import FlatpickrDateTimeInput from '../../../components/common/FlatpickrDateTimeInput';
import { useNotify } from '../../../context/NotificationContext';
import { LegacyIcon } from '../../../components/common/CustomIcons';

const dateOnly = (value) => (value ? moment(value).format('MM-DD-YYYY') : '');

/**
 * Explantation dialog (legacy PatientImplantableDeviceExplantation) reached from the
 * detail view's Change Status → Inactive. Explant date (>= implant date, <= today) +
 * reason, saved via /implant/device/explant/save.
 * NOTE: the legacy procedure/surgical linkage in this flow is commented-out (inactive),
 * so it is intentionally omitted here. TODO: wire it if the backend re-enables it.
 */
const PatientImplantableDeviceExplant = ({ patientId, record, onClose }) => {
    const [explantDate, setExplantDate] = useState('');
    const [reason, setReason] = useState('');
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const { notifySuccess } = useNotify();

    const minDate = dateOnly(record?.implantDate);
    const maxDate = moment().format('MM-DD-YYYY');

    const validate = () => {
        const next = {};
        if (!explantDate) next.explantDate = 'Please enter the explantation date';
        if (!reason.trim()) next.reason = 'Please enter the reason for explantation';
        return next;
    };

    const handleExplant = async () => {
        setSaveError(null);
        const v = validate();
        setErrors(v);
        if (Object.keys(v).length) return;
        if (!window.confirm('Are you sure you want to change the status to "Inactive"?')) return;
        setSaving(true);
        try {
            const payload = buildImplantDeviceExplantPayload({ patientId, deviceId: record.id, explantDate, reasonForExplant: reason });
            const response = await saveImplantDeviceExplant(payload);
            const outcome = getSaveOutcome(response, 'Failed to save implanted device details. Please try again.');
            if (outcome.ok) { notifySuccess(typeof response?.data === 'string' ? response.data : 'Device explanted successfully.'); onClose(true); return; }
            setSaveError(outcome);
        }
        catch (error) {
            console.error('Failed to explant device.', error);
            setSaveError({ tone: 'error', message: error?.message || 'Failed to save implanted device details. Please try again.' });
        }
        finally { setSaving(false); }
    };

    return (<div className="pc-implantable-device-explanation-details-wrapper">
      <div className="row g-3">
        <div className="col-md-4 form-group">
          <label className="form-label pcid-label-name fw-bold">Explantation Date <span className="text-danger">*</span></label>
          <FlatpickrDateTimeInput value={explantDate} onChange={(v) => { setExplantDate(v); setErrors((p) => ({ ...p, explantDate: undefined })); }}
            enableTime={false} dateFormat="m-d-Y" placeholder="MM-DD-YYYY" minDate={minDate || undefined} maxDate={maxDate}/>
          {errors.explantDate && <div className="small text-danger mt-1">{errors.explantDate}</div>}
        </div>
      </div>
      <div className="row g-3 mt-1">
        <div className="col-md-12 form-group">
          <label className="form-label pcid-label-name fw-bold">Reason for Explantation <span className="text-danger">*</span></label>
          <textarea className="form-control" maxLength={500} value={reason} onChange={(e) => { setReason(e.target.value); setErrors((p) => ({ ...p, reason: undefined })); }}/>
          <div style={{ textAlign: 'end' }}><label>({reason.trim().length}/500)</label></div>
          {errors.reason && <div className="small text-danger">{errors.reason}</div>}
        </div>
      </div>

      {saveError && (<div className={`mt-2 small ${saveError.tone === 'warning' ? 'text-warning' : 'text-danger'}`}><LegacyIcon icon="fa-exclamation-triangle" className="me-1"/>{saveError.message}</div>)}

      <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
        <button type="button" className="btn btn-secondary px-4 rounded-pill bs-modal-cancel-btn" onClick={() => onClose(false)} disabled={saving}>Cancel</button>
        <button type="button" className="btn btn-primary px-4 rounded-pill bs-modal-save-btn" onClick={handleExplant} disabled={saving}>{saving ? 'Saving...' : 'Explant'}</button>
      </div>
    </div>);
};
export default PatientImplantableDeviceExplant;
