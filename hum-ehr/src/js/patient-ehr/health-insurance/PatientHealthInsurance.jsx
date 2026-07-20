import { useCallback, useState } from 'react';
import PatientHealthInsuranceList from './PatientHealthInsuranceList';
import PatientHealthInsuranceViewDetails from './PatientHealthInsuranceViewDetails';
import PatientHealthInsuranceAddEdit from './PatientHealthInsuranceAddEdit';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import './PatientHealthInsurance.css';

/**
 * Health Insurance section. In the legacy app this is a tab inside the Patient
 * Profile screen (still a legacy web component here); it's surfaced as its own
 * chart section temporarily until Patient Profile is migrated to React.
 *
 * Layout mirrors the legacy two-pane: left rail (Active/In-Active toggle +
 * Show-Deleted + Add) with the insurance list, and a right detail pane.
 *
 * NOTE: the add/edit form (the largest in the migration — insurance + subscriber
 * + member blocks) is being built next; Add/Edit currently opens a placeholder.
 */
const PatientHealthInsurance = ({ patientId }) => {
    const [viewMode, setViewMode] = useState('LIST');
    const [recordType, setRecordType] = useState('active');
    const [showDeleted, setShowDeleted] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [meta, setMeta] = useState({ isMedicarePatient: 'N', awvConfigurationEditableFlag: 'Y' });

    const handleRecordTypeChange = (type) => {
        setRecordType(type);
        setShowDeleted(false);
        setSelectedRecord(null);
    };
    const openAddEdit = useCallback((record = null) => {
        setSelectedRecord(record);
        setViewMode('ADD_EDIT');
    }, []);
    const closeAddEdit = useCallback((shouldRefresh = false) => {
        setViewMode('LIST');
        if (shouldRefresh) {
            setSelectedRecord(null);
            setRefreshKey((key) => key + 1);
        }
    }, []);

    if (viewMode === 'ADD_EDIT')
        return (<div className="patient-health-insurance-section" id={`patient_health_insurance_hub_${patientId}`}>
          <PatientHealthInsuranceAddEdit patientId={patientId} record={selectedRecord} onClose={closeAddEdit}/>
        </div>);

    return (<div className="patient-health-insurance-section" id={`patient_health_insurance_hub_${patientId}`}>
      <div className="health-insurance-main-container row box-shadow-highlight p-2 m-1">
        <div className="col-md-3 health-insurance-list-container pc-left-side-main-container">
          <div className="pc-patient-health-insurance-main-header container-fluid p-0 my-2">
            <div className="toggle-add-health-insurance-btn-container toggle-and-add-btn-container d-flex justify-content-between align-items-center flex-wrap gap-2">
              <div className="active-history-toggle-group">
                <ul className="nav nav-pills active-history-toggle-group-list" role="tablist">
                  <li className="nav-item active-history-toggle-list">
                    <button type="button" className={`nav-link active-history-nav-link small ${recordType === 'active' ? 'active' : ''}`} onClick={() => handleRecordTypeChange('active')}>Active</button>
                  </li>
                  <li className="nav-item active-history-toggle-list">
                    <button type="button" className={`nav-link active-history-nav-link small ${recordType === 'history' ? 'active' : ''}`} onClick={() => handleRecordTypeChange('history')}>In-Active</button>
                  </li>
                </ul>
              </div>
              <div className="d-flex align-items-center gap-2">
                {recordType === 'history' ? (<label className="label-name d-flex align-items-center mb-0" htmlFor={`pcps_patient_health_insurance_deleted_records_input_${patientId}`}>
                    <input type="checkbox" id={`pcps_patient_health_insurance_deleted_records_input_${patientId}`} className="form-check-input me-2" checked={showDeleted} onChange={(event) => setShowDeleted(event.target.checked)}/>
                    <span>Show Deleted Records</span>
                  </label>) : (<button type="button" className="pc-add-new-health-insurance-btn pc-add-new-section-details-btn btn btn-primary btn-md border-radius-button" onClick={() => openAddEdit(null)}>
                    <LegacyIcon icon="mdi-plus" className="icon-size-20"/> Add Insurance
                  </button>)}
              </div>
            </div>
          </div>
          <div className="health-insurance-list-table-container pc-left-side-list-container p-2">
            <PatientHealthInsuranceList patientId={patientId} recordType={recordType} showDeleted={showDeleted} refreshKey={refreshKey} selectedId={selectedRecord?.id} onSelect={setSelectedRecord} onMeta={setMeta}/>
          </div>
        </div>
        <div className="col-md-9 health-insurance-detail-container pc-section-selected-detail-view-container">
          <PatientHealthInsuranceViewDetails patientId={patientId} record={selectedRecord} recordType={recordType} isMedicarePatient={meta.isMedicarePatient} onEdit={(record) => openAddEdit(record)} onDeleted={() => { setSelectedRecord(null); setRefreshKey((key) => key + 1); }}/>
        </div>
      </div>
    </div>);
};
export default PatientHealthInsurance;
