import { useCallback, useEffect, useState } from 'react';
import PatientProcedureList from './PatientProcedureList';
import PatientProcedureDetails from './PatientProcedureDetails';
import PatientProcedureAddEdit from './PatientProcedureAddEdit';
import { fetchProcedureReferenceData } from '../../../services/procedureService';
import patientCache from '../../../utils/patientCache';
import { useNotify } from '../../../context/NotificationContext';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import './PatientProcedure.css';

const EMPTY_REFERENCE = { statuses: [], outcomes: [], categories: [], followUpTypes: [] };

/**
 * Procedure section (legacy patient-ehr-procedure-details-main-element): a two-pane
 * list/detail view with a toggleable search, "Show Deleted Records" filter, and an
 * inline add/edit view swap (legacy hides the list+detail while the form is open).
 */
const PatientProcedure = ({ patientId }) => {
    const [view, setView] = useState('list');
    const [editRecord, setEditRecord] = useState(null);
    const [searchOpen, setSearchOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState('');
    const [showDeleted, setShowDeleted] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [selectId, setSelectId] = useState(null);
    const [reference, setReference] = useState(EMPTY_REFERENCE);
    const { notifyError } = useNotify();

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                let ref = patientCache.get('procedureReferenceData');
                if (!ref) {
                    ref = await fetchProcedureReferenceData();
                    patientCache.set('procedureReferenceData', ref);
                }
                if (!ignore) setReference(ref);
            }
            catch (error) {
                console.error('Failed to fetch the details required to add/edit procedure.', error);
                if (!ignore) notifyError(error?.message || 'Failed to fetch the details required to add/edit procedure. Please try again.');
            }
        })();
        return () => { ignore = true; };
    }, [notifyError]);

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

    return (<div className="pcps-patient-procedure-main-container" id={`patient_procedure_hub_${patientId}`}>
      {view === 'list' && (<div className="row pcps-procedure-header-add-edit-container">
        <div className="col-md-3 pcps-patient-procedure-main-list-container pc-left-side-main-container">
          <div className="container-fluid p-0 my-2">
            {!searchOpen && (<div className="toggle-and-add-btn-container d-flex justify-content-end align-items-center gap-3">
              <div className="pc-search-icon-container" role="button" onClick={() => setSearchOpen(true)}><LegacyIcon icon="mdi-magnify" style={{ fontSize: 20 }}/></div>
              <button type="button" className="pcps-patient-add-procedure-btn" onClick={() => openAddEdit(null)}>
                <LegacyIcon icon="mdi-plus" className="icon-size-20"/> Add Procedure
              </button>
            </div>)}
            {searchOpen && (<div className="icon-input-group pc-search-input-container">
              <div className="row align-items-center">
                <div className="col-md-1">
                  <LegacyIcon icon="mdi-arrow-left" className="back-to-icon" role="button" onClick={() => { setSearchOpen(false); setSearchTerm(''); }}/>
                </div>
                <div className="col-md-11 position-relative">
                  <input type="text" id={`pcps_procedure_search_input_${patientId}`} placeholder="Search Procedure" className="form-control" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
                  <LegacyIcon icon="mdi-magnify" className="input-icon" style={{ position: 'absolute', right: 18, top: 6 }}/>
                </div>
              </div>
            </div>)}
          </div>
          <div className="pcps-patient-procedure-marked-as-error-container">
            <label className="label-name d-flex align-items-center mb-2">
              <input type="checkbox" className="form-check-input me-2" checked={showDeleted} onChange={(e) => { setShowDeleted(e.target.checked); setSelectedRecord(null); }}/>
              <span>Show Deleted Records</span>
            </label>
          </div>
          <div className="pcps-patient-procedure-list-container pc-left-side-list-container custom-scrollbar p-2">
            <PatientProcedureList patientId={patientId} searchTerm={searchTerm} showDeleted={showDeleted}
              refreshKey={refreshKey} selectId={selectId} selectedId={selectedRecord?.id} onSelect={setSelectedRecord}/>
          </div>
        </div>
        <div className="col-md-9 pcps-patient-procedure-record-information custom-scrollbar" style={{ maxHeight: '70vh', overflow: 'auto' }}>
          <PatientProcedureDetails patientId={patientId} record={selectedRecord} onEdit={openAddEdit} onDeleted={refresh}/>
        </div>
      </div>)}

      {view === 'addEdit' && (<div className="pcps-add-edit-procedure-main-container">
        <PatientProcedureAddEdit patientId={patientId} record={editRecord} reference={reference} onClose={closeAddEdit}/>
      </div>)}
    </div>);
};
export default PatientProcedure;
