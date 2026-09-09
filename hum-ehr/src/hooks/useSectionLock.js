import { useCallback, useEffect, useRef } from 'react';
import { FORM_ACTIVE_HEART_BEAT_DURATION, FORM_TIME_OUT_DURATION } from '../constants/timing';
import {
	checkItIsNewRecordForCancelForm,
	checkItIsNewRecordOrEditRecord,
	registerBeforeUnloadUnlock,
	resumeSessionToRestrictOtherUser,
	sessionActiveHeartHeat,
} from '../services/sessionLockService';
import { getIdleSeconds, startActivityTracking, subscribeActivity } from '../utils/activityTracker';

/**
 * useSectionLock — React port of the legacy add/edit concurrency loop
 * (active.session.handle.js + `clearTimeOutForProblemConcurrentLocking` +
 * `disconnectedCallback`).
 *
 * The hook owns the WHOLE lock lifecycle for a mounted edit form, which keeps
 * acquire and release symmetric inside one effect — the only shape that stays
 * correct under React StrictMode's mount → unmount → remount (a split where the
 * list locks and the form unlocks would release the lock on the StrictMode
 * unmount and never re-acquire it):
 *   • on mount it locks the record (legacy checkItIsNewRecordOrEditRecord); a
 *     "warning" (another user holds it) calls `onLockDenied` so the caller can
 *     close the form — the global warning modal is shown by the service;
 *   • while active + visible it heartbeats every FORM_ACTIVE_HEART_BEAT_DURATION ms;
 *   • after FORM_TIME_OUT_DURATION seconds idle (or the tab hidden) it goes idle
 *     and stops (releasing the lock server side on timeout);
 *   • on the next real activity it RESUMEs and restarts the heartbeat;
 *   • on unmount it releases the lock — UNLESS the form was saved (the save
 *     endpoint releases it via its sessionId, mirroring the `form-saved` guard).
 *
 * A new record (no `sectionReferenceId`) needs no lock and the hook no-ops.
 * Returns `markSaved()` — call it right before closing after a successful save.
 */
export const useSectionLock = ({
	patientId,
	resourceNavigationCode,
	sectionReferenceId,
	versionId = 0,
	sectionName = '',
	enabled = true,
	onLockDenied,
}) => {
	const timerRef = useRef(null);
	const idleRef = useRef(false);
	const savedRef = useRef(false);
	const deniedRef = useRef(onLockDenied);
	deniedRef.current = onLockDenied;

	const stopHeartbeat = useCallback(() => {
		if (timerRef.current) {
			clearInterval(timerRef.current);
			timerRef.current = null;
		}
	}, []);

	const startHeartbeat = useCallback(() => {
		stopHeartbeat();
		idleRef.current = false;
		timerRef.current = setInterval(() => {
			// Idle too long, or tab hidden → go idle and stop pinging.
			if (getIdleSeconds() >= FORM_TIME_OUT_DURATION || (typeof document !== 'undefined' && document.hidden)) {
				idleRef.current = true;
				stopHeartbeat();
				return;
			}
			sessionActiveHeartHeat(patientId, resourceNavigationCode, sectionReferenceId);
		}, FORM_ACTIVE_HEART_BEAT_DURATION);
	}, [patientId, resourceNavigationCode, sectionReferenceId, stopHeartbeat]);

	const markSaved = useCallback(() => { savedRef.current = true; }, []);

	useEffect(() => {
		if (!enabled || !sectionReferenceId) return undefined;
		startActivityTracking();
		registerBeforeUnloadUnlock();
		savedRef.current = false;
		idleRef.current = false;
		let cancelled = false;
		let acquired = false;

		// Acquire the lock on mount. Symmetric release below keeps it StrictMode-safe.
		checkItIsNewRecordOrEditRecord(patientId, resourceNavigationCode, sectionReferenceId, versionId, 'EDIT', 'N', sectionName)
			.then((response) => {
				if (response?.status !== 'success') {
					// Another user holds the lock (or a version change) — the service already
					// surfaced the warning modal; let the caller close the form.
					if (!cancelled) deniedRef.current?.(response);
					return;
				}
				if (cancelled) {
					// Torn down before the lock resolved (StrictMode) — release it now.
					checkItIsNewRecordForCancelForm(patientId, resourceNavigationCode, sectionReferenceId, versionId);
					return;
				}
				acquired = true;
				startHeartbeat();
			});

		// Resume the lock when the user is active again after an idle gap.
		const unsubscribe = subscribeActivity(() => {
			if (!acquired || !idleRef.current || cancelled) return;
			if (typeof document !== 'undefined' && document.hidden) return;
			idleRef.current = false;
			resumeSessionToRestrictOtherUser(patientId, resourceNavigationCode, sectionReferenceId, versionId, sectionName)
				.then(() => { if (!cancelled) startHeartbeat(); });
		});

		return () => {
			cancelled = true;
			unsubscribe();
			stopHeartbeat();
			// Release on close/cancel; a saved form leaves release to the server.
			if (acquired && !savedRef.current) {
				checkItIsNewRecordForCancelForm(patientId, resourceNavigationCode, sectionReferenceId, versionId);
			}
		};
	}, [enabled, patientId, resourceNavigationCode, sectionReferenceId, versionId, sectionName, startHeartbeat, stopHeartbeat]);

	return { markSaved };
};

export default useSectionLock;
