import { useCallback, useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import PatientPreferencesList from './PatientPreferencesList';
import PatientPreferencesViewDetails from './PatientPreferencesViewDetails';
import PatientPreferencesAddEdit from './PatientPreferencesAddEdit';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import {
    PREFERENCES_DESC_MAP, fetchPreferenceLookups, fetchPreferenceStatuses,
} from '../../../services/preferencesService';
import patientCache from '../../../utils/patientCache';
import { useNotify } from '../../../context/NotificationContext';
import './PatientPreferences.css';

const SUB_SECTIONS = [
    { type: 'advance-directives', label: 'Advance Directives' },
    { type: 'care-preferences', label: 'Care Preferences' },
    { type: 'treatment-preferences', label: 'Treatment Preferences' },
];

/**
 * Patient Preferences section. Mirrors the legacy <patient-ehr-preferences>: Active /
 * Inactive tabs, three sub-sections (Advance Directives / Care / Treatment), a searchable
 * list, and a detail pane. Add/Edit opens in a modal. Advance-directive attachments use
 * the shared Universal File Uploader.
 */
const PatientPreferences = ({ patientId }) => {
    const [recordType, setRecordType] = useState('active');
    const [preferencesType, setPreferencesType] = useState('advance-directives');
    const [searchTerm, setSearchTerm] = useState('');
    const [showDeleted, setShowDeleted] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [refreshKey, setRefreshKey] = useState(0);
    const [reference, setReference] = useState({ lookups: {}, statuses: [] });
    const [addEdit, setAddEdit] = useState({ open: false, record: null });
    const { notifyError } = useNotify();

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                let ref = patientCache.get('preferencesReference');
                if (!ref) {
                    const [lookups, statuses] = await Promise.all([fetchPreferenceLookups(), fetchPreferenceStatuses()]);
                    ref = { lookups, statuses };
                    patientCache.set('preferencesReference', ref);
                }
                if (!ignore) setReference(ref);
            }
            catch (error) {
                console.error('Failed to load preferences reference data.', error);
                if (!ignore) notifyError(error?.message || 'Failed to load preferences reference data.');
            }
        })();
        return () => { ignore = true; };
    }, [notifyError]);

    const changeRecordType = (type) => { setRecordType(type); setSearchTerm(''); setShowDeleted(false); setSelectedRecord(null); };
    const changeSubSection = (type) => { setPreferencesType(type); setSearchTerm(''); setSelectedRecord(null); };
    const openAddEdit = useCallback((record = null) => setAddEdit({ open: true, record }), []);
    const closeAddEdit = useCallback((shouldRefresh = false) => {
        setAddEdit({ open: false, record: null });
        if (shouldRefresh) { setSelectedRecord(null); setRefreshKey((k) => k + 1); }
    }, []);

    const lookupsForType = reference.lookups[preferencesType] || [];

    return (<div className="preferences-main-container row" id={`patient_preferences_hub_${patientId}`}>
      <div className="col-md-3 preferences-list-container pc-left-side-main-container">
        <div className="pc-patient-preferences-main-header container-fluid p-0 my-2">
          <div className="toggle-and-add-btn-container d-flex justify-content-between align-items-center flex-wrap gap-2">
            <div className="active-history-toggle-group">
              <ul className="nav nav-pills active-history-toggle-group-list toggle-group-small" role="tablist">
                <li className="nav-item active-history-toggle-list">
                  <button type="button" className={`nav-link active-history-nav-link small ${recordType === 'active' ? 'active' : ''}`} onClick={() => changeRecordType('active')}>Active</button>
                </li>
                <li className="nav-item active-history-toggle-list">
                  <button type="button" className={`nav-link active-history-nav-link small ${recordType === 'history' ? 'active' : ''}`} onClick={() => changeRecordType('history')}>Inactive</button>
                </li>
              </ul>
            </div>
            {recordType === 'active' && (
              <button type="button" className="pc-add-new-preferences-btn pc-add-new-section-details-btn btn btn-primary btn-md border-radius-button" onClick={() => openAddEdit(null)}>
                <LegacyIcon icon="mdi-plus" className="icon-size-20"/> Add
              </button>
            )}
          </div>

          <div className="preferences-sub-section-toggle-group mt-2">
            <ul className="nav nav-pills sub-section-toggle-group-list toggle-group-small" role="tablist">
              {SUB_SECTIONS.map((s) => (
                <li key={s.type} className="nav-item sub-section-toggle-list">
                  <button type="button" className={`nav-link sub-section-nav-link small ${preferencesType === s.type ? 'active' : ''}`} onClick={() => changeSubSection(s.type)}>{s.label}</button>
                </li>
              ))}
            </ul>
          </div>

          {recordType === 'history' && (
            <label className="pc-preferences-header-recover-delete-record d-block mt-2" style={{ fontWeight: 600, fontSize: 12 }}>
              <input type="checkbox" className="form-check-input me-2" checked={showDeleted} onChange={(e) => { setShowDeleted(e.target.checked); setSelectedRecord(null); }}/>
              View marked as error
            </label>
          )}

          <div className="search-preferences-container icon-input-group pc-search-input-container mt-2">
            <div className="position-relative">
              <input id={`pc_preferences_list_search_input_${patientId}`} type="text" className="form-control text-capitalize" placeholder="Search" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
              <LegacyIcon icon="mdi-magnify" className="input-icon" style={{ position: 'absolute', right: 10, top: 6 }}/>
            </div>
          </div>
        </div>

        <div className="preferences-list-table-container pc-left-side-list-container p-2">
          <PatientPreferencesList key={`${recordType}_${preferencesType}`} patientId={patientId} recordType={recordType} preferencesType={preferencesType}
            lookups={lookupsForType} searchTerm={searchTerm} showDeleted={showDeleted} refreshKey={refreshKey}
            selectedId={selectedRecord?.id} onSelect={setSelectedRecord}/>
        </div>
      </div>

      <div className="col-md-9 preferences-detail-container pc-section-selected-detail-view-container ps-0">
        <PatientPreferencesViewDetails patientId={patientId} recordType={recordType} preferencesType={preferencesType}
          record={selectedRecord} lookups={lookupsForType} onEdit={(record) => openAddEdit(record)}/>
      </div>

      <Dialog visible={addEdit.open} onHide={() => closeAddEdit(false)} header={`${addEdit.record ? 'Edit' : 'Add'} ${PREFERENCES_DESC_MAP[preferencesType]}`} style={{ width: '70vw' }} breakpoints={{ '768px': '95vw' }}>
        {addEdit.open && (<PatientPreferencesAddEdit patientId={patientId} preferencesType={preferencesType} record={addEdit.record}
          lookups={lookupsForType} statuses={reference.statuses} onClose={closeAddEdit}/>)}
      </Dialog>
    </div>);
};
export default PatientPreferences;
