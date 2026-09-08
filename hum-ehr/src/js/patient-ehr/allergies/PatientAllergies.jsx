import { useCallback, useEffect, useMemo, useState } from 'react';
import { Sidebar } from 'primereact/sidebar';
import PatientAllergiesList from './PatientAllergiesList';
import PatientAllergiesViewDetails from './PatientAllergiesViewDetails';
import PatientAllergiesAddEdit from './PatientAllergiesAddEdit';
import PatientAllergyLookupInput from './PatientAllergyLookupInput';
import { fetchAllergyMetadata } from '../../../services/lookupService';
import { savePatientAllergy, deletePatientAllergy, buildDeletePayload } from '../../../services/allergyService';
import moment from '../../../utils/dayjs';
import patientCache from '../../../utils/patientCache';
import { useNotify } from '../../../context/NotificationContext';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import './PatientAllergies.css';
const EMPTY_FILTERS = {
    allergyType: '',
    subType: '',
    subTypeCode: '',
    reaction: '',
    reactionCode: '',
    severity: '',
};
const EMPTY_LOOKUPS = {
    allergyTypes: [],
    severities: [],
    criticalities: [],
    verificationStatuses: [],
    clinicalStatuses: [],
};
const normalizeHumCodeList = (items) => {
    if (!items)
        return [];
    // HumCode lookups (allergy types, clinical statuses) come back as an object
    // map keyed by code — { DRUG: { code: 'DRUG', description: 'Drug' }, ... } —
    // see the legacy `utility.appendHumCodeListOfValues`, which iterates them
    // with `Object.keys(...)`. Other endpoints return a plain array, so support
    // both shapes here.
    const list = Array.isArray(items) ? items : Object.values(items);
    return list.map((item) => ({
        ...item,
        code: item.code,
        description: item.description || item.conceptName || item.name || item.code,
    }));
};
const PatientAllergies = ({ patientId }) => {
    const [viewMode, setViewMode] = useState('LIST');
    const [recordType, setRecordType] = useState('active');
    const [showDeleted, setShowDeleted] = useState(false);
    const [filterVisible, setFilterVisible] = useState(false);
    const [selectedRecord, setSelectedRecord] = useState(null);
    const [selectedDetail, setSelectedDetail] = useState(null); // record shown in the right detail pane
    const [actionType, setActionType] = useState('create');
    const [searchTerm, setSearchTerm] = useState('');
    const [refreshKey, setRefreshKey] = useState(0);
    const [lookups, setLookups] = useState(EMPTY_LOOKUPS);
    const [filterForm, setFilterForm] = useState(EMPTY_FILTERS);
    const [records, setRecords] = useState([]);
    const [nkaError, setNkaError] = useState('');

    const { notifyError, notifySuccess } = useNotify();
    const isNkaOrNkdaFilter = useMemo(() => ['NKA', 'NKDA'].includes(filterForm.allergyType || ''), [filterForm.allergyType]);
    useEffect(() => {
        let ignore = false;
        const loadAllergyMetadata = async () => {
            try {
                const metadata = await fetchAllergyMetadata();
                if (ignore)
                    return;
                const payload = {
                    allergyTypes: normalizeHumCodeList(metadata.types),
                    severities: metadata.severities || [],
                    criticalities: metadata.criticalities || [],
                    verificationStatuses: metadata.verificationStatuses || [],
                    clinicalStatuses: normalizeHumCodeList(metadata.clinicalStatuses),
                };
                setLookups(payload);
                patientCache.set(`allergyMetadata_${patientId}`, payload);
            }
            catch (error) {
                console.error('Failed to load allergy metadata.', error);
                if (!ignore)
                    notifyError(error?.message || 'Unable to load allergy reference data.');
            }
        };
        loadAllergyMetadata();
        return () => {
            ignore = true;
        };
    }, [patientId, notifyError]);
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
    const updateFilter = (key, value) => {
        setFilterForm((previous) => {
            const nextValue = { ...previous, [key]: value };
            if (key === 'allergyType' && ['NKA', 'NKDA'].includes(value)) {
                nextValue.subType = '';
                nextValue.subTypeCode = '';
                nextValue.reaction = '';
                nextValue.reactionCode = '';
                nextValue.severity = '';
            }
            return nextValue;
        });
    };
    const handleResetFilters = () => {
        setFilterForm(EMPTY_FILTERS);
        setRefreshKey((key) => key + 1);
    };
    const handleApplyFilters = () => {
        setFilterVisible(false);
        setRefreshKey((key) => key + 1);
    };
    const handleRecordTypeChange = (type) => {
        setRecordType(type);
        setShowDeleted(false);
        setSelectedDetail(null);
    };
    // Keep the right detail pane in sync with the loaded list: re-point to the same
    // record if it still exists, otherwise default to the first one (legacy auto-selects).
    const handleRecordsLoaded = useCallback((loaded) => {
        setRecords(loaded || []);
        setNkaError('');
        setSelectedDetail((current) => {
            if (!loaded || !loaded.length) return null;
            const match = current && loaded.find((r) => String(r.allergyId) === String(current.allergyId));
            return match || loaded[0];
        });
    }, []);

    // --- "No Known Allergy" / "No Known Drug Allergy" quick-add cards ---
    const nkaRecord = useMemo(() => records.find((r) => r.allergyTypeCode === 'NKA'), [records]);
    const nkdaRecord = useMemo(() => records.find((r) => r.allergyTypeCode === 'NKDA'), [records]);
    const hasRealActiveAllergies = useMemo(() => records.some((r) => !['NKA', 'NKDA'].includes(r.allergyTypeCode)), [records]);
    const hasDrugAllergies = useMemo(() => records.some((r) => r.allergyTypeCode === 'DRUG'), [records]);

    const buildNoKnownPayload = (allergyType) => ({
        activeFlag: 'Y',
        patientId,
        careplanId: records[0]?.careplanId || patientCache.get(`${patientId}_details`)?.carePlanId || null,
        allergyId: null,
        allergyType,
        allergySubType: null,
        allergySubTypeId: null,
        description: null,
        effectiveDate: moment().format('MM-DD-YYYY hh:mm A'),
        lastEffectiveDate: null,
        onSetDate: null,
        criticalityId: null,
        verificationStatusCode: '',
        allergyClinicalStatusCode: '',
        allergyClinicalstatus: '',
        reactionMapping: [],
        allergyReactions: [],
        PatientLogMessageUserInput: 'A new allergy "No Known Allergies" has been added ',
        PatientLogMessage: 'A new allergy "No Known Allergies" has been added ',
        actionType: 'create',
    });

    const toggleNoKnownAllergy = async (allergyType, checked) => {
        setNkaError('');
        if (checked) {
            // Legacy guards: NKA blocked when any allergy exists; NKDA blocked when a drug allergy exists.
            if (allergyType === 'NKA' && hasRealActiveAllergies) {
                setNkaError('Allergies exist for this patient. Review and remove them before marking the patient as "No Known Allergies".');
                return;
            }
            if (allergyType === 'NKDA' && hasDrugAllergies) {
                setNkaError('Drug allergies exist for this patient. Review and remove them before marking the patient as "No Known Drug Allergies".');
                return;
            }
            try {
                const response = await savePatientAllergy(buildNoKnownPayload(allergyType));
                if (!response || response.status === 'success') { notifySuccess('Allergy details saved successfully.'); setRefreshKey((key) => key + 1); }
                else notifyError(response.message || 'Failed to save allergy data');
            } catch (error) {
                console.error('Failed to save no-known allergy.', error);
                notifyError('Failed to save allergy data');
            }
        } else {
            const record = allergyType === 'NKA' ? nkaRecord : nkdaRecord;
            if (!record) return;
            try {
                await deletePatientAllergy(buildDeletePayload({ patientId, allergyRecord: record, changeLogNotes: 'An existing allergy "No Known Allergies" has been deleted' }));
                notifySuccess('Allergy record deleted.');
                setRefreshKey((key) => key + 1);
            } catch (error) {
                console.error('Failed to remove no-known allergy.', error);
                notifyError('Failed to delete the allergy record.');
            }
        }
    };
    return (<div className="pa-allergies-main-container" id={`patient_allergies_hub_${patientId}`}>
      {viewMode === 'LIST' ? (<div className="pa-allergies-list-main-container row">
          <div className="col-md-3 pc-left-side-main-container custom-scrollbar">
            <div className="container-fluid p-0 my-2 row align-items-center">
              <div className="col-6 d-flex">
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
              </div>
              <div className="col-6 d-flex justify-content-end align-items-center gap-2">
                <button type="button" className="btn btn-outline-secondary btn-sm filter-icon-btn" title="Filter" onClick={() => setFilterVisible(true)}>
                  <LegacyIcon icon="mdi-filter-variant"/>
                </button>
                {recordType !== 'history' && (<button type="button" className="pa-add-new-allergy-btn btn btn-primary btn-md border-radius-button text-nowrap" id={`pa_add_new_allergy_btn_${patientId}`} onClick={() => openAddEdit(null, 'create')}>
                    <LegacyIcon icon="mdi-plus"/> Add Allergy
                  </button>)}
              </div>
            </div>

            {recordType === 'history' && (<div className="pa-allergy-header-recover-delete-record-group form-check my-1">
                <input type="checkbox" id={`pa_allergy_recover_deleted_deleted_input_checkbox_${patientId}`} className="form-check-input pa_allergy_recover_deleted_deleted_input_checkbox" checked={showDeleted} onChange={(event) => setShowDeleted(event.target.checked)}/>
                <label className="form-check-label pa_allergy_recover_deleted_deleted_input_checkbox_label" htmlFor={`pa_allergy_recover_deleted_deleted_input_checkbox_${patientId}`}>
                  Show Deleted Records
                </label>
              </div>)}

            <div className="pcps-patient-allergy-input-container row p-0">
              <div className="col-md-12 mt-2 position-relative">
                <input id={`pa_search_allergy_input_${patientId}`} type="text" className="form-control pa-search-allergy-input text-capitalize" placeholder="Search Allergy" value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)}/>
                <LegacyIcon icon="mdi-magnify" style={{ position: 'absolute', right: 14, top: 8 }}/>
              </div>
            </div>

            {recordType === 'active' && (<div className="pcps-patient-no-allergy-container mt-3">
              <div className="allergy-card allergy-nka-card d-flex align-items-center justify-content-between mb-2 p-2">
                <label className="d-flex align-items-center flex-grow-1 mb-0 cursor-pointer" htmlFor={`pcps_no_known_allergy_checkbox_${patientId}`}>
                  <div className="allergy-icon me-3"><LegacyIcon icon="mdi-hand-back-right-off-outline"/></div>
                  <div>
                    <div className="allergy-title fw-bold">No Known Allergy</div>
                    <div className="allergy-subtitle small text-muted">Patient Has No Known Allergies Of Any Type</div>
                  </div>
                </label>
                <input type="checkbox" id={`pcps_no_known_allergy_checkbox_${patientId}`} className="form-check-input allergy-checkbox" checked={!!nkaRecord} onChange={(event) => toggleNoKnownAllergy('NKA', event.target.checked)}/>
              </div>
              <div className="allergy-card allergy-nkda-card d-flex align-items-center justify-content-between p-2">
                <label className="d-flex align-items-center flex-grow-1 mb-0 cursor-pointer" htmlFor={`pcps_no_known_drug_allergy_checkbox_${patientId}`}>
                  <div className="allergy-icon me-3"><LegacyIcon icon="mdi-pill-off"/></div>
                  <div>
                    <div className="allergy-title fw-bold">No Known Drug Allergy</div>
                    <div className="allergy-subtitle small text-muted">Covers Only Drug Allergy Type</div>
                    {!!nkdaRecord && (<span className="blocked-pill mt-2 d-inline-flex align-items-center small"><LegacyIcon icon="mdi-lock" className="me-1"/>Drug Type Was Blocked</span>)}
                  </div>
                </label>
                <input type="checkbox" id={`pcps_no_known_drug_allergy_checkbox_${patientId}`} className="form-check-input allergy-checkbox" checked={!!nkdaRecord} onChange={(event) => toggleNoKnownAllergy('NKDA', event.target.checked)}/>
              </div>
              {nkaError && <span className="text-danger mt-2 d-block small">{nkaError}</span>}
            </div>)}

            <div className="allergy-list-table-container pc-left-side-list-container mt-1 p-1">
              <PatientAllergiesList patientId={patientId} recordType={recordType} showDeleted={showDeleted} searchTerm={searchTerm} advancedFilters={filterForm} refreshKey={refreshKey} selectedId={selectedDetail?.allergyId} onSelect={setSelectedDetail} onRecordsLoaded={handleRecordsLoaded}/>
            </div>
          </div>

          <div className="col-md-9 pcps-patient-allergy-record-information custom-scrollbar">
            <PatientAllergiesViewDetails patientId={patientId} record={selectedDetail} recordType={recordType} onEdit={(record) => openAddEdit(record, 'edit')} onRecoverEdit={(record) => openAddEdit(record, 'recover')} onDeleted={() => { setSelectedDetail(null); setRefreshKey((key) => key + 1); }}/>
          </div>
        </div>) : (<div className="pa-allergies-add-edit-main-container">
          <PatientAllergiesAddEdit patientId={patientId} allergyRecord={selectedRecord} actionType={actionType} recordType={recordType} lookups={lookups} onClose={closeAddEdit}/>
        </div>)}

      <Sidebar visible={filterVisible} position="right" onHide={() => setFilterVisible(false)} className="pa-allergy-header-offcanvas-container offcanvas offcanvas-end" id={`pa_allergy_filter_acute_chronic_options_${patientId}`} header={<h5>Allergy Filters</h5>}>
        <form id={`pa_allergy_filter_multiple_options_form_id_${patientId}`} className="ignore-auto-save" onSubmit={(event) => { event.preventDefault(); handleApplyFilters(); }}>
          <div className="form-group mb-3">
            <label htmlFor={`pa_allergy_section_allergy_intolerance_type_options_${patientId}`} className="form-label">Allergy Type</label>
            <select id={`pa_allergy_section_allergy_intolerance_type_options_${patientId}`} className="form-select form-select-sm" value={filterForm.allergyType} onChange={(event) => updateFilter('allergyType', event.target.value)}>
              <option value="">Select Type</option>
              {lookups.allergyTypes.map((type) => <option key={type.code} value={type.code}>{type.description}</option>)}
            </select>
          </div>

          <div className="mt-3 form-group pc-search-input-container">
            <PatientAllergyLookupInput id={`pa_allergy_section_allergen_type_${patientId}`} label="Allergy Subtype" conceptCategory="ALST" value={filterForm.subType} disabled={isNkaOrNkdaFilter} onChange={(value) => setFilterForm((previous) => ({ ...previous, subType: value, subTypeCode: '' }))} onSelect={(selected) => setFilterForm((previous) => ({ ...previous, subType: selected.value, subTypeCode: String(selected.code) }))}/>
          </div>

          <div className="mt-3 form-group pc-search-input-container">
            <PatientAllergyLookupInput id={`pa_allergy_section_allergen_reaction_${patientId}`} label="Reaction" conceptCategory="ALRE" value={filterForm.reaction} disabled={isNkaOrNkdaFilter} onChange={(value) => setFilterForm((previous) => ({ ...previous, reaction: value, reactionCode: '' }))} onSelect={(selected) => setFilterForm((previous) => ({ ...previous, reaction: selected.value, reactionCode: String(selected.code) }))}/>
          </div>

          <div className="mt-3 form-group">
            <label htmlFor={`pa_allergy_section_severity_type_options_${patientId}`} className="form-label">Severity</label>
            <select id={`pa_allergy_section_severity_type_options_${patientId}`} className="form-select form-select-sm" value={filterForm.severity} disabled={isNkaOrNkdaFilter} onChange={(event) => updateFilter('severity', event.target.value)}>
              <option value="">Select Severity</option>
              {lookups.severities.map((severity) => <option key={severity.id} value={severity.id}>{severity.conceptName}</option>)}
            </select>
          </div>

          <div className="pp-reset-apply-button-group mt-4 form-group d-flex justify-content-between">
            <button type="button" className="btn btn-outline-secondary border-radius-button reset bs-offcanvas-reset-btn" onClick={handleResetFilters}>Reset</button>
            <button type="submit" className="btn btn-primary border-radius-button apply bs-offcanvas-apply-btn" style={{ width: 120 }}>Apply</button>
          </div>
        </form>
      </Sidebar>
    </div>);
};
export default PatientAllergies;
