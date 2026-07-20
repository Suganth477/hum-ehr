import { useCallback, useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import PatientImmunizationList from './PatientImmunizationList';
import PatientImmunizationDetails from './PatientImmunizationDetails';
import PatientImmunizationAddEdit from './PatientImmunizationAddEdit';
import { fetchImmunizationReferenceData } from '../../../services/immunizationService';
import { fetchPhysiciansInCareGroup } from '../../../services/lookupService';
import { fetchPatientDetails } from '../../../services/patientService';
import patientCache from '../../../utils/patientCache';
import { useNotify } from '../../../context/NotificationContext';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import './PatientImmunization.css';

const EMPTY_REFERENCE = { vaccines: [], routes: [], doseForms: [], units: [] };

/**
 * Immunization section. Mirrors the legacy <patient-immunization> two-pane layout:
 * Completed (record-type 'active') / Scheduled ('schedule') tabs, a left list, and
 * a right detail pane. Add/Edit opens in a modal (legacy used the shared XL modal).
 */
const PatientImmunization = ({ patientId }) => {
    const [recordType, setRecordType] = useState('active');
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [reference, setReference] = useState(EMPTY_REFERENCE);
    const [physicians, setPhysicians] = useState([]);
    const [careplanId, setCareplanId] = useState(null);
    const [addEdit, setAddEdit] = useState({ open: false, record: null });
    const { notifyError } = useNotify();

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const cachedRef = patientCache.get('immunizationReferenceData');
                const referenceData = cachedRef || await fetchImmunizationReferenceData();
                if (!cachedRef) patientCache.set('immunizationReferenceData', referenceData);
                // Physicians come back as an object-map keyed by id — flatten to an array.
                let physArray = patientCache.get('careGroupPhysicians');
                if (!physArray) {
                    const physicianResponse = await fetchPhysiciansInCareGroup();
                    const physData = physicianResponse?.status === 'success' ? physicianResponse.data : physicianResponse;
                    physArray = Array.isArray(physData) ? physData : Object.values(physData || {});
                    patientCache.set('careGroupPhysicians', physArray);
                }
                // careplanId for the save payload — reuse the demographics cache if present.
                let details = patientCache.get(`${patientId}_details`);
                if (!details) {
                    const detailsResponse = await fetchPatientDetails(patientId);
                    details = detailsResponse?.status === 'success' ? detailsResponse.data?.patientDetails : null;
                }
                if (ignore) return;
                setReference(referenceData);
                setPhysicians(physArray);
                setCareplanId(details?.carePlanId ?? null);
            }
            catch (error) {
                console.error('Failed to load immunization reference data.', error);
                if (!ignore) notifyError(error?.message || 'Unable to load immunization reference data.');
            }
        })();
        return () => { ignore = true; };
    }, [patientId, notifyError]);

    const handleRecordTypeChange = (type) => {
        setRecordType(type);
        setSearchTerm('');
        setSelectedRecord(null);
    };
    const openAddEdit = useCallback((record = null) => setAddEdit({ open: true, record }), []);
    const closeAddEdit = useCallback((shouldRefresh = false) => {
        setAddEdit({ open: false, record: null });
        if (shouldRefresh) { setSelectedRecord(null); setRefreshKey((k) => k + 1); }
    }, []);

    return (<div className="immunization-main-container row" id={`patient_immunization_hub_${patientId}`}>
      <div className="col-md-3 implantable-device-list-container pc-left-side-main-container">
        <div className="pc-patient-immunization-main-header container-fluid p-0 my-2">
          <div className="toggle-add-device-btn-container toggle-and-add-btn-container d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="active-schedule-toggle-group">
              <ul className="nav nav-pills active-history-toggle-group-list toggle-group-small" role="tablist">
                <li className="nav-item active-history-toggle-list">
                  <button type="button" className={`nav-link active-history-nav-link small ${recordType === 'active' ? 'active' : ''}`} onClick={() => handleRecordTypeChange('active')}>Completed</button>
                </li>
                <li className="nav-item active-history-toggle-list">
                  <button type="button" className={`nav-link active-history-nav-link small ${recordType === 'schedule' ? 'active' : ''}`} onClick={() => handleRecordTypeChange('schedule')}>Scheduled</button>
                </li>
              </ul>
            </div>
            <button type="button" className="pc-add-new-immunization-btn pc-add-new-section-details-btn btn btn-primary btn-md border-radius-button" onClick={() => openAddEdit(null)}>
              <LegacyIcon icon="mdi-plus" className="icon-size-20"/> Add Vaccine
            </button>
          </div>
          <div className="search-immunization-container icon-input-group pc-search-input-container mt-2">
            <div className="position-relative">
              <input id={`search_immunization_device_name_${patientId}`} type="text" className="form-control search-immunization-name text-capitalize" placeholder="Search Immunization" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)}/>
              <LegacyIcon icon="mdi-magnify" className="input-icon" style={{ position: 'absolute', right: 10, top: 6 }}/>
            </div>
          </div>
        </div>
        <div className="immunization-list-table-container pc-left-side-list-container p-2">
          <PatientImmunizationList patientId={patientId} recordType={recordType} searchTerm={searchTerm} refreshKey={refreshKey} selectedId={selectedRecord?.id} onSelect={setSelectedRecord}/>
        </div>
      </div>
      <div className="col-md-9 immunization-detail-container pc-section-selected-detail-view-container ps-0">
        <PatientImmunizationDetails patientId={patientId} recordType={recordType} record={selectedRecord} onEdit={(record) => openAddEdit(record)} onDeleted={() => { setSelectedRecord(null); setRefreshKey((k) => k + 1); }}/>
      </div>

      <Dialog visible={addEdit.open} onHide={() => closeAddEdit(false)} header={`${addEdit.record ? 'Edit' : 'Add'} Immunization Detail`} style={{ width: '70vw' }} breakpoints={{ '768px': '95vw' }}>
        {addEdit.open && (<PatientImmunizationAddEdit patientId={patientId} record={addEdit.record} reference={reference} physicians={physicians} careplanId={careplanId} onClose={closeAddEdit}/>)}
      </Dialog>
    </div>);
};
export default PatientImmunization;
