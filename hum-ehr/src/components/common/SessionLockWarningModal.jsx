import { useEffect, useState } from 'react';
import { Dialog } from 'primereact/dialog';
import { LegacyIcon } from './CustomIcons';
import { subscribeSessionWarning } from '../../services/sessionLockService';
import { publishSectionRefresh, sectionRefreshKey } from '../../utils/sectionRefreshBus';

/**
 * SessionLockWarningModal — React port of the legacy
 * `active_session_warning_message_modal` (active.session.handle.js →
 * showSessionWarningMessageModal).
 *
 * Mounted once near the app root. It subscribes to session-lock "warning"
 * notifications (another user is editing the record, or the record version
 * changed) and shows a static, non-dismissable dialog with the server message
 * and a Refresh action. Refresh re-fetches the affected section's list (via the
 * section-refresh bus, standing in for the legacy per-section jQuery refresh
 * trigger) and closes the dialog.
 */
const SessionLockWarningModal = () => {
	const [warning, setWarning] = useState(null); // { params, message, title }

	useEffect(() => subscribeSessionWarning((payload) => setWarning(payload)), []);

	const close = () => setWarning(null);

	const handleRefresh = () => {
		const params = warning?.params;
		if (params?.resourceNavigationCode && params?.patientId != null) {
			publishSectionRefresh(sectionRefreshKey(params.resourceNavigationCode, params.patientId));
		}
		close();
	};

	if (!warning) return null;

	const header = (
		<span className="d-flex align-items-center text-capitalize">
			<LegacyIcon icon="mdi-lock" className="me-2" />
			{warning.title || 'Session'}
		</span>
	);

	return (
		<Dialog
			visible
			onHide={close}
			header={header}
			className="pp-session-lock-warning-modal"
			style={{ width: '420px', maxWidth: '95vw' }}
			closable={false}
			dismissableMask={false}
			draggable={false}
			resizable={false}
		>
			<div className="pp-session-lock-warning-body">
				{/* Server-supplied message (plain text — rendered as text, not HTML, unlike the legacy .html()). */}
				<div className="pp-session-lock-warning-desc">{warning.message}</div>
				<div className="d-flex justify-content-end pt-3">
					<button type="button" className="btn btn-primary border-radius-button d-flex align-items-center gap-1" onClick={handleRefresh}>
						<LegacyIcon icon="mdi-reload" /> Refresh
					</button>
				</div>
			</div>
		</Dialog>
	);
};

export default SessionLockWarningModal;
