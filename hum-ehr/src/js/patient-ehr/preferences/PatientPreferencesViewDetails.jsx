import { useState } from 'react';
import {
    PREFERENCES_DESC_MAP, fetchPreferenceAttachmentFile, fetchLinkedAdvanceDirectiveDocs,
} from '../../../services/preferencesService';
import '../../../components/common/ContentLoader.css';
import { useNotify } from '../../../context/NotificationContext';
import { LegacyIcon } from '../../../components/common/CustomIcons';

const NOTES_MAX = 200;

const openBase64 = (base64, fileName, fileFormat) => {
    if (!base64) return false;
    const typeMap = { pdf: 'application/pdf', jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
    const type = typeMap[(fileFormat || '').toLowerCase()] || 'application/octet-stream';
    try {
        const bytes = atob(base64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i);
        const url = URL.createObjectURL(new Blob([arr], { type }));
        const downloadFormats = ['doc', 'docx', 'xls', 'xlsx', 'csv', 'xml'];
        if (downloadFormats.includes((fileFormat || '').toLowerCase())) {
            const a = document.createElement('a'); a.href = url; a.download = fileName || 'file'; document.body.appendChild(a); a.click(); a.remove();
        } else window.open(url, '_blank');
        return true;
    } catch { return false; }
};

/**
 * Right-pane preference detail view (legacy pc_patient_chart_preferences_show_details_template):
 * title (+ deleted badge), care-preferences/notes (View More), linked advance directives,
 * uploaded documents, then Preferences Status / Validating Provider / Effective & Last-Effective
 * Date & Time, Recorded Date & Time and the deleted-reason row. Edit is available on active,
 * non-deleted records.
 */
const PatientPreferencesViewDetails = ({ recordType, preferencesType, record, lookups, onEdit }) => {
    const [expanded, setExpanded] = useState(false);
    const [linkedDocs, setLinkedDocs] = useState({}); // adId → { open, files, loading }
    const { notifyError } = useNotify();

    if (!record)
        return (<div className="preferences-details-main-container show-details-main-container list-wrapper my-5" style={{ padding: '30px 20px', textAlign: 'center' }}>
          <div className="nodata"><LegacyIcon icon="mdi-information-outline" style={{ fontSize: 30, verticalAlign: 'sub' }}/><span style={{ fontSize: 20 }}> No preferences recorded.</span></div>
        </div>);

    const lookupItem = (lookups || []).find((l) => l.code === record.code);
    const title = lookupItem ? lookupItem.label : (record.description || record.code || 'Preference');
    // Legacy: advance-directives label the notes field "Description"; the others use the type name.
    const notesLabel = preferencesType === 'advance-directives' ? 'Description' : PREFERENCES_DESC_MAP[preferencesType];
    const notes = record.notes || '';
    const notesTooLong = notes.length > NOTES_MAX;
    const notesText = notesTooLong && !expanded ? notes.slice(0, NOTES_MAX) : (notes || '-');
    const isDeleted = record.invalidFlag === 'Y';
    const canEdit = recordType === 'active';

    const viewAttachment = async (att) => {
        const inline = att.fileData || att.file || att.encodedData || att.data;
        if (inline && openBase64(inline, att.fileName, att.fileFormat)) return;
        if (!att.attachmentId) { notifyError('Attachment data is empty.'); return; }
        try {
            const response = await fetchPreferenceAttachmentFile(att.attachmentId);
            const detail = response?.status === 'success' && Array.isArray(response.data) && response.data.length ? response.data[0] : null;
            const data = detail ? (detail.fileData || detail.file) : null;
            if (!data || !openBase64(data, att.fileName || detail.fileName, att.fileFormat || detail.fileFormat)) notifyError('Failed to load attachment.');
        }
        catch (error) { console.error('Failed to load attachment.', error); notifyError('Failed to load attachment.'); }
    };

    const toggleLinkedDocs = async (ad) => {
        const existing = linkedDocs[ad.id];
        if (existing?.open) { setLinkedDocs((s) => ({ ...s, [ad.id]: { ...existing, open: false } })); return; }
        setLinkedDocs((s) => ({ ...s, [ad.id]: { open: true, loading: true, files: [] } }));
        try {
            const response = await fetchLinkedAdvanceDirectiveDocs(ad.id);
            const files = response?.status === 'success' && Array.isArray(response.data) ? response.data : [];
            setLinkedDocs((s) => ({ ...s, [ad.id]: { open: true, loading: false, files } }));
        }
        catch (error) { console.error('Failed to load documents.', error); setLinkedDocs((s) => ({ ...s, [ad.id]: { open: true, loading: false, files: [] } })); }
    };

    return (<div className="preferences-details-main-container show-details-main-container">
      <div className="row mx-3 my-3 mb-3">
        <div className="col-md-11 view-preferences-name fw-bold patient-chart-list-selected-item-title text-capitalize">
          {title}
          {isDeleted && <span className="ehr-deleted-records ms-2">Deleted Record</span>}
        </div>
        <div className="col-md-1 d-flex justify-content-end gap-2 preferences-action-container">
          {canEdit && !isDeleted && <LegacyIcon icon="mdi-pencil" className="edit-preferences-icon" role="button" title={`Edit ${PREFERENCES_DESC_MAP[preferencesType] || 'Preference'}`} onClick={() => onEdit(record)}/>}
        </div>
      </div>

      <div className="show-details-data-container custom-scrollbar">
        <div className="row mx-3 my-4">
          <div className="col-md-11">
            <div className="label">{notesLabel}</div>
            <div className="view-care-preferences fw-bold" style={{ wordBreak: 'break-word' }}>{notesText}
              {notesTooLong && <span className="view-more-care-preferences-btn ms-1" role="button" style={{ color: 'var(--app-color2)', cursor: 'pointer', fontWeight: 600, fontSize: 13 }} onClick={() => setExpanded((v) => !v)}>{expanded ? ' View Less' : '...View More'}</span>}
            </div>
          </div>
        </div>

        {preferencesType === 'treatment-preferences' && Array.isArray(record.advanceDirectives) && record.advanceDirectives.length > 0 && (
          <div className="row mx-3 my-4 pc-patient-preferences-view-linked-ad-row">
            <div className="col-md-10 form-group">
              <div className="label fw-bold">Linked Advance Directives</div>
              <div className="row mt-2 border rounded py-2 px-2">
                {record.advanceDirectives.map((ad) => (
                  <div key={ad.id} className="mb-2 border rounded p-2">
                    <span>{ad.description || ad.code} ({ad.attachmentCount || 0} doc(s))</span>
                    {ad.attachmentCount > 0 && <a href="#" className="ms-2 text-decoration-underline click-to-view-documents" onClick={(e) => { e.preventDefault(); toggleLinkedDocs(ad); }}>{linkedDocs[ad.id]?.open ? 'Hide documents' : 'Click to view documents'}</a>}
                    {linkedDocs[ad.id]?.open && (<div className="border rounded mt-2 px-2 pt-2">
                      {linkedDocs[ad.id].loading ? <div className="cl-skeleton-bar mb-2" style={{ width: '60%' }}/>
                        : (linkedDocs[ad.id].files.length ? linkedDocs[ad.id].files.map((f, i) => (
                            <div key={f.attachmentId || i} className="small mb-1"><span className="pc-patient-view-preferences-report" role="button" onClick={() => viewAttachment(f)}>{f.fileName}</span></div>
                          )) : <div className="text-muted small">No documents found</div>)}
                    </div>)}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {Array.isArray(record.attachment) && record.attachment.length > 0 && (
          <div className="row mx-3 my-4 pc-patient-preferences-view-attachments-row">
            <div className="col-md-12">
              <div className="label">Uploaded Documents</div>
              <div className="pc-patient-preferences-view-attachments-container mt-2 col-md-8 p-2">
                {record.attachment.map((att, i) => (
                  <div key={att.attachmentId || i} className="pc-patient-preferences-each-file-container mb-1">
                    <span className="pc-patient-view-preferences-report pc-patient-view-upload-report" role="button" onClick={() => viewAttachment(att)}>
                      <LegacyIcon icon={((att.fileFormat || '').toLowerCase() === 'pdf') ? 'fa-file-pdf' : 'fa-file-lines'} className="me-1"/>{att.fileName}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        <div className="row mx-3 my-4">
          <div className="col-md-3"><div className="label">Preferences Status</div><div className="view-preferences-status fw-bold text-capitalize">{record.statusCodeDesc || '-'}</div></div>
          <div className="col-md-3"><div className="label">Validating Provider</div><div className="view-validating-provider fw-bold text-capitalize">{record.validatingUserName || '-'}</div></div>
          <div className="col-md-3"><div className="label">Effective Date &amp; Time</div><div className="view-effective-date fw-bold">{record.effectiveDate || '-'}</div></div>
          <div className="col-md-3"><div className="label">Last Effective Date &amp; Time</div><div className="view-last-effective-date fw-bold">{record.lastEffectiveDate || '-'}</div></div>
        </div>
        <div className="row mx-3 my-4">
          <div className="col-md-3"><div className="label">Recorded Date &amp; Time</div><div className="view-preferences-recorded-date-and-time fw-bold">{record.recordedDate || '-'}</div></div>
          {isDeleted && (<div className="col-md-6 mb-3 view-preferences-deleted-reason-container">
              <div className="label">Deleted Reason</div>
              <div className="view-preferences-deleted-reason fw-bold" style={{ overflowWrap: 'break-word', wordBreak: 'break-word' }}>{record.deleteReason || '-'}</div>
            </div>)}
        </div>
      </div>
    </div>);
};
export default PatientPreferencesViewDetails;
