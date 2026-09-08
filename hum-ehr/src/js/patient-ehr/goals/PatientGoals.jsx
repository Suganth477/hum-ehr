import { useCallback, useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import PatientGoalsList from './PatientGoalsList';
import PatientGoalsViewDetails from './PatientGoalsViewDetails';
import PatientGoalsAddEdit from './PatientGoalsAddEdit';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import { fetchGoalReferenceData } from '../../../services/goalService';
import { getLoggedInUser } from '../../../services/authService';
import patientCache from '../../../utils/patientCache';
import { useNotify } from '../../../context/NotificationContext';
import './PatientGoals.css';

const EMPTY_REFERENCE = {
    goalTypeListDetails: [],
    sdohGoalListDetails: [],
    goalStatusCodes: [],
    patientGoalsAutoCompleteSource: [],
    sdohGoalsAutoCompleteSource: [],
};

/**
 * Goals section. Mirrors the legacy <patient-goals> two-pane layout: a left rail
 * (Active/History toggle + Patient-Goals/SDOH-Goals sub-sections + search +
 * Show-Deleted + Add) with the goal list, and a right detail pane. Add/Edit opens
 * in a modal (legacy used the shared XL modal).
 */
const PatientGoals = ({ patientId }) => {
    const [recordType, setRecordType] = useState('active');
    const [goalType, setGoalType] = useState('patient-goals');
    const [searchTerm, setSearchTerm] = useState('');
    const [showDeleted, setShowDeleted] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [selectedGoal, setSelectedGoal] = useState(null);
    const [referenceData, setReferenceData] = useState(EMPTY_REFERENCE);
    const [addEdit, setAddEdit] = useState({ open: false, goal: null });
    const { notifyError } = useNotify();
    const userId = getLoggedInUser()?.userId || '';

    useEffect(() => {
        let ignore = false;
        const cached = patientCache.get('goalReferenceData');
        if (cached) {
            setReferenceData(cached);
            return undefined;
        }
        (async () => {
            try {
                const data = await fetchGoalReferenceData();
                if (ignore)
                    return;
                setReferenceData(data);
                patientCache.set('goalReferenceData', data);
            }
            catch (error) {
                console.error('Failed to load goal reference data.', error);
                if (!ignore)
                    notifyError(error?.message || 'Unable to load goal reference data.');
            }
        })();
        return () => { ignore = true; };
    }, [notifyError]);

    const handleRecordTypeChange = (type) => {
        setRecordType(type);
        setShowDeleted(false);
        setSearchTerm('');
        setSelectedGoal(null);
    };
    const handleGoalTypeChange = (type) => {
        setGoalType(type);
        setSearchTerm('');
        setSelectedGoal(null);
    };
    const openAddEdit = useCallback((goal = null) => setAddEdit({ open: true, goal }), []);
    const closeAddEdit = useCallback((shouldRefresh = false) => {
        setAddEdit({ open: false, goal: null });
        if (shouldRefresh) {
            setSelectedGoal(null);
            setRefreshKey((key) => key + 1);
        }
    }, []);

    const addButtonText = goalType === 'sdoh-goals' ? 'Add SDOH Goal' : 'Add Patient Goal';
    const isSdoh = goalType === 'sdoh-goals';

    return (<div className="goals-main-container row" id={`patient_goals_hub_${patientId}`}>
      <div className="col-md-3 goals-list-container pc-left-side-main-container">
        <div className="pc-patient-goals-main-header container-fluid p-0 my-2">
          <div className="toggle-add-device-btn-container toggle-and-add-btn-container row">
            <div className="col-md-6 d-flex">
              <div className="active-history-toggle-group align-items-center">
                <ul className="nav nav-pills active-history-toggle-group-list toggle-group-small" role="tablist">
                  <li className="nav-item active-history-toggle-list">
                    <button type="button" className={`nav-link active-history-nav-link small ${recordType === 'active' ? 'active' : ''}`} onClick={() => handleRecordTypeChange('active')}>Active</button>
                  </li>
                  <li className="nav-item active-history-toggle-list">
                    <button type="button" className={`nav-link active-history-nav-link small ${recordType === 'history' ? 'active' : ''}`} onClick={() => handleRecordTypeChange('history')}>History</button>
                  </li>
                </ul>
              </div>
            </div>
            <div className="col-md-6 d-flex justify-content-end">
              <div className="pc-goals-action-container">
                {recordType === 'history' && (<div className="pc-goals-header-recover-delete-record form-check ms-3" style={{ height: '32px' }}>
                    <span className="fw-bold">
                      <label className="form-check-label pc-goals-deleted-record-input-checkbox-label cursor-pointer no-select" style={{ fontSize: 12 }} htmlFor={`pc_patient_goals_deleted_record_input_checkbox_${patientId}`}>
                        <input className="form-check-input pc-goals-deleted-record-input-checkbox cursor-pointer" type="checkbox" id={`pc_patient_goals_deleted_record_input_checkbox_${patientId}`} checked={showDeleted} onChange={(event) => setShowDeleted(event.target.checked)}/>
                        Show Deleted Goals
                      </label>
                    </span>
                  </div>)}
                {recordType !== 'history' && (<button type="button" className="pc-add-new-goals-btn pc-add-new-section-details-btn btn-md" onClick={() => openAddEdit(null)}>
                    <LegacyIcon icon="mdi-plus" className="icon-size-20"/> {addButtonText}
                  </button>)}
              </div>
            </div>
          </div>
          <div className="pc-goals-sub-section p-0 my-2 row">
            <div className="goals-sub-section-toggle-group">
              <ul className="nav nav-pills sub-section-toggle-group-list toggle-group-small" role="tablist">
                <li className="nav-item">
                  <button type="button" className={`nav-link sub-section-nav-link ${goalType === 'patient-goals' ? 'active' : ''}`} onClick={() => handleGoalTypeChange('patient-goals')}>Patient Goals</button>
                </li>
                <li className="nav-item">
                  <button type="button" className={`nav-link sub-section-nav-link ${goalType === 'sdoh-goals' ? 'active' : ''}`} onClick={() => handleGoalTypeChange('sdoh-goals')}>SDOH Goals</button>
                </li>
              </ul>
            </div>
          </div>
          <div className="search-goals-container icon-input-group pc-search-input-container mt-2">
            <div className="col-md-12 position-relative">
              <input id={`pc_goals_list_search_input_${patientId}`} type="text" className="form-control search-goals-name text-capitalize" placeholder="Search" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)}/>
              <LegacyIcon icon="mdi-magnify" style={{ position: 'absolute', right: 10, top: 6 }}/>
            </div>
          </div>
        </div>
        <div className="goals-list-table-container pc-left-side-list-container p-2">
          <PatientGoalsList patientId={patientId} recordType={recordType} goalType={goalType} searchTerm={searchTerm} showDeleted={showDeleted} refreshKey={refreshKey} userId={userId} selectedGoalId={selectedGoal?.goalId} onSelect={setSelectedGoal}/>
        </div>
      </div>
      <div className="col-md-9 goals-detail-container pc-section-selected-detail-view-container">
        <PatientGoalsViewDetails patientId={patientId} goal={selectedGoal} goalType={goalType} recordType={recordType} onEdit={(goal) => openAddEdit(goal)} onDeleted={() => { setSelectedGoal(null); setRefreshKey((key) => key + 1); }}/>
      </div>

      <Dialog visible={addEdit.open} onHide={() => closeAddEdit(false)} header={`${addEdit.goal ? 'Edit' : 'Add'} ${isSdoh ? 'SDOH ' : 'Patient '}Goal`} style={{ width: '70vw' }} breakpoints={{ '768px': '95vw' }}>
        {addEdit.open && (<PatientGoalsAddEdit patientId={patientId} goalType={goalType} recordType={recordType} goal={addEdit.goal} referenceData={referenceData} onClose={closeAddEdit}/>)}
      </Dialog>
    </div>);
};
export default PatientGoals;
