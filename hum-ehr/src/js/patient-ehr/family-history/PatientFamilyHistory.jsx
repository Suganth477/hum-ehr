import { useCallback, useEffect, useState } from 'react';
import PatientFamilyHistoryList from './PatientFamilyHistoryList';
import PatientFamilyHistoryAddEdit from './PatientFamilyHistoryAddEdit';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import {
    fetchFamilyHistory, fetchFamilyRelationTypes, searchFamilyHistorySnomed,
} from '../../../services/familyHistoryService';
import patientCache from '../../../utils/patientCache';
import { useNotify } from '../../../context/NotificationContext';
import './PatientFamilyHistory.css';

/**
 * Family Health History section. Mirrors the legacy <patient-family-history>: a read
 * matrix (members × conditions) with an "Add / Edit Family History" toggle into the
 * editable spreadsheet. Relation types + default SNOMED conditions are preloaded for
 * the editor.
 */
const PatientFamilyHistory = ({ patientId }) => {
    const [view, setView] = useState('list');
    const [hasData, setHasData] = useState(false);
    const [refreshKey, setRefreshKey] = useState(0);
    const [reference, setReference] = useState({ relationTypes: [], defaultSnomed: [] });
    const [editSeed, setEditSeed] = useState(null);
    const [openingEditor, setOpeningEditor] = useState(false);
    const { notifyError } = useNotify();

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                let ref = patientCache.get('familyHistoryReference');
                if (!ref) {
                    const [relationTypes, defaultSnomed] = await Promise.all([
                        fetchFamilyRelationTypes(),
                        searchFamilyHistorySnomed({ searchSnomed: '', isDefaultValue: 'Y' }),
                    ]);
                    ref = { relationTypes, defaultSnomed };
                    patientCache.set('familyHistoryReference', ref);
                }
                if (!ignore) setReference(ref);
            }
            catch (error) {
                console.error('Failed to load family history reference data.', error);
                if (!ignore) notifyError(error?.message || 'Failed to load family history reference data.');
            }
        })();
        return () => { ignore = true; };
    }, [notifyError]);

    const openEditor = useCallback(async () => {
        setOpeningEditor(true);
        try {
            const { members, diseases } = await fetchFamilyHistory(patientId);
            setEditSeed({ initialMembers: members, initialDiseases: diseases });
            setView('edit');
        }
        catch (error) {
            console.error('Failed to load family history for editing.', error);
            notifyError(error?.message || 'Failed to load family history. Please try again.');
        }
        finally { setOpeningEditor(false); }
    }, [patientId, notifyError]);

    const closeEditor = useCallback((shouldRefresh) => {
        setView('list');
        setEditSeed(null);
        if (shouldRefresh) setRefreshKey((k) => k + 1);
    }, []);

    return (<div className="patient-family-history-container" id={`patient_family_history_hub_${patientId}`}>
      {view === 'list' && (<>
        <div className="row add-edit-fh-btn-container">
          <div className="col-md-12 d-flex justify-content-between my-3">
            <div className="view-edit-family-history-text align-items-center label-svg-heading d-flex">View / Edit Family History</div>
            <button className="add-edit-family-history btn btn-primary btn-md border-radius-button" onClick={openEditor} disabled={openingEditor}>
              <LegacyIcon icon={hasData ? 'mdi-pencil' : 'mdi-plus'}/> {openingEditor ? 'Please wait...' : (hasData ? 'Edit Family History' : 'Add Family History')}
            </button>
          </div>
        </div>
        <div className="family-history-list-container">
          <PatientFamilyHistoryList patientId={patientId} refreshKey={refreshKey} onDataLoaded={setHasData}/>
        </div>
      </>)}

      {view === 'edit' && editSeed && (
        <div className="family-history-add-edit-list-container">
          <PatientFamilyHistoryAddEdit patientId={patientId}
            initialMembers={editSeed.initialMembers} initialDiseases={editSeed.initialDiseases}
            defaultSnomed={reference.defaultSnomed} relationTypes={reference.relationTypes}
            onClose={closeEditor}/>
        </div>
      )}
    </div>);
};
export default PatientFamilyHistory;
