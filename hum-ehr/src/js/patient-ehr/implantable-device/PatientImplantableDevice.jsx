import { useCallback, useState } from 'react';
import moment, { userNow } from '../../../utils/dayjs';
import { Dialog } from 'primereact/dialog';
import PatientImplantableDeviceList from './PatientImplantableDeviceList';
import PatientImplantableDeviceDetails from './PatientImplantableDeviceDetails';
import PatientImplantableDeviceUDI from './PatientImplantableDeviceUDI';
import PatientImplantableDeviceAddEdit from './PatientImplantableDeviceAddEdit';
import PatientImplantableDeviceExplant from './PatientImplantableDeviceExplant';
import { getPendingImplantDevice, removePendingImplantDevice } from '../../../services/implantDeviceService';
import { useNotify } from '../../../context/NotificationContext';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import './PatientImplantableDevice.css';

const CLOSED = { type: null };

/**
 * Implantable Devices section. Mirrors the legacy <patient-implantable-device> two-pane
 * layout: Active / Inactive tabs (with a "View marked as error" toggle on Inactive), a
 * left list, and a right detail pane. Add starts with the UDI step; Edit / Explant open
 * their own dialogs. A pending-UDI confirmation surfaces when the backend flags one.
 */
const PatientImplantableDevice = ({ patientId }) => {
    const [recordType, setRecordType] = useState('active');
    const [invalidFlag, setInvalidFlag] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [dialog, setDialog] = useState(CLOSED);
    const [pending, setPending] = useState({ open: false, handled: false });
    const { notifyError } = useNotify();

    const refresh = useCallback(() => { setSelectedRecord(null); setRefreshKey((k) => k + 1); }, []);

    const changeTab = (type) => {
        setRecordType(type);
        setSearchTerm('');
        setInvalidFlag('');
        setSelectedRecord(null);
    };

    const closeDialog = useCallback((shouldRefresh) => {
        setDialog(CLOSED);
        if (shouldRefresh) refresh();
    }, [refresh]);

    const openEdit = useCallback((record) => {
        const status = record.explantDate && moment(record.explantDate).isSameOrBefore(userNow()) ? 'Inactive' : 'Active';
        setDialog({ type: 'form', seed: { deviceData: record, implantableId: record.id, status } });
    }, []);
    const openExplant = useCallback((record) => setDialog({ type: 'explant', record }), []);

    const onPending = useCallback(() => {
        setPending((p) => (p.handled ? p : { open: true, handled: true }));
    }, []);

    const handlePendingSaveNow = async () => {
        setPending({ open: false, handled: true });
        try {
            const response = await getPendingImplantDevice(patientId);
            const prefillUdi = response?.status === 'success' ? (response.data?.udi || '') : '';
            setDialog({ type: 'udi', prefillUdi });
        }
        catch (error) {
            console.error('Failed to fetch the pending device.', error);
            notifyError(error?.message || 'Failed to fetch the pending device.');
        }
    };
    const handlePendingDiscard = async () => {
        setPending({ open: false, handled: true });
        try { await removePendingImplantDevice(patientId); }
        catch (error) { console.error('Failed to discard the pending UDI.', error); }
    };

    const formSeed = dialog.type === 'form' ? dialog.seed : null;
    const formIsEdit = !!(formSeed?.implantableId || formSeed?.deviceData?.id);

    return (<div className="implantable-device-main-container row" id={`patient_implantable_device_hub_${patientId}`}>
      <div className="col-md-3 implantable-device-list-container pc-left-side-main-container">
        <div className="pc-patient-implantable-device-main-header container-fluid p-0 my-2">
          <div className="toggle-add-device-btn-container toggle-and-add-btn-container d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="active-history-toggle-group">
              <ul className="nav nav-pills active-history-toggle-group-list toggle-group-small" role="tablist">
                <li className="nav-item active-history-toggle-list">
                  <button type="button" className={`nav-link active-history-nav-link small ${recordType === 'active' ? 'active' : ''}`} onClick={() => changeTab('active')}>Active</button>
                </li>
                <li className="nav-item active-history-toggle-list">
                  <button type="button" className={`nav-link active-history-nav-link small ${recordType === 'history' ? 'active' : ''}`} onClick={() => changeTab('history')}>Inactive</button>
                </li>
              </ul>
            </div>
            {recordType === 'active' && (
              <button type="button" className="pc-add-new-implantable-device-btn pc-add-new-section-details-btn btn btn-primary btn-md border-radius-button" onClick={() => setDialog({ type: 'udi', prefillUdi: '' })}>
                <LegacyIcon icon="mdi-plus" className="icon-size-20"/> Add Device Details
              </button>
            )}
          </div>
          {recordType === 'history' && (
            <label className="d-block mt-2" style={{ fontWeight: 600, fontSize: 12 }}>
              <input type="checkbox" className="pc-marked-as-error-checkbox form-check-input me-2" checked={invalidFlag === 'Y'} onChange={(e) => { setInvalidFlag(e.target.checked ? 'Y' : ''); setSelectedRecord(null); }}/>
              View marked as error
            </label>
          )}
          <div className="search-implant-device-container icon-input-group pc-search-input-container mt-2">
            <div className="position-relative">
              <input id={`search_implantable_device_name_${patientId}`} type="text" className="form-control search-implantable-device-name" placeholder="Search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
              <LegacyIcon icon="mdi-magnify" className="input-icon" style={{ position: 'absolute', right: 10, top: 6 }}/>
            </div>
          </div>
        </div>
        <div className="implantable-device-list-table-container pc-left-side-list-container p-2">
          <PatientImplantableDeviceList patientId={patientId} recordType={recordType} invalidFlag={invalidFlag} searchTerm={searchTerm} refreshKey={refreshKey} selectedId={selectedRecord?.id} onSelect={setSelectedRecord} onPending={onPending}/>
        </div>
      </div>
      <div className="col-md-9 implantable-device-detail-container pc-section-selected-detail-view-container ps-0">
        <PatientImplantableDeviceDetails patientId={patientId} recordType={recordType} invalidFlag={invalidFlag} record={selectedRecord}
          onEdit={openEdit} onExplant={openExplant} onChanged={refresh}/>
      </div>

      {/* UDI entry step */}
      <Dialog visible={dialog.type === 'udi'} onHide={() => closeDialog(false)} header="Verify the UDI (Unique Device Identifier)" style={{ width: '55vw' }} breakpoints={{ '768px': '95vw' }}>
        {dialog.type === 'udi' && (<PatientImplantableDeviceUDI patientId={patientId} prefillUdi={dialog.prefillUdi}
          onProceed={(seed) => setDialog({ type: 'form', seed })}
          onVerifiedLater={() => closeDialog(true)}
          onCancel={() => closeDialog(false)}/>)}
      </Dialog>

      {/* Add / Edit device details */}
      <Dialog visible={dialog.type === 'form'} onHide={() => closeDialog(false)} header={`${formIsEdit ? 'Update' : 'Add'} Implantable Device Details`} style={{ width: '80vw' }} breakpoints={{ '768px': '98vw' }}>
        {dialog.type === 'form' && (<PatientImplantableDeviceAddEdit patientId={patientId} seed={formSeed} onClose={closeDialog}/>)}
      </Dialog>

      {/* Explantation */}
      <Dialog visible={dialog.type === 'explant'} onHide={() => closeDialog(false)} header="Explantation Details" style={{ width: '55vw' }} breakpoints={{ '768px': '95vw' }}>
        {dialog.type === 'explant' && (<PatientImplantableDeviceExplant patientId={patientId} record={dialog.record} onClose={closeDialog}/>)}
      </Dialog>

      {/* Pending unsaved UDI confirmation */}
      <Dialog visible={pending.open} onHide={handlePendingDiscard} header="Unsaved UDI Information" style={{ width: '30vw' }} breakpoints={{ '768px': '90vw' }}>
        <p>You have an unsaved UDI for this patient. Would you like to save it now?</p>
        <div className="d-flex justify-content-end gap-2 mt-3">
          <button type="button" className="btn btn-secondary rounded-pill px-4" onClick={handlePendingDiscard}>Discard</button>
          <button type="button" className="btn btn-primary rounded-pill px-4" onClick={handlePendingSaveNow}>Save Now</button>
        </div>
      </Dialog>
    </div>);
};
export default PatientImplantableDevice;
