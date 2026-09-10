import { useCallback, useEffect, useRef, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import Swal from 'sweetalert2';
import {
    sendDirectMessage, deleteDraftedDirectMessage, fetchRecipientLookup,
    fetchActivePatientLookup, fetchDirectMessageConversation,
} from '../../services/directAddressService';
import { useNotify } from '../../context/NotificationContext';
import { LegacyIcon } from '../../components/common/CustomIcons';
import LookupAsyncSelect from '../../components/common/LookupAsyncSelect';
import { base64ToBlob, convertUploadFileInputBase64Format } from '../../utils/commonUtility';
import {
    buildDirectMessageFormData, patientContext, recipientList, replySubject, replyRecipient,
    formatPatientDobMdy, isoDateToMdy, titleCase, isAllowedComposeFile, isCdaFile,
    COMPOSE_MAX_FILES, COMPOSE_MAX_SIZE_MB, COMPOSE_ACCEPT,
} from './directAddressHelpers';

/**
 * Themed confirmation popup for this surface — never a raw `Swal.fire()`.
 * `reverseButtons` puts **No on the left, Yes on the right**, matching the legacy
 * `initJqueryPopUpConfirmationWithSelector` markup (`confirm-dialog-btn-abort`
 * before `confirm-dialog-btn-confirm`). The container class carries a global
 * z-index (App.css) so the popup stays above any dialog mask when the composer
 * is rendered inline inside the conversation reader.
 */
const swalTheme = Swal.mixin({
    customClass: {
        container: 'eda-swal-container',
        popup: 'eda-swal-popup',
        title: 'eda-swal-title',
        confirmButton: 'eda-swal-confirm',
        cancelButton: 'eda-swal-cancel',
    },
    buttonsStyling: false,
    reverseButtons: true,
    allowOutsideClick: false,
});

/** Empty per-field server validation state (legacy serverValidationFieldElements). */
const NO_SERVER_ERRORS = { messageContent: '', attachments: '', recipients: '', senderAddress: '' };

/**
 * Direct Address composer (legacy EhrDirectAddressComposeDirectMessage).
 *
 * Handles a new direct message, a reply inside a thread, and reopening a stored
 * draft. The "From" address is the selected mailbox; recipients are free-typed or
 * picked from the external direct-address lookup; a patient can be linked (which
 * attaches the DIRECT context block); attachments are staged client-side and sent
 * as real multipart file parts — XML (CDA) documents in their own field.
 *
 * Leaving the composer with unsaved content saves it as a draft, matching the
 * legacy `disconnectedCallback`; Send and Discard both suppress that.
 */
const DirectAddressCompose = ({
    directAddress,
    variant = 'page',
    messageId = null,
    relationMessageId = null,
    parentMessageId = null,
    draftDetails = null,
    replyToMessage = null,
    threadSubject = '',
    onClose,
    onDiscard,
}) => {
    const { notifySuccess, notifyError, notify } = useNotify();
    const queryClient = useQueryClient();

    const [recipients, setRecipients] = useState([]);
    const [externalMenuOpen, setExternalMenuOpen] = useState(false);
    const [subject, setSubject] = useState('');
    const [body, setBody] = useState('');
    const [files, setFiles] = useState([]);
    const [removedAttachmentIds, setRemovedAttachmentIds] = useState([]);
    const [fileError, setFileError] = useState('');
    const [recipientError, setRecipientError] = useState('');
    const [serverErrors, setServerErrors] = useState(NO_SERVER_ERRORS);
    const [sending, setSending] = useState(false);

    // Link Patient
    const [linkedPatient, setLinkedPatient] = useState(null);
    const [patientPanelOpen, setPatientPanelOpen] = useState(false);
    const [patientPick, setPatientPick] = useState(null);

    const fileInputRef = useRef(null);
    // Latest state for the unmount draft-save, which cannot read React state directly.
    const latestRef = useRef(null);
    const dirtyRef = useRef(false);
    const finishedRef = useRef(false);   // sent or discarded — no draft on the way out

    const isReply = Boolean(relationMessageId || parentMessageId);

    // ---- initial fill ----

    const fillFromMessage = useCallback((message) => {
        if (!message)
            return;
        setRecipients(recipientList(message.recipientAddress));
        setSubject(message.subject || '');
        setBody(message.body || '');
        setFiles((message.attachments || []).map((attachment) => ({
            attachmentId: attachment.attachmentId,
            fileName: attachment.fileName,
            fileFormat: attachment.fileFormat,
            fileSize: attachment.fileSize,
            encoded: null,
        })));
        if (message.patientId) {
            setLinkedPatient({
                patientId: message.patientId,
                patientName: message.patientName,
                // The details API sends ISO dates; the linked-patient view reads MM-DD-YYYY.
                dob: isoDateToMdy(message.patientDob),
            });
        }
    }, []);

    useEffect(() => {
        if (draftDetails) {
            fillFromMessage(draftDetails);
            return;
        }
        if (replyToMessage) {
            const to = replyRecipient(replyToMessage, directAddress?.fullAddress);
            setRecipients(to ? [to] : []);
            setSubject(replySubject(threadSubject || replyToMessage.subject));
        }
    }, [draftDetails, replyToMessage, threadSubject, directAddress, fillFromMessage]);

    // A draft opened straight from the list carries only its row; the attachments and
    // the linked patient come from the conversation details (legacy does the same).
    useEffect(() => {
        if (!messageId || draftDetails?.attachments)
            return;
        let cancelled = false;
        fetchDirectMessageConversation(messageId)
            .then((response) => {
                if (cancelled || response?.status !== 'success')
                    return;
                const stored = (response.data?.messages || []).find((m) => m.messageId === parseInt(messageId, 10));
                if (stored)
                    fillFromMessage(stored);
            })
            .catch((err) => console.error('Failed to load the drafted direct message.', err));
        return () => { cancelled = true; };
    }, [messageId, draftDetails, fillFromMessage]);

    // ---- recipient lookup ----

    /**
     * Raw fetcher for the shared lookup wrapper — the wrapper owns the gate and the
     * debounce. Legacy's fetch guard for this field is **2** characters
     * (`getToRecipientLookupOptions`: `if (term.trim().length < 2) return;`), not the
     * app-wide 3, so `minChars={2}` is passed at the call site.
     */
    const loadRecipientOptions = useCallback(async (term) => {
        const response = await fetchRecipientLookup(term);
        const rows = response?.status === 'success' ? (response.data || []) : [];
        return rows
            .map((row) => row.directFullAddress)
            .filter(Boolean)
            .map((address) => ({ value: address, label: address }));
    }, []);

    const onRecipientsChange = (selected) => {
        dirtyRef.current = true;
        setRecipientError('');
        setServerErrors((prev) => ({ ...prev, recipients: '' }));
        setRecipients((selected || []).map((option) => option.value));
    };

    // ---- patient link ----

    /** Legacy patient search fires at 3 characters and forces selection from the list. */
    const loadPatientOptions = useCallback(async (term) => {
        const response = await fetchActivePatientLookup(term);
        const rows = response?.status === 'success' ? (response.data || []) : [];
        return rows.map((patient) => ({
            value: patient.patientId,
            label: `${patient.patientName} (${patient.dob})`,
            patient,
        }));
    }, []);

    const commitPatientLink = () => {
        if (!patientPick)
            return;
        dirtyRef.current = true;
        setLinkedPatient(patientPick.patient);
        setPatientPanelOpen(false);
        setPatientPick(null);
    };

    const removePatientLink = async () => {
        const confirm = await swalTheme.fire({
            title: 'Confirmation Alert', text: 'Are you sure about cancel the Link Patient?',
            showCancelButton: true, confirmButtonText: 'Yes', cancelButtonText: 'No',
        });
        if (!confirm.isConfirmed)
            return;
        dirtyRef.current = true;
        setLinkedPatient(null);
    };

    // ---- attachments ----

    const onFilePicked = async (event) => {
        const picked = Array.from(event.target.files || []);
        event.target.value = '';
        setFileError('');
        setServerErrors((prev) => ({ ...prev, attachments: '' }));
        if (picked.length > COMPOSE_MAX_FILES || files.length + picked.length > COMPOSE_MAX_FILES) {
            setFileError('File limit exceeded. Only 5 files are allowed.');
            return;
        }
        for (const file of picked) {
            if (!isAllowedComposeFile(file)) {
                setFileError(`File "${file.name}" must be a JPG, JPEG, PNG, MP4, MOV, DOC, DOCX , XML or PDF`);
                continue;
            }
            if (file.size > COMPOSE_MAX_SIZE_MB * 1024 * 1024) {
                setFileError(`File "${file.name}" must be less than ${COMPOSE_MAX_SIZE_MB} MB`);
                continue;
            }
            if (files.some((staged) => staged.fileName === file.name))
                continue;
            // Staged one after another — at most five small files.
            const dataUrl = await convertUploadFileInputBase64Format(file);
            dirtyRef.current = true;
            setFiles((prev) => (prev.length >= COMPOSE_MAX_FILES ? prev : [...prev, {
                attachmentId: null,
                fileName: file.name,
                fileFormat: (file.name.split('.').pop() || '').toLowerCase(),
                fileSize: parseFloat((file.size / 1024).toFixed(2)),
                encoded: String(dataUrl).split(',')[1],
            }]));
        }
    };

    const removeFile = (target) => {
        dirtyRef.current = true;
        setFileError('');
        if (target.attachmentId)
            setRemovedAttachmentIds((prev) => (prev.includes(target.attachmentId) ? prev : [...prev, target.attachmentId]));
        setFiles((prev) => prev.filter((file) => file !== target));
    };

    // ---- save / send ----

    const buildPayload = useCallback((isDraft) => buildDirectMessageFormData({
        directAddress,
        messageId,
        parentMessageId: relationMessageId || parentMessageId,
        recipients,
        subject,
        body,
        isDraft,
        context: patientContext(linkedPatient),
        linkedPatient,
        removedAttachmentIds,
        files,
        toBlob: base64ToBlob,
    }), [directAddress, messageId, relationMessageId, parentMessageId, recipients, subject, body, linkedPatient, removedAttachmentIds, files]);

    // Keep the unmount handler pointed at the current payload builder.
    useEffect(() => { latestRef.current = { buildPayload }; });

    /** Show what the server rejected against the field it belongs to. */
    const applyServerValidation = (response) => {
        if (!Array.isArray(response.data)) {
            setServerErrors({ ...NO_SERVER_ERRORS, recipients: response.data });
            return;
        }
        const next = { ...NO_SERVER_ERRORS };
        response.data.forEach((fieldError) => {
            if (Object.prototype.hasOwnProperty.call(next, fieldError.fieldName))
                next[fieldError.fieldName] = fieldError.errorMessage;
            else
                notifyError(fieldError.errorMessage);
        });
        setServerErrors(next);
    };

    const postMessage = async () => {
        setSending(true);
        setServerErrors(NO_SERVER_ERRORS);
        try {
            const response = await sendDirectMessage(buildPayload(false));
            if (response?.status === 'success') {
                finishedRef.current = true;
                notifySuccess('Direct Message Sent Successfully.');
                onClose?.();
                return;
            }
            if (response?.status === 'warning' || Array.isArray(response?.data)) {
                applyServerValidation(response);
                return;
            }
            notifyError(response?.data || 'Failed to send Message details');
        }
        catch (err) {
            console.error('Failed to send Message details', err);
            notifyError(err?.message || 'Failed to send Message details');
        }
        finally {
            setSending(false);
        }
    };

    const onSend = async () => {
        if (!recipients.length) {
            setRecipientError('Recipient is required');
            return;
        }
        if (!subject.trim()) {
            const confirm = await swalTheme.fire({
                title: 'Confirmation Alert', text: 'Do you want to send the message without any subject?',
                showCancelButton: true, confirmButtonText: 'Yes', cancelButtonText: 'No',
            });
            if (!confirm.isConfirmed)
                return;
        }
        await postMessage();
    };

    const onDiscardClick = async () => {
        const confirm = await swalTheme.fire({
            title: 'Confirmation Alert',
            text: messageId ? 'Are you sure you want to delete this draft?' : 'Are you sure you want to discard this message?',
            showCancelButton: true, confirmButtonText: 'Yes', cancelButtonText: 'No',
        });
        if (!confirm.isConfirmed)
            return;
        finishedRef.current = true;
        if (!messageId) {
            (onDiscard || onClose)?.();
            return;
        }
        try {
            const response = await deleteDraftedDirectMessage(messageId);
            if (response?.status !== 'success') {
                notifyError(response?.data || 'Failed to delete Direct Message.');
                finishedRef.current = false;
                return;
            }
            notifySuccess('Draft Deleted Successfully');
            onClose?.();
        }
        catch (err) {
            console.error('Failed to delete the drafted message.', err);
            notifyError('Failed to delete the drafted message. Please try again.');
            finishedRef.current = false;
        }
    };

    /**
     * Leaving with unsaved content keeps it as a draft (legacy disconnectedCallback).
     * Gated on `dirtyRef` so a composer the user never touched — including React
     * StrictMode's dev-only mount/unmount/mount — never writes an empty draft.
     */
    useEffect(() => () => {
        if (finishedRef.current || !dirtyRef.current)
            return;
        sendDirectMessage(latestRef.current.buildPayload(true))
            .then((response) => {
                if (response?.status === 'success')
                    notify({ severity: 'success', summary: 'Success', detail: 'Draft Saved Successfully.' });
                queryClient.invalidateQueries({ queryKey: ['directMessageList'] });
                queryClient.invalidateQueries({ queryKey: ['directMessageConversation'] });
            })
            .catch((err) => console.error('Failed to save the direct message draft.', err));
    }, [notify, queryClient]);

    const canSend = recipients.length > 0 && !sending;
    const headerTitle = isReply ? `Re: ${threadSubject || ''}` : 'Compose Direct Message';
    const notMigrated = (what) => notify({
        severity: 'info', summary: 'Not available yet',
        detail: `${what} lives in the Referrals screens, which are not migrated yet.`,
    });

    return (<div className={`eda-compose eda-compose-${variant}`}>
      <div className="eda-compose-head">
        <span className="eda-compose-title">{headerTitle}</span>
        <button type="button" className="eda-icon-btn" title="Save and Close" onClick={() => onClose?.()}>
          <LegacyIcon icon="mdi-close" />
        </button>
      </div>

      <div className="eda-compose-body">
        <div className="eda-compose-row">
          <label className="eda-compose-label">From:</label>
          <div className="eda-compose-field">
            <span className="eda-tag eda-tag-static">
              <span className="eda-tag-initial">{(directAddress?.fullAddress || '').charAt(0)}</span>
              <span className="eda-tag-name">{directAddress?.fullAddress}</span>
            </span>
          </div>
        </div>
        {!!serverErrors.senderAddress && <div className="eda-field-error">{serverErrors.senderAddress}</div>}

        <div className="eda-compose-row">
          <label className="eda-compose-label" htmlFor="eda_direct_address_input_to_person">To:</label>
          <div className="eda-compose-field eda-recipient-field">
            {/* Creatable: legacy commits whatever is typed (a Direct address need not be
                in the directory), while `isValidNewOption` keeps its "noSpace" rule. */}
            <LookupAsyncSelect
              inputId="eda_direct_address_input_to_person"
              className="eda-recipient-select"
              isMulti
              creatable
              minChars={2}
              loadOptions={loadRecipientOptions}
              value={recipients.map((address) => ({ value: address, label: address }))}
              onChange={onRecipientsChange}
              placeholder="Search Recipient"
              noOptionsText="No recipient found"
              invalid={Boolean(recipientError || serverErrors.recipients)} />
          </div>
          <div className="eda-external-recipient">
            <button type="button" className="btn btn-primary eda-external-btn"
              onClick={() => setExternalMenuOpen((open) => !open)}>Add External Recipient</button>
            {externalMenuOpen && (
              <ul className="eda-external-menu">
                <li><button type="button" className="eda-external-menu-item"
                  onClick={() => { setExternalMenuOpen(false); notMigrated('Add External Provider'); }}>Add External Provider</button></li>
                <li><button type="button" className="eda-external-menu-item"
                  onClick={() => { setExternalMenuOpen(false); notMigrated('Add External Organization'); }}>Add External Organization</button></li>
              </ul>
            )}
          </div>
        </div>
        {(!!recipientError || !!serverErrors.recipients) && (
          <div className="eda-field-error">{recipientError || serverErrors.recipients}</div>
        )}

        <div className="eda-compose-row">
          <label className="eda-compose-label" htmlFor="eda_direct_address_input_subject">Subject:</label>
          <div className="eda-compose-field">
            <input id="eda_direct_address_input_subject" type="text" className="eda-plain-input w-100" maxLength={200}
              autoComplete="off" value={subject}
              onChange={(e) => { dirtyRef.current = true; setSubject(e.target.value); }} />
          </div>
        </div>

        <div className="eda-compose-message-area">
          <textarea className="eda-compose-message" placeholder="Message" value={body}
            onChange={(e) => {
                dirtyRef.current = true;
                setBody(e.target.value);
                setServerErrors((prev) => ({ ...prev, messageContent: '' }));
            }} />

          <div className="eda-link-patient">
            {!patientPanelOpen && !linkedPatient && (
              <button type="button" className="btn eda-link-patient-btn" onClick={() => setPatientPanelOpen(true)}>
                <LegacyIcon icon="fa-user-plus" className="me-1" />Link Patient
              </button>
            )}

            {patientPanelOpen && (
              <div className="eda-patient-search">
                <LookupAsyncSelect
                  inputId="eda_direct_address_search_patient_to_link"
                  className="eda-patient-search-input"
                  loadOptions={loadPatientOptions}
                  value={patientPick}
                  onChange={setPatientPick}
                  placeholder="Search Patient"
                  noOptionsText="No Patient Found" />
                <button type="button" className="btn btn-primary ms-2" disabled={!patientPick} onClick={commitPatientLink}>Add</button>
                <button type="button" className="btn btn-danger ms-2"
                  onClick={() => { setPatientPanelOpen(false); setPatientPick(null); }}>Cancel</button>
              </div>
            )}

            {!patientPanelOpen && linkedPatient && (
              <div className="eda-linked-patient">
                <span className="eda-linked-patient-name">
                  <LegacyIcon icon="fa-user" className="me-1" />
                  {titleCase(linkedPatient.patientName)}
                  <span className="ms-2">{formatPatientDobMdy(linkedPatient.dob)}</span>
                </span>
                <span role="button" className="eda-linked-patient-change ms-3"
                  onClick={() => { setPatientPanelOpen(true); setPatientPick(null); }}>Change</span>
                <span role="button" className="eda-linked-patient-remove ms-3" onClick={removePatientLink}>Remove</span>
              </div>
            )}
          </div>

          {files.length > 0 && (
            <div className="eda-compose-files">
              {files.map((file) => (
                <div key={file.fileName} className="eda-compose-file">
                  <LegacyIcon icon={isCdaFile(file.fileName) ? 'fa-file-code' : 'fa-file-lines'} className="me-2" />
                  <span className="eda-compose-file-name">{file.fileName}</span>
                  <span className="eda-compose-file-size">{`(${file.fileSize}KB)`}</span>
                  <button type="button" className="eda-compose-file-remove" title="Remove Attachment" onClick={() => removeFile(file)}>
                    <LegacyIcon icon="mdi-close" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {!!serverErrors.messageContent && <div className="eda-field-error">{serverErrors.messageContent}</div>}
        {(!!fileError || !!serverErrors.attachments) && <div className="eda-field-error">{fileError || serverErrors.attachments}</div>}

        <div className="eda-compose-footer">
          <button type="button" className="btn btn-primary eda-send-btn" disabled={!canSend} onClick={onSend}>Send</button>
          <input ref={fileInputRef} type="file" multiple className="d-none" accept={COMPOSE_ACCEPT} onChange={onFilePicked} />
          <button type="button" className="eda-icon-btn" title="Attachment" disabled={files.length >= COMPOSE_MAX_FILES}
            onClick={() => fileInputRef.current?.click()}>
            <LegacyIcon icon="fa-paperclip" />
          </button>
          <div className="eda-compose-footer-spacer" />
          <button type="button" className="eda-icon-btn eda-discard-btn" title="Discard Draft" onClick={onDiscardClick}>
            <LegacyIcon icon="fa-trash-can" />
          </button>
        </div>
      </div>
    </div>);
};
export default DirectAddressCompose;
