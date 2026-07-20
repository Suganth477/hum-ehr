import { useEffect, useMemo, useState } from 'react';
import { fetchDocumentFiles } from '../../../services/documentsService';
import { SkeletonViewDetails } from '../../../components/common/ContentLoader';
import { useNotify } from '../../../context/NotificationContext';
import { LegacyIcon } from '../../../components/common/CustomIcons';

// Mirrors convertIntoBase64AndShowPdfInModal's format switch (default = pdf).
const mimeFor = (fileFormat) => {
    switch ((fileFormat || '').toLowerCase()) {
        case 'png': return 'image/png';
        case 'jpeg': return 'image/jpeg';
        case 'jpg': return 'image/jpg';
        case 'pdf':
        default: return 'application/pdf';
    }
};
const base64ToBlobUrl = (base64, type) => {
    try {
        const bytes = atob(base64);
        const arr = new Uint8Array(bytes.length);
        for (let i = 0; i < bytes.length; i += 1) arr[i] = bytes.charCodeAt(i);
        return URL.createObjectURL(new Blob([arr], { type }));
    } catch { return ''; }
};

/**
 * View Documents dialog (legacy PatientEhrDocumentsViewDocuments): header with
 * Category / Title / Recorded date, a left nav of file-name pills (truncated at 22
 * chars), and the selected file rendered as a PDF iframe (#toolbar=0) or an image.
 */
const PatientDocumentsView = ({ record, categories }) => {
    const [files, setFiles] = useState(null); // null = fetching (skeleton)
    const [activeId, setActiveId] = useState(null);
    const { notifyError } = useNotify();

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const response = await fetchDocumentFiles(record.docId);
                if (ignore) return;
                const list = response?.status === 'success' && Array.isArray(response.data) ? response.data : [];
                setFiles(list);
                if (list.length) setActiveId(list[0].documentDetailId); // legacy auto-clicks the first file
            }
            catch (error) {
                console.error('Failed to get the document files.', error);
                if (!ignore) setFiles([]);
                notifyError(error?.message || 'failed to get the document files');
            }
        })();
        return () => { ignore = true; };
    }, [record, notifyError]);

    // Build (and clean up) one blob URL per file.
    const blobUrls = useMemo(() => {
        const map = {};
        (files || []).forEach((f) => { map[f.documentDetailId] = { url: base64ToBlobUrl(f.fileData, mimeFor(f.fileFormat)), isPdf: mimeFor(f.fileFormat) === 'application/pdf' }; });
        return map;
    }, [files]);
    useEffect(() => () => { Object.values(blobUrls).forEach((b) => { if (b.url) URL.revokeObjectURL(b.url); }); }, [blobUrls]);

    const categoryDescription = (code) => (categories || []).find((c) => c.code === code)?.description || code || '-';
    const active = blobUrls[activeId];

    return (<div className="pc-patient-document-view-wrapper">
      <div className="row p-0 m-0 pc-patient-document-view-header">
        <div className="col-md-4"><label>Category</label><div className="fw-bold">{categoryDescription(record.documentCategoryCode)}</div></div>
        <div className="col-md-4"><label>Title</label><div className="fw-bold">{record.documentTitle}</div></div>
        <div className="col-md-4"><label>Recorded date</label><div className="fw-bold">{record.recordeddate}</div></div>
      </div>

      {files === null ? (<SkeletonViewDetails rows={2} cols={3}/>) : (
        <div className="row p-0 py-3 m-0 pc-patient-documents-view-document-section">
          {files.length > 0 ? (<>
            <div className="col-md-3 pc-patient-document-document-nav-list-wrapper">
              <ul className="nav nav-pills pc-patient-documents-view-doc-nav flex-column" role="tablist">
                {files.map((f) => (
                  <li key={f.documentDetailId} className="nav-item pc-patient-document-tab-nav-item" style={{ width: '100%' }}>
                    <button type="button" title={f.fileName}
                      className={`pc-patient-document-nav-buttons ${String(activeId) === String(f.documentDetailId) ? 'active' : ''}`}
                      onClick={() => setActiveId(f.documentDetailId)}>
                      {f.fileName.length < 25 ? f.fileName : `${f.fileName.slice(0, 22)}...`}
                    </button>
                  </li>
                ))}
              </ul>
            </div>
            <div className="col-md-9 pc-patient-document-document-doc-viewer">
              {active?.url ? (active.isPdf
                ? <iframe title="document" src={`${active.url}#toolbar=0`} width="100%" height="550px"/>
                : <img alt="document" style={{ display: 'block', width: '100%' }} src={active.url}/>) : null}
            </div>
          </>) : (
            <div className="col-md-12 pc-patient-documents-no-documents">
              <div className="border-section m-5 p-5 text-center">
                <div className="row"><div className="no-data-icon text-center"><LegacyIcon icon="fa-circle-exclamation"/></div></div>
                No Documents Uploaded.
              </div>
            </div>
          )}
        </div>
      )}
    </div>);
};
export default PatientDocumentsView;
