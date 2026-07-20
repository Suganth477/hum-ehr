import { useCallback, useEffect, useRef, useState } from 'react';
import { DataTable } from 'primereact/datatable';
import { Column } from 'primereact/column';
import { fetchPatientDocumentsList, deleteDocument } from '../../../services/documentsService';
import { SkeletonTable } from '../../../components/common/ContentLoader';
import { useNotify } from '../../../context/NotificationContext';
import { LegacyIcon } from '../../../components/common/CustomIcons';

const upperCaseEachWord = (text) => (text || '').replace(/\b\w/g, (c) => c.toUpperCase());

/**
 * Server-side paginated documents table (legacy DataTables config: paging via
 * draw/start/length, search + sub-group tab + category filter passed through, and a
 * dots-vertical action menu per row with Edit / Delete / View Docs).
 */
const PatientDocumentsList = ({ patientId, subGroup, search, categoryCodes, pageLength, refreshKey, categories, onEdit, onView }) => {
    const [rows, setRows] = useState(null); // null = fetching (skeleton)
    const [totalRecords, setTotalRecords] = useState(0);
    const [first, setFirst] = useState(0);
    const [menuRowId, setMenuRowId] = useState(null);
    const drawRef = useRef(1);
    const rowsRef = useRef([]);
    rowsRef.current = rows || [];
    const { notifyError, notifySuccess } = useNotify();

    const categoryDescription = useCallback((code) => {
        const match = (categories || []).find((c) => c.code === code);
        return match ? match.description : (code || '');
    }, [categories]);

    const load = useCallback(async (startAt) => {
        setRows(null);
        try {
            drawRef.current += 1;
            const { rows: data, totalRecords: total } = await fetchPatientDocumentsList({
                patientId, draw: drawRef.current, start: startAt, length: pageLength,
                search, categoryCodes, subGroupCode: subGroup,
            });
            setRows(data);
            setTotalRecords(total);
        }
        catch (error) {
            console.error('Failed to fetch patient documents list.', error);
            setRows([]);
            setTotalRecords(0);
            notifyError(error?.message || 'Failed to fetch the patient documents list.');
        }
    }, [patientId, subGroup, search, categoryCodes, pageLength, notifyError]);

    // Any filter/search/tab change resets to the first page (legacy redraw behavior).
    useEffect(() => {
        setFirst(0);
        const timer = window.setTimeout(() => { load(0); }, 350);
        return () => window.clearTimeout(timer);
    }, [load, refreshKey]);

    const onPage = (event) => {
        setFirst(event.first);
        load(event.first);
    };

    const handleDelete = async (row) => {
        if (!window.confirm('Are you sure about deleting the Patient document?')) return;
        try {
            const response = await deleteDocument(row.docId);
            if (response?.status === 'success') {
                notifySuccess('Document Deleted SuccessFully');
                load(firstRef.current);
            }
            else notifyError(typeof response?.data === 'string' ? response.data : 'Failed to delete document');
        }
        catch (error) {
            console.error('Failed to delete document.', error);
            notifyError(error?.message || 'Failed to delete document');
        }
    };

    // Keep the latest callbacks reachable from the stable native listener below.
    const firstRef = useRef(first);
    firstRef.current = first;
    const actionsRef = useRef({ onEdit, onView, handleDelete });
    actionsRef.current = { onEdit, onView, handleDelete };

    // The per-row actions are driven by ONE native delegated click listener: React's
    // synthetic click dispatch does not fire for elements rendered inside this
    // DataTable's body cells (PrimeReact 10 + React 19 interop quirk), while native
    // events work — so the menu toggle/actions use data-* attributes handled here.
    // Any click without a data-doc-action also closes an open menu (outside-click).
    useEffect(() => {
        // The menu is rendered OUTSIDE the table (fixed-position, anchored to the clicked
        // button) because PrimeReact memoizes body cells — in-cell dynamic markup and
        // React synthetic handlers inside cells do not update/fire reliably. One native
        // delegated listener drives toggle / actions / outside-close via data-* attributes.
        const onDocClick = (event) => {
            const actionEl = event.target.closest ? event.target.closest('[data-doc-action]') : null;
            if (!actionEl) { setMenuRowId(null); return; }
            const action = actionEl.getAttribute('data-doc-action');
            const docId = actionEl.getAttribute('data-doc-id');
            const row = rowsRef.current.find((r) => String(r.docId) === String(docId));
            if (action === 'toggle') {
                const rect = actionEl.getBoundingClientRect();
                setMenuRowId((current) => (current && String(current.docId) === String(docId)
                    ? null
                    : (row ? { docId: row.docId, top: rect.bottom + 2, left: Math.max(8, rect.right - 195) } : null)));
                return;
            }
            setMenuRowId(null);
            if (!row) return;
            if (action === 'edit') actionsRef.current.onEdit?.(row);
            else if (action === 'view') actionsRef.current.onView?.(row);
            else if (action === 'delete') actionsRef.current.handleDelete?.(row);
        };
        const onScroll = () => setMenuRowId(null);
        document.addEventListener('click', onDocClick);
        window.addEventListener('scroll', onScroll, true);
        return () => {
            document.removeEventListener('click', onDocClick);
            window.removeEventListener('scroll', onScroll, true);
        };
    }, []);

    const actionsBody = (row) => (
        <button type="button" className="btn btn-link p-0 pc-documents-action-icon" title="Actions" data-doc-action="toggle" data-doc-id={row.docId}>
          <LegacyIcon icon="mdi-dots-vertical" className="action-group-icon"/>
        </button>
    );

    if (rows === null) {
        return (<div className="pd-patient-documents-list-body mt-2">
          <SkeletonTable columns={['S.No', 'Category', 'Title', 'Description', 'Recorded Date & Time', '']} rows={5}/>
        </div>);
    }

    return (<div className="pd-patient-documents-list-body mt-2">
      <DataTable value={rows} lazy paginator first={first} rows={pageLength} totalRecords={totalRecords}
        onPage={onPage} dataKey="docId" size="small" stripedRows
        emptyMessage="No documents found." className="pc-patient-ehr-documents-table border">
        <Column field="sno" header="S.No" style={{ width: '70px' }} body={(row) => <div className="table-data">{row.sno}</div>}/>
        <Column field="documentCategoryCode" header="Category" body={(row) => <div className="table-data">{upperCaseEachWord(categoryDescription(row.documentCategoryCode))}</div>}/>
        <Column field="documentTitle" header="Title" body={(row) => <div className="table-data">{row.documentTitle}</div>}/>
        <Column field="documentDescription" header="Description" body={(row) => <div className="table-data">{row.documentDescription}</div>}/>
        <Column field="recordeddate" header="Recorded Date & Time" body={(row) => <div className="table-data">{row.recordeddate}</div>}/>
        <Column header="" style={{ width: '60px' }} body={actionsBody}/>
      </DataTable>

      {/* Floating row-action menu (legacy dots-vertical dropdown) — rendered outside the
          memoized table cells, positioned at the clicked button. */}
      {menuRowId && (
        <ul className="pc-documents-action-menu" style={{ position: 'fixed', top: menuRowId.top, left: menuRowId.left }}>
          <li><div className="ehr-patient-documents-list-icons ehr-patient-documents-edit-icon" data-doc-action="edit" data-doc-id={menuRowId.docId}><span><LegacyIcon icon="fa-pen"/></span> Edit</div></li>
          <li><div className="ehr-patient-documents-list-icons ehr-patient-documents-delete-icon" data-doc-action="delete" data-doc-id={menuRowId.docId}><span><LegacyIcon icon="fa-trash-can"/></span> Delete</div></li>
          <li><div className="ehr-patient-documents-list-icons ehr-patient-documents-view-docs-icon" data-doc-action="view" data-doc-id={menuRowId.docId}><span><LegacyIcon icon="fa-address-card"/></span> View Docs</div></li>
        </ul>
      )}
    </div>);
};
export default PatientDocumentsList;
