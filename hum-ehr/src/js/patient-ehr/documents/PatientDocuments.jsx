import { useCallback, useEffect, useMemo, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { Sidebar } from 'primereact/sidebar';
import PatientDocumentsList from './PatientDocumentsList';
import PatientDocumentsAddEdit from './PatientDocumentsAddEdit';
import PatientDocumentsView from './PatientDocumentsView';
import {
    DOCUMENT_SUB_GROUPS, fetchDocumentCategories, fetchDocumentStatuses,
} from '../../../services/documentsService';
import patientCache from '../../../utils/patientCache';
import { useNotify } from '../../../context/NotificationContext';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import './PatientDocuments.css';

/**
 * Patient EHR Documents section. Mirrors the legacy <patient-ehr-documents>: sub-group
 * nav pills (All / Clinical / Patient & Administrative / Preventive & Wellness / Care
 * Coordination / Legal), server-side searched + paginated table, a Filter offcanvas
 * (page length + category checkboxes with search/Clear/Reset/Apply), Add/Edit in a
 * modal, and a View Docs modal with a per-file viewer.
 */
const PatientDocuments = ({ patientId }) => {
    const [subGroup, setSubGroup] = useState('ALL');
    const [searchTerm, setSearchTerm] = useState('');
    const [reference, setReference] = useState({ categories: [], statuses: [] });
    const [refreshKey, setRefreshKey] = useState(0);
    // Applied filter values drive the fetch; draft values live in the offcanvas until Apply.
    const [applied, setApplied] = useState({ pageLength: 10, categoryCodes: [] });
    const [filterOpen, setFilterOpen] = useState(false);
    const [draftLength, setDraftLength] = useState('10');
    const [draftChecked, setDraftChecked] = useState([]);
    const [categorySearch, setCategorySearch] = useState('');
    const [dialog, setDialog] = useState({ type: null, record: null });
    const { notifyError } = useNotify();

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                let ref = patientCache.get('patientDocumentsReference');
                if (!ref) {
                    const [categories, statuses] = await Promise.all([fetchDocumentCategories(), fetchDocumentStatuses()]);
                    ref = { categories, statuses };
                    patientCache.set('patientDocumentsReference', ref);
                }
                if (!ignore) setReference(ref);
            }
            catch (error) {
                console.error('Failed to load documents reference data.', error);
                if (!ignore) notifyError(error?.message || 'Failed to get data');
            }
        })();
        return () => { ignore = true; };
    }, [notifyError]);

    const closeDialog = useCallback((shouldRefresh) => {
        setDialog({ type: null, record: null });
        if (shouldRefresh) setRefreshKey((k) => k + 1);
    }, []);

    const toggleDraftCategory = (code, checked) => {
        setDraftChecked((prev) => (checked ? [...prev, code] : prev.filter((c) => c !== code)));
    };
    const applyFilters = () => {
        setApplied({ pageLength: parseInt(draftLength, 10) || 10, categoryCodes: draftChecked });
        setFilterOpen(false);
    };
    // Legacy Reset: length back to 10, clear the category search + checkboxes, then apply.
    const resetFilters = () => {
        setDraftLength('10');
        setCategorySearch('');
        setDraftChecked([]);
        setApplied({ pageLength: 10, categoryCodes: [] });
        setFilterOpen(false);
    };
    const clearCategoryFilter = () => {
        setCategorySearch('');
        setDraftChecked([]);
    };

    // Category-search inside the filter keeps checked entries visible (legacy behavior).
    const visibleCategories = useMemo(() => {
        const filter = categorySearch.trim().toLowerCase().split(' ').filter(Boolean).join(' ');
        return reference.categories.filter((c) => !filter
            || (c.description || '').toLowerCase().includes(filter)
            || draftChecked.includes(c.code));
    }, [reference.categories, categorySearch, draftChecked]);

    return (<div className="patient-documents-container" id={`patient_documents_hub_${patientId}`}>
      <div className="pc-patient-documents-group-nav-container mt-2">
        <ul className="nav nav-pills patient-documents-nav-pill p-1 d-inline-flex flex-wrap" role="tablist">
          {DOCUMENT_SUB_GROUPS.map((g) => (
            <li key={g.code} className="nav-item" role="presentation" data-section-type={g.code}>
              <button type="button" className={`nav-link patient-documents-nav-link ${subGroup === g.code ? 'active' : ''}`} onClick={() => setSubGroup(g.code)}>{g.label}</button>
            </li>
          ))}
        </ul>
      </div>

      <div className="pd-patient-documents-main-header container-fluid d-flex justify-content-end align-items-center gap-2 mt-2 px-0">
        <div className="position-relative">
          <input id={`pc_search_document_input_${patientId}`} type="text" className="form-control" placeholder="Search Documents" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)}/>
          <LegacyIcon icon="mdi-magnify" className="search-input-icon"/>
        </div>
        <button type="button" className="pd-patient-documents-filter-icon btn btn-default" onClick={() => setFilterOpen(true)}><LegacyIcon icon="fa-filter"/> Filter</button>
        <button type="button" className="pc-add-new-documents-btn btn btn-primary btn-md border-radius-button" onClick={() => setDialog({ type: 'addEdit', record: null })}>
          <LegacyIcon icon="mdi-plus"/> Add Documents
        </button>
      </div>

      <PatientDocumentsList patientId={patientId} subGroup={subGroup} search={searchTerm}
        categoryCodes={applied.categoryCodes} pageLength={applied.pageLength} refreshKey={refreshKey}
        categories={reference.categories}
        onEdit={(row) => setDialog({ type: 'addEdit', record: row })}
        onView={(row) => setDialog({ type: 'view', record: row })}/>

      {/* Filter offcanvas (legacy Bootstrap offcanvas-end) */}
      <Sidebar visible={filterOpen} position="right" onHide={() => setFilterOpen(false)} header="Filters" className="pc-documents-offcanvas-end">
        <div className="pc-patient-documents-filter-form d-flex flex-column" style={{ minHeight: '85vh' }}>
          <div className="mb-2">
            <label className="fw-bold" htmlFor={`pc_patient_ehr_documents_list_length_${patientId}`}>Show</label>
            <select id={`pc_patient_ehr_documents_list_length_${patientId}`} className="form-control form-select" value={draftLength} onChange={(e) => setDraftLength(e.target.value)}>
              <option value="10">10</option>
              <option value="25">25</option>
              <option value="50">50</option>
              <option value="100">100</option>
            </select>
          </div>
          <div className="pc-patient-document-category-filter-container flex-grow-1">
            <div className="form-group filter-search-underline m-0 mt-2 position-relative">
              <input type="text" id={`pc_patient_document_category_filter_search_${patientId}`} className="form-control" placeholder="Category" value={categorySearch} onChange={(e) => setCategorySearch(e.target.value)}/>
              <LegacyIcon icon="fa-magnifying-glass" className="position-absolute" style={{ right: 8, top: 10 }}/>
            </div>
            {(categorySearch || draftChecked.length > 0) && (
              <span className="float-end clear-filter" style={{ cursor: 'pointer', fontWeight: 'bold' }} onClick={clearCategoryFilter}>Clear</span>
            )}
            <div className="form-group pc-patient-document-category-filter-list mt-4">
              {visibleCategories.map((c) => (
                <label key={c.code} data-name={c.description}>
                  <input type="checkbox" className="filter-inputs" value={c.code} checked={draftChecked.includes(c.code)} onChange={(e) => toggleDraftCategory(c.code, e.target.checked)}/>
                  &nbsp;<span>{c.description}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="pc-patient-documents-filter-buttons d-flex justify-content-center gap-4 py-3">
            <button type="button" className="btn btn-default pc-documents-filter-cancel-button px-3" onClick={resetFilters}>Reset</button>
            <button type="button" className="btn btn-primary border-radius-button px-3" onClick={applyFilters}>Apply</button>
          </div>
        </div>
      </Sidebar>

      {/* Add / Edit */}
      <Dialog visible={dialog.type === 'addEdit'} onHide={() => closeDialog(false)} header={`${dialog.record ? 'Edit' : 'Add'} Documents`} style={{ width: '75vw' }} breakpoints={{ '768px': '98vw' }}>
        {dialog.type === 'addEdit' && (<PatientDocumentsAddEdit patientId={patientId} record={dialog.record}
          categories={reference.categories} statuses={reference.statuses} onClose={closeDialog}/>)}
      </Dialog>

      {/* View Docs */}
      <Dialog visible={dialog.type === 'view'} onHide={() => closeDialog(false)} header="View Documents" style={{ width: '75vw' }} breakpoints={{ '768px': '98vw' }}>
        {dialog.type === 'view' && (<PatientDocumentsView record={dialog.record} categories={reference.categories}/>)}
      </Dialog>
    </div>);
};
export default PatientDocuments;
