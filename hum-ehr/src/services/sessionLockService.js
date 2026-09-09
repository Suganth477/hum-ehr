/**
 * sessionLockService — React port of the legacy `active.session.handle.js`
 * (ActiveSessionHandle singleton).
 *
 * Provides section-level concurrency locks so two users can't silently edit the
 * same record. When a user opens an existing record for edit (or deletes one),
 * `checkItIsNewRecordOrEditRecord` locks it; heartbeats keep the lock alive
 * while the form stays active; `resume` re-checks it after an idle gap; and
 * `checkItIsNewRecordForCancelForm` releases it on cancel/close. A `beforeunload`
 * keepalive releases any held lock when the tab/page goes away.
 *
 * On a "warning" response (another user holds the lock, or the record version
 * changed) the service notifies subscribers — the React SessionLockWarning
 * provider renders the warning modal — instead of driving jQuery directly.
 *
 * All four endpoints are POST JSON, matching legacy `request.postJsonRequest`.
 */
import ENDPOINTS from './endpoints';
import { apiPost } from './apiClient';
import config from '../config/env';
import { getAuthToken } from './authService';

const SESSION_ID_KEY = 'uiSessionId';
const LOCK_COUNT_KEY = 'lockEditSessionCount';

// ---- UI session id (one per browser tab, persisted in sessionStorage) ----
const createUserSessionId = () => {
	let sessionId = sessionStorage.getItem(SESSION_ID_KEY);
	if (!sessionId) {
		sessionId = (crypto?.randomUUID?.() ?? `sess-${Date.now()}-${Math.random().toString(16).slice(2)}`);
		sessionStorage.setItem(SESSION_ID_KEY, sessionId);
	}
	return sessionId;
};
export const getUserSessionId = () => sessionStorage.getItem(SESSION_ID_KEY) || createUserSessionId();

// ---- open-lock counter (drives the beforeunload keepalive) ----
const readLockCount = () => parseInt(sessionStorage.getItem(LOCK_COUNT_KEY) || '0', 10);
const writeLockCount = (count) => {
	try { sessionStorage.setItem(LOCK_COUNT_KEY, String(count)); } catch (error) { console.error(error); }
};

// ---- warning subscribers (the React warning-modal provider registers here) ----
const warningSubscribers = new Set();
export const subscribeSessionWarning = (callback) => {
	warningSubscribers.add(callback);
	return () => warningSubscribers.delete(callback);
};
const notifySessionWarning = (payload) => {
	warningSubscribers.forEach((callback) => {
		try { callback(payload); } catch (error) { console.error(error); }
	});
};

/**
 * Lock an existing record. On success (for non-DELETE actions) bumps the open-lock
 * counter; on a "warning" envelope, surfaces the warning modal. Returns the raw
 * response envelope so callers can gate on `status === 'success'`.
 */
export const lockSessionToRestrictOtherUser = async (patientId, resourceNavigationCode, sectionReferenceId, version, action = 'EDIT', isAssessment = 'N', sectionName) => {
	const params = { patientId, resourceNavigationCode, sectionReferenceId, version, sessionId: getUserSessionId(), sessionName: sectionName, isAssessment };
	try {
		const response = await apiPost(ENDPOINTS.navigationResource.lock, params);
		if (response?.status === 'success') {
			if (action !== 'DELETE') writeLockCount(readLockCount() + 1);
		} else if (response?.status === 'warning') {
			notifySessionWarning({ params, message: response.message, title: getSectionFullNameBasedOnCode(resourceNavigationCode) });
		}
		return response;
	} catch (error) {
		console.error('Failed to lock the session.', error);
		return { status: 'error', message: 'Failed to lock the session. Please try again.' };
	}
};

/** Release a lock (cancel/close). Decrements the open-lock counter. */
export const unLockSessionToRestrictOtherUser = async (patientId, resourceNavigationCode, sectionReferenceId, version, isAssessment = 'N') => {
	const params = { patientId, resourceNavigationCode, sectionReferenceId, version, sessionId: getUserSessionId(), isAssessment };
	try {
		const response = await apiPost(ENDPOINTS.navigationResource.unlock, params);
		writeLockCount(readLockCount() - 1);
		return response;
	} catch (error) {
		console.error('Failed to unlock the session.', error);
		return { status: 'error' };
	}
};

/**
 * Re-check a lock after the form was idle and the user became active again.
 * A "warning" with data ANOTHERUSER / REFRESH surfaces the warning modal;
 * ALREADYACTIVE is a no-op.
 */
export const resumeSessionToRestrictOtherUser = async (patientId, resourceNavigationCode, sectionReferenceId, versionId, sectionCode = null, isAssessment = 'N') => {
	const params = { patientId, resourceNavigationCode, sectionReferenceId, version: versionId, sessionId: getUserSessionId(), sessionName: sectionCode, isAssessment };
	try {
		const response = await apiPost(ENDPOINTS.navigationResource.resume, params);
		if (response?.status === 'warning' && (response.data === 'ANOTHERUSER' || response.data === 'REFRESH')) {
			notifySessionWarning({ params, message: response.message, title: getSectionFullNameBasedOnCode(resourceNavigationCode) });
		}
		return response;
	} catch (error) {
		console.error('Failed to resume the session.', error);
		return { status: 'error' };
	}
};

