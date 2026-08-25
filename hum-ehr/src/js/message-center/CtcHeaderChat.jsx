import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { LegacyIcon } from '../../components/common/CustomIcons';
import './CtcHeaderChat.css';

/**
 * Header Care-Team-Communication (CTC) chat dropdown — the React port of the legacy
 * ehr-ctc-text-message-center / ehr-ctc-user-list / ehr-ctc-user-individual-list
 * custom elements (ehr.chat.js). A header chat icon toggles a dropdown showing the
 * recent chat-users list; selecting a user swaps to the individual conversation
 * (single-pane with a back control, unlike the full-page two-pane screen).
 *
 * Same functionality as the migrated Message Center chat, so the panel reuses the same
 * components + service layer — only the host (header dropdown vs full page) differs.
 * The trigger stays light and the heavy chat stack (TanStack Query, virtualization,
 * audio) is code-split into CtcHeaderChatPanel, loaded on first open so it never bloats
 * the always-present header chunk.
 */
const CtcHeaderChatPanel = lazy(() => import('./CtcHeaderChatPanel'));

const CtcHeaderChat = () => {
    const [open, setOpen] = useState(false);
    const rootRef = useRef(null);

    // Legacy dropdown closes on an outside click, but NOT while a modal/dialog is open
    // (mirrors handleDropdownClicks in ehr.message.center.utility.js).
    useEffect(() => {
        if (!open)
            return undefined;
        const onPointerDown = (event) => {
            if (rootRef.current && rootRef.current.contains(event.target))
                return;
            if (event.target.closest?.('.p-dialog, .p-dialog-mask, .modal, .swal2-container'))
                return;
            setOpen(false);
        };
        document.addEventListener('mousedown', onPointerDown);
        return () => document.removeEventListener('mousedown', onPointerDown);
    }, [open]);

    return (<div className="ctc-header-chat" ref={rootRef}>
      <button
        type="button"
        className={`ctc-chat-trigger ${open ? 'open' : ''}`}
        aria-label="Care team chat"
        aria-expanded={open}
        title="Care Team Communication"
        onClick={() => setOpen((value) => !value)}>
        <LegacyIcon icon="mdi-message-text-outline" />
      </button>

      {open && (
        <Suspense fallback={<div className="ctc-header-chat-panel ctc-panel-loading">Loading…</div>}>
          <CtcHeaderChatPanel />
        </Suspense>
      )}
    </div>);
};
export default CtcHeaderChat;
