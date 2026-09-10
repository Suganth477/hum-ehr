import { useCallback, useEffect, useState } from 'react';
import { Sidebar } from 'primereact/sidebar';
import { Dialog } from 'primereact/dialog';
import PatientProblemsList from './PatientProblemsList';
import PatientProblemsAddEdit from './PatientProblemsAddEdit';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import CommonSelect from '../../../components/common/CommonSelect';
import { fetchProblemStatusMetadata } from '../../../services/lookupService';
import { subscribeSectionRefresh, sectionRefreshKey } from '../../../utils/sectionRefreshBus';
import patientCache from '../../../utils/patientCache';
import moment, { userNow } from '../../../utils/dayjs';
import { useNotify } from '../../../context/NotificationContext';
import '../allergies/PatientAllergies.css';
import './PatientProblems.css';

// Patient-details strip shown at the top of the Add/Edit modal (legacy
// utility.displayPatientDetailsInBootstrapModal — patient name, DOB & age, gender, EMR id).
const ProblemModalPatientStrip = ({ patientId }) => {
    const details = patientCache.get(`${patientId}_details`) || {};
    const age = details.dateOfBirth ? userNow().diff(moment(details.dateOfBirth, ['MM-DD-YYYY', 'YYYY-MM-DD']), 'years') : '';
    const cell = (label, value) => (<div className="pp-modal-strip-cell">
        <div className="pp-modal-strip-label">{label}</div>
        <div className="pp-modal-strip-value">{value || '-'}</div>
      </div>);
    return (<div className="pp-problem-modal-patient-strip d-flex align-items-center flex-wrap">
        <div className="pp-modal-strip-cell d-flex align-items-center gap-2">
          <span className="pp-modal-patient-avatar"><LegacyIcon icon="mdi-account"/></span>
          <div>
            <div className="pp-modal-strip-label">Patient Name</div>
            <div className="pp-modal-strip-value text-capitalize">{details.patientName || '-'}</div>
          </div>
        </div>
        {cell('DOB & Age', details.dateOfBirth ? `${details.dateOfBirth}${age !== '' ? ` (${age}yrs)` : ''}` : '-')}
        {cell('Gender', details.genderDesc)}
        {cell('EMR Id', details.ehrEmrId)}
      </div>);
};
const EMPTY_METADATA = { clinicalStatuses: [], verificationStatuses: [] };
const PatientProblems = ({ patientId }) => {
    const [viewMode, setViewMode] = useState('LIST');
    const [recordType, setRecordType] = useState('active');
    const [showDeleted, setShowDeleted] = useState(false);
    const [filterVisible, setFilterVisible] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [actionType, setActionType] = useState('create');
    const [searchTerm, setSearchTerm] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);
    const [statusMetadata, setStatusMetadata] = useState(EMPTY_METADATA);
    const [filterForm, setFilterForm] = useState({ type: '' }); // working (in the offcanvas)
    const [appliedFilters, setAppliedFilters] = useState({ type: '' }); // committed to the list
    const { notifyError } = useNotify();
    const filterCount = appliedFilters.type ? 1 : 0;
    const isFilterDirty = filterForm.type !== appliedFilters.type;
    useEffect(() => {
        let ignore = false;
        const loadMetadata = async () => {
            const cached = patientCache.get('problemStatusMetadata');
            if (cached) {
                setStatusMetadata(cached);
                return;
            }
            try {
                const metadata = await fetchProblemStatusMetadata();
                if (ignore)
                    return;
                setStatusMetadata(metadata);
                patientCache.set('problemStatusMetadata', metadata);
            }
            catch (error) {
                console.error('Failed to load problem status metadata.', error);
                if (!ignore)
                    notifyError(error?.message || 'Unable to load problem reference data.');
            }
        };
        loadMetadata();
        return () => {
            ignore = true;
        };
    }, [notifyError]);
    // The session-lock warning modal's "Refresh" publishes here (legacy
    // refreshCustomElementBasedOnConcurrentCode → PROBLEM) to reload the stale list.
    useEffect(() => subscribeSectionRefresh(sectionRefreshKey('PROBLEM', patientId), () => setRefreshKey((key) => key + 1)), [patientId]);
    const openAddEdit = useCallback((record = null, action = 'create') => {
        setSelectedRecord(record);
        setActionType(action);
        setViewMode('ADD_EDIT');
    }, []);
    const closeAddEdit = useCallback((shouldRefresh = false) => {
        setViewMode('LIST');
        setSelectedRecord(null);
        setActionType('create');
        if (shouldRefresh)
            setRefreshKey((key) => key + 1);
    }, []);
    const handleRecordTypeChange = (type) => {
        setRecordType(type);
        setShowDeleted(false);
    };
    const openFilter = () => {
        setFilterForm({ ...appliedFilters }); // reflect the applied state when opening
        setFilterVisible(true);
    };
    const handleApplyFilters = () => {
        setAppliedFilters({ ...filterForm });
        setFilterVisible(false);
        setRefreshKey((key) => key + 1);
    };
    const handleResetFilters = () => {
        setFilterForm({ type: '' });
        setAppliedFilters({ type: '' });
        setRefreshKey((key) => key + 1);
    };
    return (<div className="pp-problems-section-main-container" id={`patient_problems_hub_${patientId}`}>
      <div className="pp-problems-list-main-container">
          <div className="pp-problems-main-header container-fluid p-0 my-2">
            <div className="pp-problems-header-input-container d-flex justify-content-between align-items-center w-100 flex-wrap gap-2">
              <div className="pp-problems-header-input-group d-flex align-items-center gap-2 flex-wrap">
                <div className="active-history-toggle-group">
                  <ul className="nav nav-pills active-history-toggle-group-list toggle-group-small" role="tablist">
                    <li className="nav-item active-history-toggle-list">
                      <button className={`nav-link active-history-nav-link small ${recordType === 'active' ? 'active' : ''}`} onClick={() => handleRecordTypeChange('active')} type="button">Active</button>
                    </li>
                    <li className="nav-item active-history-toggle-list">
                      <button className={`nav-link active-history-nav-link small ${recordType === 'history' ? 'active' : ''}`} onClick={() => handleRecordTypeChange('history')} type="button">History</button>
                    </li>
                  </ul>
                </div>

                {recordType === 'history' && (<div className="pp-problems-header-recover-delete-record-group form-check ms-2">
                    <input type="checkbox" id={`pa_diagnosis_recover_deleted_input_checkbox_${patientId}`} className="form-check-input" checked={showDeleted} onChange={(event) => setShowDeleted(event.target.checked)}/>
                    <label className="form-check-label" htmlFor={`pa_diagnosis_recover_deleted_input_checkbox_${patientId}`}>Show Deleted Records</label>
                  </div>)}

                <div className="pp-problems-header-search-input-group position-relative ms-2">
                  <input id={`pa_search_problem_input_${patientId}`} type="text" className="form-control pa-search-problem-input" placeholder="Search problems" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)}/>
                  <LegacyIcon icon="fa-magnifying-glass" className="position-absolute end-0 top-50 translate-middle-y me-2 text-muted"/>
                </div>
              </div>

              <div className="pp-problems-header-action-icons-container d-flex align-items-center gap-2">
                <button type="button" className="btn pp-diagnosis-filter-icon-btn d-flex align-items-center gap-2 btn-md" onClick={openFilter}>
                  <LegacyIcon icon="mdi-filter-variant"/>Filter
                  {filterCount > 0 && <span className="ehr-patient-problems-filters-applied-badge">{filterCount}</span>}
                </button>
                {recordType !== 'history' && (<button type="button" className="pa-add-new-problem-btn btn btn-primary btn-md border-radius-button text-nowrap" id={`pp_add_new_problem_btn_${patientId}`} onClick={() => openAddEdit(null, 'create')}>
                    <LegacyIcon icon="mdi-plus"/> Add Problem
                  </button>)}
              </div>
            </div>
          </div>

          <div className="pp-problems-list-body">
            <PatientProblemsList patientId={patientId} recordType={recordType} showDeleted={showDeleted} searchTerm={searchTerm} filterType={appliedFilters.type} refreshKey={refreshKey} onEdit={(record) => openAddEdit(record, 'edit')} onRefresh={() => setRefreshKey((key) => key + 1)}/>
          </div>
        </div>

      {/* Add / Edit opens in a modal (legacy #pp_patient_problem_add_edit_modal). */}
      <Dialog visible={viewMode === 'ADD_EDIT'} onHide={() => closeAddEdit(false)} header={selectedRecord ? 'Edit Problems' : 'Add Problems'} className="pp-problem-modal" style={{ width: '75vw' }} breakpoints={{ '768px': '98vw' }} draggable={false} resizable={false}>
        {viewMode === 'ADD_EDIT' && (<>
          <ProblemModalPatientStrip patientId={patientId}/>
          <PatientProblemsAddEdit patientId={patientId} problemRecord={selectedRecord} actionType={actionType} statusMetadata={statusMetadata} onClose={closeAddEdit}/>
        </>)}
      </Dialog>

      <Sidebar visible={filterVisible} position="right" onHide={() => setFilterVisible(false)} className="pa-allergy-header-offcanvas-container offcanvas offcanvas-end" id={`pp_diagnosis_filter_acute_chronic_options_${patientId}`} header={<h5>Filter</h5>}>
        <form className="d-flex flex-column h-100" onSubmit={(event) => { event.preventDefault(); handleApplyFilters(); }}>
          <div className="form-group mb-3 flex-grow-1">
            <label htmlFor={`problem_section_diagnosis_type_options_${patientId}`} className="form-label">Type</label>
            <CommonSelect inputId={`problem_section_diagnosis_type_options_${patientId}`} value={filterForm.type} placeholder="Select type" onChange={(value) => setFilterForm({ type: value })} options={[{ value: 'ACUT', label: 'Acute' }, { value: 'CHRO', label: 'Chronic' }]}/>
          </div>
          <div className="pp-reset-apply-button-group pp-diagnosis-filter-sticky-footer">
            <button type="button" className="btn btn-primary border-radius-button reset px-3" onClick={handleResetFilters}>Reset</button>
            <button type="submit" className="btn btn-primary border-radius-button apply px-3" disabled={!isFilterDirty}>Apply</button>
          </div>
        </form>
      </Sidebar>
    </div>);
};
export default PatientProblems;
