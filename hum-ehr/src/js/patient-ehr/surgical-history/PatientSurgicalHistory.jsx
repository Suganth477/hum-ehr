import { useCallback, useState } from 'react';
import PatientSurgicalHistoryList from './PatientSurgicalHistoryList';
import PatientSurgicalHistoryViewDetails from './PatientSurgicalHistoryViewDetails';
import PatientSurgicalHistoryAddEdit from './PatientSurgicalHistoryAddEdit';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import './PatientSurgicalHistory.css';

/**
 * Surgical History section (legacy patient-surgical-history): two-pane list/detail with
 * surgery-name search, a "View marked as error" toggle (search disabled while on, per
 * legacy), and an inline add/edit view swap.
 */
const PatientSurgicalHistory = ({ patientId }) => {
    const [view, setView] = useState('list');
    const [editRecord, setEditRecord] = useState(null);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDeleted, setShowDeleted] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [selectId, setSelectId] = useState(null);

    const openAddEdit = useCallback((record = null) => { setEditRecord(record); setView('addEdit'); }, []);
    const closeAddEdit = useCallback((shouldRefresh, savedId = null) => {
        setView('list');
        setEditRecord(null);
        if (shouldRefresh) {
            setSelectId(savedId);
            setSelectedRecord(null);
            setRefreshKey((k) => k + 1);
        }
    }, []);
    const refresh = useCallback(() => { setSelectId(null); setSelectedRecord(null); setRefreshKey((k) => k + 1); }, []);

    return (<div className="surgical-history-main-container mt-3" id={`patient_surgical_history_hub_${patientId}`}>
      {view === 'list' && (<div className="surgical-history-view-main-container row">
        <div className="col-md-3 surgical-history-left-side-main-container pc-left-side-main-container">
          <div className="d-flex justify-content-end mt-1 mb-2">
            <button type="button" className="pc-add-new-surgical-history-btn pc-add-new-section-details-btn btn btn-primary btn-md border-radius-button" onClick={() => openAddEdit(null)}>
              <LegacyIcon icon="mdi-plus" className="icon-size-20"/> Add Surgical History
            </button>
          </div>
          <div className="icon-input-group position-relative mt-2">
            <input type="text" id={`surgical_history_surgery_name_filter_${patientId}`} placeholder="Search Surgery Name"
              className="form-control text-capitalize" autoComplete="off" value={searchTerm} disabled={showDeleted}
              onChange={(e) => setSearchTerm(e.target.value)}/>
            <LegacyIcon icon="mdi-magnify" className="input-icon" style={{ position: 'absolute', right: 10, top: 6 }}/>
          </div>
          <div className="mt-2">
            <label className="label-name d-flex align-items-center mb-2">
              <input type="checkbox" className="form-check-input mx-2" style={{ border: '1px solid #526172' }} checked={showDeleted}
                onChange={(e) => { setShowDeleted(e.target.checked); setSelectedRecord(null); if (e.target.checked) setSearchTerm(''); }}/>
              <span className="ms-1 mt-1">View marked as error</span>
            </label>
          </div>
          <div className="pc-left-side-list-container p-2 mt-3">
            <PatientSurgicalHistoryList patientId={patientId} searchTerm={searchTerm} showDeleted={showDeleted}
              refreshKey={refreshKey} selectId={selectId} selectedId={selectedRecord?.id} onSelect={setSelectedRecord}/>
          </div>
        </div>
        <div className="col-md-9 surgical-history-detail-container pc-section-selected-detail-view-container ps-0">
          <PatientSurgicalHistoryViewDetails patientId={patientId} record={selectedRecord} onEdit={openAddEdit} onDeleted={refresh}/>
        </div>
      </div>)}

      {view === 'addEdit' && (<div className="surgical-history-add-edit-container">
        <PatientSurgicalHistoryAddEdit patientId={patientId} record={editRecord} onClose={closeAddEdit}/>
      </div>)}
    </div>);
};
export default PatientSurgicalHistory;