/** Keep-alive ping while the form stays active. */
export const sessionActiveHeartHeat = async (patientId, resourceNavigationCode, sectionReferenceId) => {
	const params = { patientId, resourceNavigationCode, sectionReferenceId, sessionId: getUserSessionId() };
	try {
		return await apiPost(ENDPOINTS.navigationResource.heartbeat, params);
	} catch (error) {
		console.error('Failed to send the session heartbeat.', error);
		return { status: 'error' };
	}
};

/** Lock only when there's a record id (existing record); a new record needs no lock. */
export const checkItIsNewRecordOrEditRecord = (patientId, resourceNavigationCode, sectionReferenceId, versionId = null, action = 'EDIT', isAssessment = 'N', sectionName = '') =>
	sectionReferenceId
		? lockSessionToRestrictOtherUser(patientId, resourceNavigationCode, sectionReferenceId, versionId, action, isAssessment, sectionName)
		: Promise.resolve({ status: 'success' });

/** Unlock only when there's a record id (existing record). */
export const checkItIsNewRecordForCancelForm = (patientId, resourceNavigationCode, sectionReferenceId, versionId) =>
	sectionReferenceId
		? unLockSessionToRestrictOtherUser(patientId, resourceNavigationCode, sectionReferenceId, versionId)
		: Promise.resolve({ status: 'success' });

// ---- beforeunload keepalive (release held locks on tab close / navigation) ----
let beforeUnloadBound = false;
export const registerBeforeUnloadUnlock = () => {
	if (beforeUnloadBound || typeof window === 'undefined') return;
	beforeUnloadBound = true;
	window.addEventListener('beforeunload', () => {
		if (!readLockCount()) return;
		try {
			fetch(`${config.apiBaseUrl}${ENDPOINTS.navigationResource.unlock}`, {
				method: 'POST',
				keepalive: true,
				headers: { 'Content-Type': 'application/json', 'X-Auth-Token': getAuthToken() },
				body: JSON.stringify({ pageRefreshFlag: 'Y', sessionId: getUserSessionId() }),
			})
				.then((response) => { if (response.ok) writeLockCount(0); })
				.catch(console.error);
		} catch (error) {
			console.error(error);
		}
	});
};

/**
 * Human-readable section name for the warning modal title. The React app is the
 * EHR screen, so PROBLEM resolves to "Problem" (legacy returns the EHR label).
 */
export const getSectionFullNameBasedOnCode = (resourceNavigationCode) => {
	switch (resourceNavigationCode) {
		case 'PROBLEM': return 'Problem';
		case 'DSI': return 'DSI';
		case 'REFERAL': return 'Referral';
		case 'ALCOHOLUSE': return 'Alcohol Use';
		case 'TOBACCOUSE': return 'Tobacco Use Status';
		case 'SMOKINGSTATUS': return 'Smoking Status';
		case 'OTHSOCIALHIS': return 'Other Social History';
		case 'SUBSUSE': return 'Substance Use';
		case 'FUNSTATUS': return 'Functional Status';
		case 'MENTALSTATUS': return 'Mental Status';
		case 'FALL-RISK': return 'Fall Risk';
		case 'PREGSTATUS': return 'Pregnancy Status';
		case 'DISABLSTATUS': return 'Disability Status';
		case 'HEALTHCONC': return 'Health Concern';
		case 'PHYSICAL-ACTVTY': return 'Physical Activity';
		case 'SDOH-ASSMNT': return 'SDOH Assessment';
		case 'FAMILY-HISTORY': return 'Family History';
		case 'PATGOAL': return 'Patient Goal';
		case 'SDOHGOAL': return 'SDOH Goal';
		case 'DIRCTPREF': return 'Advance Directives';
		case 'CAREPREF': return 'Care Preferences';
		case 'TREATPREF': return 'Treatment Preferences';
		case 'LIFESTYCH': return 'Lifestyle Recommendation';
		case 'NUTRIREC': return 'Nutrition Recommendation';
		case 'ENCO': return 'Encounter';
		case 'SURGHIS': return 'Surgical History';
		case 'FOLLOWUP': return 'Follow-up';
		case 'DOCUM': return 'Document';
		case 'IMDD': return 'Implantable Device';
		case 'IMMUNIZATION': return 'Immunization';
		case 'CARE-STATUS': return 'Hospitalization';
		case 'PATPROF': return 'Patient Profile';
		default: return (resourceNavigationCode || '').toLowerCase();
	}
};

const sessionLockService = {
	getUserSessionId,
	lockSessionToRestrictOtherUser,
	unLockSessionToRestrictOtherUser,
	resumeSessionToRestrictOtherUser,
	sessionActiveHeartHeat,
	checkItIsNewRecordOrEditRecord,
	checkItIsNewRecordForCancelForm,
	registerBeforeUnloadUnlock,
	subscribeSessionWarning,
	getSectionFullNameBasedOnCode,
};

export default sessionLockService;
