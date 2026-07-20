import { useEffect, useRef, useState } from 'react';
import moment from '../../../utils/dayjs';
import {
    buildDocumentSavePayload, fetchDocumentFiles, saveDocument,
} from '../../../services/documentsService';
import { fetchPatientDetails } from '../../../services/patientService';
import patientCache from '../../../utils/patientCache';
import { getSaveOutcome } from '../../../utils/saveResponse';
import FlatpickrDateTimeInput from '../../../components/common/FlatpickrDateTimeInput';
import UniversalFileUploader from '../../../components/common/UniversalFileUploader';
import { SkeletonList } from '../../../components/common/ContentLoader';
import { useNotify } from '../../../context/NotificationContext';
import { LegacyIcon } from '../../../components/common/CustomIcons';

const nowDateTime = () => moment().format('MM-DD-YYYY hh:mm A');
const FieldError = ({ message }) => (message ? <div className="small text-danger mt-1">{message}</div> : null);

/**
 * Documents add/edit form (legacy PatientEhrDocumentsAddEdit). Title (required, max 100),
 * Category, Recorded Date & Time (required, DOB..now, defaults to now), Description
 * (max 1000), Document Status (DOCERRIN hidden), and the file part via the shared
 * Universal File Uploader (pdf/jpg/jpeg/png, max 5 files, 5MB each, at least one file).
 * Save sends deleted existing files (raw objects) + new files; untouched files are omitted.
 */
