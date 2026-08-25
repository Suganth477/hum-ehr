import { useEffect, useMemo, useRef, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import { fetchContactUsers, saveMail } from '../../services/inAppMailService';
import { useNotify } from '../../context/NotificationContext';
import { Glyph } from './InAppMailGlyphs';
import {
    buildMessageDistribution, buildFileDetails, contactToTag, attachmentIconDesc, fileNameSliceForLabel,
    COMPOSE_MAX_FILES, COMPOSE_MAX_SIZE_MB, COMPOSE_ALLOWED_MIME,
} from './inAppMailHelpers';

const swalTheme = Swal.mixin({
    customClass: { popup: 'iam-swal-popup', title: 'iam-swal-title', confirmButton: 'iam-swal-confirm', cancelButton: 'iam-swal-cancel' },
    buttonsStyling: false,
});

// One recipient chip.
const Tag = ({ tag, onRemove }) => (
    <span className="iam-tag" data-user-id={tag.distributionUserId}>
        <span className="iam-tag-initial">{(tag.distributorName || '').charAt(0).toUpperCase()}</span>
        <span className="iam-tag-name text-capitalize">{tag.distributorName}</span>
        <span role="button" className="iam-tag-remove" title="Remove Name" onClick={() => onRemove(tag)}>
            <Glyph viewBox="0 -960 960 960" width={14} height={14} fill="#000" path="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
        </span>
    </span>
);

// To / Cc field: chips + a debounced /inAppMail/contact autocomplete (legacy setupAutocomplete).
const RecipientField = ({ label, tags, onAdd, onRemove, patientId, excludeIds }) => {
    const [search, setSearch] = useState('');
    const [results, setResults] = useState([]);
    const [open, setOpen] = useState(false);
    const inputRef = useRef(null);

    useEffect(() => {
        const term = search.trim();
        if (!term) { setResults([]); setOpen(false); return undefined; }
        let cancelled = false;
        const timer = setTimeout(() => {
            fetchContactUsers({ search: term, patientId })
                .then((res) => {
                    if (cancelled) return;
                    setResults(res?.data?.contactList?.inAppMailContactdetails || []);
                    setOpen(true);
                })
                .catch(() => { if (!cancelled) setResults([]); });
        }, 300);
        return () => { cancelled = true; clearTimeout(timer); };
    }, [search, patientId]);

    const visible = results.filter((c) => !excludeIds.includes(c.userId));
    const pick = (contact) => { onAdd(contactToTag(contact)); setSearch(''); setResults([]); setOpen(false); inputRef.current?.focus(); };

    return (<div className="iam-recipient-field">
      <label className="iam-recipient-label">{label}:</label>
      <div className="iam-tag-input" onClick={() => inputRef.current?.focus()}>
        {tags.map((tag) => <Tag key={tag.distributionUserId} tag={tag} onRemove={onRemove} />)}
        <div className="iam-autocomplete-wrap">
          <input ref={inputRef} type="text" className="iam-recipient-input text-capitalize" placeholder={tags.length ? '' : 'Search Recipient'}
            value={search} onChange={(e) => setSearch(e.target.value)} onFocus={() => results.length && setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 150)} />
          {open && visible.length > 0 && (
            <div className="iam-autocomplete-list">
              {visible.map((c) => (
                <div key={c.userId} className="iam-autocomplete-item" onMouseDown={(e) => { e.preventDefault(); pick(c); }}>
                  <span className="iam-tag-initial">{(c.fullName || '').charAt(0).toUpperCase()}</span>
                  <span className="text-capitalize">{c.fullName}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>);
};

const HEADER_LABEL = { REPLY: 'Reply', REPLYALL: 'Reply All', FORWD: 'Forward', ORGINL: 'New Message' };

/**
 * In-App Mail composer (legacy InAppMailComposeMessageSend). Handles new mail, reply / reply
 * all / forward, and draft editing. To/Cc recipient tags via /inAppMail/contact autocomplete,
 * subject, message body, and up to 5 base64-staged attachments (10 MB each). Send (SENT) and
 * Save as Draft (DRAFTS) both post through saveMail — which routes to the update endpoint when
 * a draft's messageId is present. Sending requires at least one recipient and confirms an empty
 * subject, mirroring the legacy validation.
 *
 * `prefill` (from composePrefill) seeds reply/forward/draft; `variant` is 'panel' (floating new
 * compose) or 'inline' (embedded in a thread). Patient-scoped event selection/validation is
 * deferred to the patient-chart phase.
 */
const InAppMailCompose = ({
    variant = 'inline', sendType = 'ORGINL', parentMessageId = null, messageId = null,
    isDraft = false, draftDistributionList = [], prefill = null, patientId = null, onDone, onClose,
}) => {
    const { notifyError, notifySuccess } = useNotify();
    const queryClient = useQueryClient();
    const [toTags, setToTags] = useState(prefill?.to || []);
    const [ccTags, setCcTags] = useState(prefill?.cc || []);
    const [subject, setSubject] = useState(prefill?.subject || '');
    const [body, setBody] = useState(prefill?.body || '');
    const [files, setFiles] = useState(prefill?.files || []);
    const [fileError, setFileError] = useState('');
    const [minimized, setMinimized] = useState(false);
    const fileInputRef = useRef(null);

    // Revoke any object URLs created for staged-file previews on unmount.
    useEffect(() => () => { files.forEach((f) => f.localUrl && URL.revokeObjectURL(f.localUrl)); }, [files]);

    const excludeIds = useMemo(() => [...toTags, ...ccTags].map((t) => t.distributionUserId), [toTags, ccTags]);

    const invalidate = () => {
        queryClient.invalidateQueries({ queryKey: ['inAppMailList'] });
        queryClient.invalidateQueries({ queryKey: ['inAppMailCount'] });
        queryClient.invalidateQueries({ queryKey: ['inAppMailDetails'] });
    };

    const saveMutation = useMutation({
        mutationFn: (params) => saveMail(params),
        onSuccess: (res, variables) => {
            invalidate();
            notifySuccess(typeof res?.data === 'string' && res.data
                ? res.data
                : (variables.messageStatus === 'DRAFTS' ? 'Draft saved successfully' : 'Mail sent successfully'));
            onDone?.(variables.messageStatus);
        },
        onError: (err) => { console.error('Failed to save mail.', err); notifyError(err?.message || 'Failed to save mail.'); },
    });

    const doSave = (messageStatus) => saveMutation.mutate({
        messageStatus,
        messageResponseTypeCode: sendType,
        parentMessageId,
        messageBodyText: body,
        subjectName: subject,
        messageDistribution: buildMessageDistribution({ toTags, ccTags, isDraft, draftDistributionList }),
        fileDetails: buildFileDetails(files),
        messageId,
        patientId,
    });

    const onSend = async () => {
        if (!toTags.length) { notifyError('To input is required.'); return; }
        if (!subject.trim()) {
            const confirm = await swalTheme.fire({ title: 'Confirmation Alert', text: 'Do you want to send the message without any subject?', showCancelButton: true, confirmButtonText: 'Yes', cancelButtonText: 'No' });
            if (!confirm.isConfirmed) return;
        }
        doSave('SENT');
    };

    const hasContent = toTags.length || ccTags.length || subject.trim() || body.trim() || files.length;
    const onSaveDraft = () => { if (hasContent) doSave('DRAFTS'); else onClose?.(); };

    const onFilePicked = (e) => {
        const picked = Array.from(e.target.files || []);
        e.target.value = '';
        setFileError('');
        if (files.length + picked.length > COMPOSE_MAX_FILES) {
            setFileError('File limit exceeded. Only 5 files are allowed.');
            return;
        }
        picked.forEach((file) => {
            if (!COMPOSE_ALLOWED_MIME.includes(file.type)) {
                setFileError(`File "${file.name}" must be a JPG, JPEG, PNG, MP4, MOV, DOC, DOCX or PDF`);
                return;
            }
            if (file.size > COMPOSE_MAX_SIZE_MB * 1024 * 1024) {
                setFileError(`File "${file.name}" must be less than 10 MB`);
                return;
            }
            const reader = new FileReader();
            reader.onload = (ev) => {
                const encoded = String(ev.target.result).split(',')[1];
                const ext = (file.name.split('.').pop() || '').toLowerCase();
                setFiles((prev) => (prev.length >= COMPOSE_MAX_FILES ? prev : [...prev, {
                    fileName: file.name, fileFormat: ext, fileSize: parseFloat((file.size / 1024).toFixed(2)),
                    encoded, existing: false, localUrl: URL.createObjectURL(file),
                }]));
            };
            reader.readAsDataURL(file);
        });
    };

    const removeFile = (target) => setFiles((prev) => prev.filter((f) => f !== target));

    const canSend = toTags.length > 0 && (subject.trim() || body.trim() || files.length);

    return (<div className={`iam-compose iam-compose-${variant} ${minimized ? 'iam-compose-min' : ''}`}>
      <div className="iam-compose-head">
        <span className="iam-compose-title">
          {sendType === 'ORGINL' ? HEADER_LABEL.ORGINL : `${HEADER_LABEL[sendType]}${prefill?.subject ? `: ${prefill.subject}` : ''}`}
        </span>
        <span className="iam-compose-head-actions">
          {variant === 'panel' && (
            <button type="button" className="iam-icon-btn" title={minimized ? 'Maximize' : 'Minimize'} onClick={() => setMinimized((m) => !m)}>
              <Glyph viewBox="0 0 24 24" width={18} height={18} fill="#fff" path={minimized ? 'M4 8h16v2H4z' : 'M19 13H5v-2h14v2z'} />
            </button>
          )}
          <button type="button" className="iam-icon-btn" title="Close" onClick={() => onClose?.()}>
            <Glyph viewBox="0 -960 960 960" width={18} height={18} fill="#fff" path="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
          </button>
        </span>
      </div>

      {!minimized && (
        <div className="iam-compose-body">
          <RecipientField label="To" tags={toTags} patientId={patientId} excludeIds={excludeIds}
            onAdd={(t) => setToTags((prev) => [...prev, t])} onRemove={(t) => setToTags((prev) => prev.filter((x) => x.distributionUserId !== t.distributionUserId))} />
          <RecipientField label="Cc" tags={ccTags} patientId={patientId} excludeIds={excludeIds}
            onAdd={(t) => setCcTags((prev) => [...prev, t])} onRemove={(t) => setCcTags((prev) => prev.filter((x) => x.distributionUserId !== t.distributionUserId))} />

          <div className="iam-compose-subject">
            <label>Subject:</label>
            <input type="text" maxLength={200} value={subject} onChange={(e) => setSubject(e.target.value)} disabled={!!patientId} />
          </div>

          <textarea className="iam-compose-message" placeholder="Message" value={body} onChange={(e) => setBody(e.target.value)} />

          {files.length > 0 && (
            <div className="iam-compose-files">
              {files.map((f, i) => {
                const icon = attachmentIconDesc(f.fileFormat, 0);
                return (
                  <div key={`${f.fileName}_${i}`} className="iam-compose-file">
                    {icon && <Glyph viewBox={icon.viewBox} path={icon.path} width={18} height={18} fill="grey" />}
                    <span className="iam-compose-file-name">{fileNameSliceForLabel(f.fileName, f.fileFormat)}</span>
                    <span className="iam-compose-file-size">{f.existing ? f.fileSize : `${f.fileSize} KB`}</span>
                    <button type="button" className="iam-compose-file-remove" title="Remove Attachment" onClick={() => removeFile(f)}>
                      <Glyph viewBox="0 -960 960 960" width={14} height={14} fill="grey" path="m256-200-56-56 224-224-224-224 56-56 224 224 224-224 56 56-224 224 224 224-56 56-224-224-224 224Z" />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
          {fileError && <div className="iam-compose-file-error">{fileError}</div>}

          <div className="iam-compose-footer">
            <button type="button" className="iam-icon-btn" title="Attachment" disabled={files.length >= COMPOSE_MAX_FILES} onClick={() => fileInputRef.current?.click()}>
              <Glyph viewBox="0 -960 960 960" width={22} height={22} fill="#000" path="M728-326q0 103-72.175 174.5t-175 71.5Q378-80 305.5-151.5 233-223 233-326v-380q0-72.5 51.5-123.25T408-880q72 0 123.5 50.75T583-706v360q0 42-30 72t-72.5 30q-42.5 0-72.5-29.673-30-29.672-30-72.327v-370h60v370q0 17 12.5 29.5t30.64 12.5q18.139 0 30-12.5Q523-329 523-346v-360q0-48-33.5-81t-81.711-33q-48.212 0-81.5 33.06Q293-753.88 293-706v380q0 78 54.971 132T481-140q77.917 0 132.458-54Q668-248 668-326v-390h60v390Z" />
            </button>
            <input ref={fileInputRef} type="file" multiple className="d-none"
              accept="application/msword, application/vnd.openxmlformats-officedocument.wordprocessingml.document, application/pdf, image/jpg, image/jpeg, image/png, video/mp4" onChange={onFilePicked} />
            <div className="iam-compose-footer-spacer" />
            <button type="button" className="btn btn-default iam-compose-draft-btn" disabled={!hasContent || saveMutation.isPending} onClick={onSaveDraft}>Save as Draft</button>
            <button type="button" className="btn btn-primary iam-compose-send-btn" disabled={!canSend || saveMutation.isPending} onClick={onSend}>Send</button>
          </div>
        </div>
      )}
    </div>);
};
export default InAppMailCompose;
