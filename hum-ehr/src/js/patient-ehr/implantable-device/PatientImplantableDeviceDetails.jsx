import { useEffect, useRef, useState } from 'react';
import moment from '../../../utils/dayjs';
import { deleteImplantDevice } from '../../../services/implantDeviceService';
import { useNotify } from '../../../context/NotificationContext';
import { LegacyIcon } from '../../../components/common/CustomIcons';

const dateOnly = (value) => (value ? moment(value).format('MM-DD-YYYY') : '');

// Small labelled value cell. `strike` adds the marked-as-error strikethrough (error-in).
const Field = ({ label, value, className = 'col-md-3', strike }) => (
    <div className={className}>
      <div className={`label implant-device-details-common-class ${strike ? 'error-in' : ''}`}>{label}</div>
      <div className={`fw-bold implant-device-details-common-class ${strike ? 'error-in' : ''}`}>{value || '-'}</div>
    </div>
);

/**
 * Right-pane detail view. Mirrors PatientImplantableDeviceDetails: full attribute
 * panel, expiry alert, show-more/less, and the status actions (Change Status →
 * Inactive [explant] / Mark As Error [soft-delete], Edit). Marked-as-error records
 * hide the action bar and strike through the values.
 */
const PatientImplantableDeviceDetails = ({ recordType, invalidFlag, record, onEdit, onExplant, onChanged }) => {
    const [showMore, setShowMore] = useState(false);
    const [statusOpen, setStatusOpen] = useState(false);
    const [busy, setBusy] = useState(false);
    const { notifyError, notifySuccess } = useNotify();
    const statusRef = useRef(null);

    useEffect(() => {
        if (!statusOpen) return undefined;
        const onDoc = (e) => { if (statusRef.current && !statusRef.current.contains(e.target)) setStatusOpen(false); };
        document.addEventListener('click', onDoc);
        return () => document.removeEventListener('click', onDoc);
    }, [statusOpen]);

    if (!record)
        return <div className="implant-device-details-main-container show-details-main-container"/>;

    const strike = invalidFlag === 'Y';
    const today = moment();
    const title = record.deviceName || record.deviceType || '-';
    const expiry = dateOnly(record.expiryDate);
    const expired = expiry && moment(expiry, 'MM-DD-YYYY').isSameOrBefore(today, 'day');
    const explanted = record.explantDate && moment(record.explantDate).isSameOrBefore(today);

    // Expiry alert (within 30 days) — mirrors showAlertToastForExpiryDate.
    let expiryAlert = null;
    if (record.expiryDate && invalidFlag !== 'Y') {
        const days = moment(record.expiryDate).startOf('day').diff(today.clone().startOf('day'), 'days');
        if (days >= 0 && days <= 30)
            expiryAlert = days === 0 ? 'Expires today' : days === 1 ? 'Expires tomorrow' : `Expires in ${days} days`;
    }

    const handleMarkAsError = async () => {
        setStatusOpen(false);
        const label = recordType === 'history' ? 'Inactive' : 'Active';
        if (!window.confirm(`Are you sure you want to change the status from "${label}" to "Marked as Error"?`))
            return;
        setBusy(true);
        try {
            const response = await deleteImplantDevice(record.id);
            if (!response || response.status === 'success') {
                notifySuccess((response && response.data) || 'Device marked as error.');
                onChanged();
            }
            else notifyError(response.message || 'Failed to mark as error.');
        }
        catch (error) {
            console.error('Failed to mark implantable device as error.', error);
            notifyError(error?.message || 'Failed to mark as error.');
        }
        finally { setBusy(false); }
    };

    return (<div className="implant-device-details-main-container show-details-main-container">
      <div className="row mx-3 my-3">
        <div className="col-md-8 implant-device-name fw-bold patient-chart-list-selected-item-title text-capitalize" style={{ color: '#089BAB' }}>{title}</div>
        {invalidFlag !== 'Y' && (<div className="col-md-4 d-flex align-items-center justify-content-end implant-device-action-container gap-2">
          <div className="position-relative" ref={statusRef}>
            <button type="button" id="pc_implantable_device_status_button" onClick={() => setStatusOpen((v) => !v)} disabled={busy}>
              <span className="status-label">Change Status</span>
              <LegacyIcon icon="mdi-chevron-down"/>
            </button>
            {statusOpen && (<ul className="pcid-device-status-menu">
              {recordType === 'active' && <li onClick={() => { setStatusOpen(false); onExplant(record); }}>Inactive</li>}
              <li onClick={handleMarkAsError}>Mark As Error</li>
            </ul>)}
          </div>
          <button type="button" id="pc_implantable_device_edit_button" onClick={() => onEdit(record)}>
            <LegacyIcon icon="mdi-pencil-outline" className="me-1"/> Edit
          </button>
        </div>)}
      </div>

      {expiryAlert && (<div className="row mx-3 my-3 implant-device-expiration-alert-container" style={{ backgroundColor: '#FFE2E2', borderRadius: 10 }}>
        <div className="col-md-12">
          <div className="label py-2">
            <LegacyIcon icon="fa-warning" style={{ fontSize: 20, color: '#E7000B' }}/>&nbsp;
            <span className="implant-device-expiration-alert" style={{ color: '#E7000B' }}>{expiryAlert}</span>
          </div>
        </div>
      </div>)}

      <div className="row mx-3 my-3">
        <Field className="col-md-12" label="Unique Device Identifier" value={record.uniqueDeviceId || 'Unknown'} strike={strike}/>
      </div>
      <div className="row mx-3 my-3">
        <Field label="Device Id" value={record.deviceIdentifier} strike={strike}/>
        <Field className="col-md-9" label="Device Name" value={record.deviceName || record.deviceType} strike={strike}/>
      </div>
      <div className="row mx-3 my-3">
        {explanted
          ? <Field label="Explantation Date" value={dateOnly(record.explantDate)} strike={strike}/>
          : <Field label="Implantation Date" value={dateOnly(record.implantDate)} strike={strike}/>}
        <Field label="Body Site" value={record.bodySiteDesc} strike={strike}/>
        {explanted
          ? <Field label="Reason for Explantation" value={record.reasonForExplant} strike={strike}/>
          : <Field label="Reason for Implantation" value={record.reasonForImplant} strike={strike}/>}
      </div>
      <div className="row mx-3 my-3">
        <Field label="Provider Name" value={record.implantProviderName} strike={strike}/>
        <Field label="Manufacture Date" value={dateOnly(record.manufacturedDate)} strike={strike}/>
        <div className="col-md-3">
          <div className={`label implant-device-details-common-class ${strike ? 'error-in' : ''}`}>Expiration Date</div>
          <span className={`fw-bold implant-device-details-common-class ${strike ? 'error-in' : ''}`}>{expiry || '-'}</span>
          {expired && <span className="pc-implant-device-expired-warning ms-1"><LegacyIcon icon="fa-warning" style={{ fontSize: 18 }}/></span>}
        </div>
      </div>
      <div className="row mx-3 my-3">
        <Field className="col-md-12" label="Device Description" value={record.deviceDescription} strike={strike}/>
      </div>

      {showMore && (<div className="hide-show-implant-device-detail-container">
        {explanted && (<div className="row mx-3 my-3">
          <Field label="Implantation Date" value={dateOnly(record.implantDate)} strike={strike}/>
          <Field className="col-md-9" label="Reason for Implantation" value={record.reasonForImplant} strike={strike}/>
        </div>)}
        <div className="row mx-3 my-3">
          <Field label="Lot or Batch Number" value={record.lotNumber} strike={strike}/>
          <Field label="Serial Number" value={record.serialNumber} strike={strike}/>
          <Field label="Distinct Identification Code" value={record.hcpCode} strike={strike}/>
        </div>
        <div className="row mx-3 my-3">
          <Field label="Brand Name" value={record.brandName} strike={strike}/>
          <Field label="Version or Model" value={record.model} strike={strike}/>
          <Field label="Company Name" value={record.companyName} strike={strike}/>
          <Field label="MRI Safety Information from Labelling" value={record.mriSafetyInfo} strike={strike}/>
        </div>
        <div className="row mx-3 my-3">
          <Field label="Natural Rubber Latex Status" value={record.naturalRubberLatexStatus} strike={strike}/>
          <Field label="Procedure / Surgical History" value={record.procedureSurgicalHistory} strike={strike}/>
        </div>
        <div className="row mx-3 my-3">
          <Field className="col-md-12" label="Notes" value={record.notes} strike={strike}/>
        </div>
      </div>)}

      <div className="implant-device-show-hide-view-btn ms-4 ps-1 mb-3" role="button" onClick={() => setShowMore((v) => !v)}>
        {showMore ? 'Show fewer details...' : 'Show more details...'}
      </div>
    </div>);
};
export default PatientImplantableDeviceDetails;