const PatientDocumentsAddEdit = ({ patientId, record, categories, statuses, onClose }) => {
    const isEdit = !!record?.docId;
    const { notifyError, notifySuccess } = useNotify();
    const uploaderRef = useRef(null);
    const existingFilesRef = useRef([]); // raw getPatientDocumentsById objects, for the delete contract

    const [form, setForm] = useState(() => ({
        documentTitle: record?.documentTitle || '',
        documentCategoryCode: record?.documentCategoryCode || (categories[0]?.code ?? ''),
        recordedDate: record?.recordeddate || nowDateTime(),
        documentDescription: record?.documentDescription || '',
        statusCode: record?.statusCode || (statuses[0]?.code ?? ''),
    }));
    const [initialAttachments, setInitialAttachments] = useState(null); // edit: null = files fetching (skeleton)
    const [dob, setDob] = useState('');
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState(null);

    // Recorded-date bounds: patient DOB .. now (legacy initTDDatePicker range).
    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                let details = patientCache.get(`${patientId}_details`);
                if (!details) {
                    const response = await fetchPatientDetails(patientId);
                    details = response?.status === 'success' ? response.data?.patientDetails : null;
                }
                if (!ignore && details?.dateOfBirth) setDob(`${details.dateOfBirth} 12:00 AM`);
            }
            catch (error) { console.error('Failed to load patient details for date bounds.', error); }
        })();
        return () => { ignore = true; };
    }, [patientId]);

    // Edit: load the existing files and seed the uploader (legacy shows a loader meanwhile).
    useEffect(() => {
        if (!isEdit) return undefined;
        let ignore = false;
        (async () => {
            try {
                const response = await fetchDocumentFiles(record.docId);
                if (ignore) return;
                const files = response?.status === 'success' && Array.isArray(response.data) ? response.data : [];
                existingFilesRef.current = files;
                setInitialAttachments(files.map((f) => ({
                    attachmentId: f.documentDetailId,
                    fileName: f.fileName,
                    fileFormat: f.fileFormat,
                    fileSize: f.fileSize ?? 0,
                    file: f.fileData || f.file || null,
                })));
            }
            catch (error) {
                console.error('Failed to get the document files.', error);
                if (!ignore) setInitialAttachments([]);
                notifyError(error?.message || 'failed to get the document files');
            }
        })();
        return () => { ignore = true; };
    }, [isEdit, record, notifyError]);

    const update = (patch) => setForm((p) => ({ ...p, ...patch }));
    const clearError = (key) => setErrors((prev) => { if (!prev[key]) return prev; const n = { ...prev }; delete n[key]; return n; });

    const validate = (payloadFiles) => {
        const next = {};
        if (!form.documentTitle.trim()) next.documentTitle = 'Title is required.';
        else if (form.documentTitle.length > 100) next.documentTitle = 'Maximum 100 characters.';
        if (!form.recordedDate) next.recordedDate = 'Recorded Date is required.';
        if (form.documentDescription.length > 1000) next.documentDescription = 'Maximum 1000 characters.';
        if ((payloadFiles.newFiles.length + payloadFiles.existingFiles.length) === 0) next.files = 'Atleast One File is required.';
        return next;
    };

    const handleSave = async () => {
        setSaveError(null);
        const payloadFiles = uploaderRef.current
            ? uploaderRef.current.getUpdatePayload()
            : { newFiles: [], existingFiles: [], deletedFiles: [] };
        const v = validate(payloadFiles);
        setErrors(v);
        if (Object.keys(v).length) return;
        setSaving(true);
        try {
            // Deleted entries are sent as the RAW objects returned by getPatientDocumentsById.
            const deletedIds = payloadFiles.deletedFiles.map((d) => d.attachmentId);
            const deletedRaw = existingFilesRef.current.filter((f) => deletedIds.includes(f.documentDetailId));
            const payload = buildDocumentSavePayload({
                docId: record?.docId, patientId,
                documentTitle: form.documentTitle,
                documentCategoryCode: form.documentCategoryCode,
                documentDescription: form.documentDescription,
                recordedDate: form.recordedDate,
                statusCode: form.statusCode,
                deletedFiles: deletedRaw,
                newFiles: payloadFiles.newFiles,
            });
            const response = await saveDocument(payload);
            const outcome = getSaveOutcome(response, 'Failed to save the patient document. Please try again.');
            if (outcome.ok) { notifySuccess(`Document ${isEdit ? 'updated' : 'saved'} successfully.`); onClose(true); return; }
            setSaveError(outcome);
        }
        catch (error) {
            console.error('Failed to save the patient document.', error);
            setSaveError({ tone: 'error', message: error?.message || 'Failed to save the patient document. Please try again.' });
        }
        finally { setSaving(false); }
    };

    return (<form className="pc-patient-documents-add-edit-form" id={`pc_patient_documents_add_edit_form_${patientId}`} autoComplete="off" onSubmit={(e) => { e.preventDefault(); handleSave(); }} noValidate>
      <div className="row g-3">
        <div className="col-md-4">
          <label className="form-label fw-bold" htmlFor="pc_patient_ehr_document_title">Title <span className="text-danger">*</span></label>
          <input type="text" id="pc_patient_ehr_document_title" className="form-control" maxLength={100} value={form.documentTitle}
            onChange={(e) => { update({ documentTitle: e.target.value }); clearError('documentTitle'); }}/>
          <FieldError message={errors.documentTitle}/>
        </div>
        <div className="col-md-4">
          <label className="form-label fw-bold" htmlFor="pc_patient_ehr_document_category">Category</label>
          <select id="pc_patient_ehr_document_category" className="form-select form-control" value={form.documentCategoryCode} onChange={(e) => update({ documentCategoryCode: e.target.value })}>
            {categories.map((c) => <option key={c.code} value={c.code}>{c.description}</option>)}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label fw-bold" htmlFor="pc_patient_ehr_document_record_date">Recorded Date &amp; Time <span className="text-danger">*</span></label>
          <FlatpickrDateTimeInput id="pc_patient_ehr_document_record_date" value={form.recordedDate}
            enableTime dateFormat="m-d-Y h:i K" placeholder="MM-DD-YYYY HH:MM AM/PM"
            minDate={dob || undefined} maxDate={nowDateTime()}
            onChange={(v) => { update({ recordedDate: v }); clearError('recordedDate'); }}/>
          <FieldError message={errors.recordedDate}/>
        </div>
      </div>
      <div className="row g-3 mt-1">
        <div className="col-md-4">
          <label className="form-label fw-bold" htmlFor="pc_patient_ehr_document_description">Description</label>
          <textarea id="pc_patient_ehr_document_description" className="form-control" style={{ minHeight: 80 }} maxLength={1000} value={form.documentDescription}
            onChange={(e) => { update({ documentDescription: e.target.value }); clearError('documentDescription'); }}/>
          <FieldError message={errors.documentDescription}/>
        </div>
        <div className="col-md-4">
          <label className="form-label fw-bold" htmlFor="pc_patient_ehr_document_status">Document Status</label>
          <select id="pc_patient_ehr_document_status" className="form-select form-control" value={form.statusCode} onChange={(e) => update({ statusCode: e.target.value })}>
            {/* DOCERRIN stays in the list but is hidden — legacy keeps the option with class "hide". */}
            {statuses.map((s) => <option key={s.code} value={s.code} hidden={s.code === 'DOCERRIN'}>{s.description}</option>)}
          </select>
        </div>
        <div className="col-md-4">
          <label className="form-label fw-bold d-block">Upload Documents <span className="text-danger">*</span>
            <span className="float-end" title="You can upload up to 5 documents, each less than 5MB."><LegacyIcon icon="fa-circle-info"/></span>
          </label>
          {isEdit && initialAttachments === null
            ? <SkeletonList rows={2}/>
            : <UniversalFileUploader ref={uploaderRef} name={`pc_patient_ehr_document_files_${patientId}`}
                maxFiles={5} maxSizeMB={5} allowedTypes="pdf,jpg,jpeg,png"
                initialAttachments={initialAttachments} onChange={() => clearError('files')}/>}
          <FieldError message={errors.files}/>
        </div>
      </div>

      {saveError && (<div className={`mt-3 small ${saveError.tone === 'warning' ? 'text-warning' : 'text-danger'}`}><LegacyIcon icon="fa-exclamation-triangle" className="me-1"/>{saveError.message}</div>)}

      <div className="d-flex justify-content-end gap-2 mt-4 pt-3 border-top">
        <button type="button" className="btn btn-secondary px-4 rounded-pill bs-modal-cancel-btn" onClick={() => onClose(false)} disabled={saving}>Cancel</button>
        <button type="submit" className="btn btn-primary px-4 rounded-pill bs-modal-save-btn" disabled={saving || (isEdit && initialAttachments === null)}>{saving ? 'Saving...' : 'Save'}</button>
      </div>
    </form>);
};
export default PatientDocumentsAddEdit;
