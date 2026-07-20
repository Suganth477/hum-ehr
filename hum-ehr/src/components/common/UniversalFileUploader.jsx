import { forwardRef, useEffect, useImperativeHandle, useRef, useState } from 'react';
import { FolderUploadIcon, LegacyIcon } from './CustomIcons';
import './UniversalFileUploader.css';

/**
 * Reusable file uploader — the React port of the legacy <universal-file-uploader>
 * custom element (universal.file.uploader.js). Drag-drop / click to add files, with
 * the same validation rules (empty / extension / size / duplicate / count), base64
 * staging, chips, and server-attachment load + delete tracking.
 *
 * Imperative API (via ref): getUpdatePayload(), getNativeFiles(), isValid(), reset().
 * Server attachments are seeded via the `initialAttachments` prop; `onViewServer` is
 * called when a persisted (server) attachment's view/download is clicked.
 */
const MIME_ACCEPT_MAP = { pdf: 'application/pdf', xml: 'text/xml,application/xml', png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', doc: 'application/msword', docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' };
const DOWNLOAD_FORMATS = ['doc', 'docx', 'xls', 'xlsx', 'ppt', 'pptx', 'csv', 'xml'];

const blobType = (fmt) => {
    switch ((fmt || '').toLowerCase()) {
        case 'jpeg': case 'jpg': case 'png': return 'image/jpeg';
        case 'pdf': return 'application/pdf';
        case 'doc': return 'application/msword';
        case 'docx': return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
        default: return '';
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
// File-type icon: PrimeIcons where an exact glyph exists (pdf/word/excel/image),
// custom SVGs reproducing the original FontAwesome glyphs for the rest.
const FileTypeIcon = ({ fmt, className = '', style }) => {
    const f = (fmt || '').toLowerCase();
    if (f === 'pdf') return <LegacyIcon icon="fa-file-pdf" className={className} style={style} />;
    if (['doc', 'docx'].includes(f)) return <LegacyIcon icon="fa-file-word" className={className} style={style} />;
    if (['xls', 'xlsx', 'csv'].includes(f)) return <LegacyIcon icon="fa-file-excel" className={className} style={style} />;
    if (['png', 'jpg', 'jpeg', 'gif', 'svg'].includes(f)) return <LegacyIcon icon="fa-file-image" className={className} style={style} />;
    if (['ppt', 'pptx'].includes(f)) return <LegacyIcon icon="fa-file-powerpoint" className={className} style={style} />;
    if (['xml', 'html', 'json'].includes(f)) return <LegacyIcon icon="fa-file-code" className={className} style={style} />;
    if (['zip', 'rar', '7z'].includes(f)) return <LegacyIcon icon="fa-file-archive" className={className} style={style} />;
    return <LegacyIcon icon="fa-file-lines" className={className} style={style} />;
};
const attachmentType = () => 'DOCU';

const UniversalFileUploader = forwardRef(({
    name = 'file_payload', maxFiles = 5, maxSizeMB = 5, allowedTypes = 'jpg,jpeg,png,pdf,xml',
    required = false, inBaseApp = 'N', initialAttachments = null, onViewServer, onChange,
}, ref) => {
    const allowedExtensions = (allowedTypes || '').toLowerCase().split(',').map((s) => s.trim()).filter(Boolean);
    const [files, setFiles] = useState([]);
    const [deleted, setDeleted] = useState([]);
    const [error, setError] = useState('');
    const [dragging, setDragging] = useState(false);
    const inputRef = useRef(null);
    const filesRef = useRef(files);
    filesRef.current = files;
    const deletedRef = useRef(deleted);
    deletedRef.current = deleted;
    const seededRef = useRef(false);

    // Seed persisted server attachments once (mirrors loadServerAttachments).
    useEffect(() => {
        if (seededRef.current || !Array.isArray(initialAttachments) || !initialAttachments.length) return;
        seededRef.current = true;
        const seeded = initialAttachments.map((att) => {
            const fmt = (att.fileFormat || att.fileExtension || '').toLowerCase().replace('application/', '');
            const kb = att.fileSize != null ? parseInt(att.fileSize, 10) : (att.attachmentSize != null ? parseInt(att.attachmentSize, 10) : 0);
            return { attachmentId: att.attachmentId, fileName: att.fileName, attachmentSize: kb, fileSize: kb, fileFormat: fmt, displaySizeKb: Number(kb).toFixed(2), file: att.file || att.fileData || null, isServer: true };
        });
        setFiles(seeded);
    }, [initialAttachments]);

    useImperativeHandle(ref, () => ({
        getUpdatePayload: () => {
            const newFiles = []; const existingFiles = [];
            filesRef.current.forEach((f) => {
                const node = { attachmentId: f.attachmentId, fileName: f.fileName, attachmentSize: f.attachmentSize, fileSize: f.fileSize, fileFormat: f.fileFormat, file: f.encoded || f.file, fileData: f.encoded || f.file, attachmentTypeCode: attachmentType() };
                if (f.attachmentId) existingFiles.push(node); else newFiles.push(node);
            });
            return { newFiles, existingFiles, deletedFiles: [...deletedRef.current] };
        },
        getNativeFiles: () => filesRef.current.filter((f) => f.rawFile instanceof File).map((f) => f.rawFile),
        isValid: () => {
            if (required && filesRef.current.length === 0) {
                setError(`Please select a valid ${allowedExtensions.map((e) => e.toUpperCase()).join(', ')} file to import before proceeding.`);
                return false;
            }
            setError('');
            return true;
        },
        reset: () => { setFiles([]); setDeleted([]); setError(''); },
    }));

    const notifyChange = () => { if (onChange) window.setTimeout(onChange, 0); };

    const processIncoming = (incoming) => {
        setError('');
        const current = filesRef.current.length;
        if (current + incoming.length > maxFiles) { setError(`File limit exceeded. Only ${maxFiles} files are allowed.`); return; }
        const errs = [];
        incoming.forEach((file) => {
            const ext = file.name.split('.').pop().toLowerCase();
            const sizeMb = file.size / (1024 * 1024);
            if (file.size === 0) { errs.push(`File "${file.name}" was not uploaded because it is empty. Please upload a valid file.`); return; }
            if (!allowedExtensions.includes(ext)) { errs.push(`File "${file.name}" was not uploaded because it must be a ${allowedExtensions.map((e) => e.toUpperCase()).join(', ')} file.`); return; }
            if (sizeMb > maxSizeMB) { errs.push(`File "${file.name}" was not uploaded because it exceeds the ${maxSizeMB} MB size limit.`); return; }
            const kb = Math.floor(file.size / 1024);
            if (filesRef.current.some((e) => e.fileName === file.name && e.attachmentSize === kb)) { errs.push(`File "${file.name}" is already added.`); return; }
            const reader = new FileReader();
            reader.onload = (e) => {
                const encoded = e.target.result.split(',')[1];
                const entry = { attachmentId: null, fileName: file.name, attachmentSize: kb, fileSize: kb, fileFormat: ext, encoded, rawFile: file, displaySizeKb: (file.size / 1024).toFixed(2), localUrl: URL.createObjectURL(file) };
                setFiles((prev) => [...prev, entry]);
                setError('');
                notifyChange();
            };
            reader.readAsDataURL(file);
        });
        if (errs.length) setError(errs.join(' '));
    };

    const onDrop = (e) => {
        e.preventDefault(); e.stopPropagation(); setDragging(false);
        if (e.dataTransfer.files?.length) processIncoming(Array.from(e.dataTransfer.files));
    };
    const onFileInput = (e) => { if (e.target.files?.length) processIncoming(Array.from(e.target.files)); e.target.value = ''; };

    const viewFile = (entry) => {
        if (entry.isServer) { if (onViewServer) onViewServer(entry); return; }
        const url = base64ToBlobUrl(entry.encoded, blobType(entry.fileFormat));
        if (!url) return;
        if (DOWNLOAD_FORMATS.includes(entry.fileFormat)) {
            const a = document.createElement('a'); a.href = url; a.download = entry.fileName; document.body.appendChild(a); a.click(); a.remove();
            return;
        }
        window.open(url, '_blank');
    };

    const removeFile = (entry) => {
        if (entry.isServer) setDeleted((prev) => [...prev, { attachmentId: entry.attachmentId, fileName: entry.fileName, invalidFlag: 'Y' }]);
        else if (entry.localUrl) URL.revokeObjectURL(entry.localUrl);
        setFiles((prev) => prev.filter((f) => !(f.fileName === entry.fileName && f.attachmentSize === entry.attachmentSize)));
        setError('');
        notifyChange();
    };

    return (<div className={`universal-file-uploader ${inBaseApp === 'Y' ? 'in-base-app' : ''}`}>
      <div className="uploader-dropzone-container position-relative"
        onDragOver={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
        onDragEnter={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(true); }}
        onDragLeave={(e) => { e.preventDefault(); e.stopPropagation(); setDragging(false); }}
        onDrop={onDrop}>
        {!dragging && (<div className="uploader-area-box w-100 d-flex align-items-center flex-column gap-2 justify-content-center" onClick={() => inputRef.current?.click()}>
          <div className="uploader-main-icon"><FolderUploadIcon/></div>
          <div className="uploader-info-text text-center">
            <span>Drag and Drop or</span> <span className="uploader-clickable-text fw-bold">Select File to Import</span>
            <input ref={inputRef} type="file" name={name} className="d-none" multiple={maxFiles > 1}
              accept={allowedExtensions.map((ext) => MIME_ACCEPT_MAP[ext] || `.${ext}`).join(',')}
              onClick={(e) => e.stopPropagation()} onChange={onFileInput}/>
          </div>
          <div className="uploader-hint-text">Supported Formats: {allowedExtensions.join(', ').toUpperCase()} &nbsp;|&nbsp; Max File Limit: {maxFiles} (Max {maxSizeMB} MB each)</div>
        </div>)}
        {dragging && (<div className="uploader-drag-overlay text-center flex-column gap-1 d-flex">
          <LegacyIcon icon="fa-cloud-arrow-up"/><p className="m-0"><b>Drop files here to upload</b></p>
        </div>)}

        <div className="uploader-chips-output-shell">
          {files.map((f) => {
            const label = DOWNLOAD_FORMATS.includes(f.fileFormat) ? 'Click to download' : 'Click to view';
            return (<div key={`${f.fileName}_${f.attachmentSize}_${f.attachmentId || 'new'}`} className="fum-chip d-flex align-items-center justify-content-between">
              <div className="d-flex align-items-center gap-2 overflow-hidden me-2">
                <FileTypeIcon fmt={f.fileFormat} className="text-info" style={{ fontSize: 16 }}/>
                <div className="text-truncate text-secondary" style={{ maxWidth: 280 }} title={f.fileName}><b>{f.fileName}</b> <span className="text-muted">({f.displaySizeKb} KB)</span></div>
                <button type="button" className="fum-chip-view" onClick={(e) => { e.stopPropagation(); viewFile(f); }}>{label}</button>
              </div>
              <div className="fum-chip-remove" onClick={(e) => { e.stopPropagation(); removeFile(f); }}>
                <LegacyIcon icon={inBaseApp === 'Y' ? 'fa-trash' : 'fa-times'} className="text-danger fum-chip-delete-icon"/>
              </div>
            </div>);
          })}
        </div>
      </div>
      {error && (<div className="uploader-inline-error-banner alert alert-danger d-flex align-items-center gap-2 mt-2 p-2" style={{ fontSize: 12, borderRadius: 8 }} role="alert">
        <LegacyIcon icon="fa-circle-exclamation" className="text-danger"/><div className="flex-grow-1 text-dark">{error}</div>
      </div>)}
    </div>);
});
UniversalFileUploader.displayName = 'UniversalFileUploader';
export default UniversalFileUploader;
