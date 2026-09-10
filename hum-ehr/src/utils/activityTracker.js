/**
 * activityTracker — React port of the activity/idle tracking in the legacy
 * `layouts.common.js`.
 *
 * Stamps a "last activity" timestamp on mouse/keyboard/click and on the tab
 * becoming hidden, and lets section-lock hooks subscribe so they can RESUME a
 * lock once the user is active again after an idle gap. The legacy stored a UTC
 * datetime string under `recentVisibilityChangeDateTime`; this React-only
 * tracker stores an epoch-ms number under the same key (only read back here),
 * which is simpler and avoids a dayjs UTC dependency.
 */
const ACTIVITY_KEY = 'recentVisibilityChangeDateTime';

const activitySubscribers = new Set();
let started = false;

const stamp = () => {
	try { localStorage.setItem(ACTIVITY_KEY, String(Date.now())); } catch { /* private mode / blocked */ }
};

/** Seconds since the last recorded activity (0 when unknown). */
export const getIdleSeconds = () => {
	try {
		const raw = localStorage.getItem(ACTIVITY_KEY);
		if (!raw) return 0;
		const then = Number(raw);
		if (!Number.isFinite(then)) return 0;
		return (Date.now() - then) / 1000;
	} catch {
		return 0;
	}
};

const handleActivity = () => {
	stamp();
	activitySubscribers.forEach((callback) => {
		try { callback(); } catch (error) { console.error(error); }
	});
};

const handleVisibilityChange = () => {
	// Going hidden freezes the idle clock at hide time (matches legacy); returning
	// visible resumes via the next real interaction (mousemove/click).
	if (typeof document !== 'undefined' && document.hidden) stamp();
	else handleActivity();
};

/** Subscribe to "user became active" events. Returns an unsubscribe fn. */
export const subscribeActivity = (callback) => {
	activitySubscribers.add(callback);
	return () => activitySubscribers.delete(callback);
};

/** Idempotent one-time wiring of the global activity listeners. */
export const startActivityTracking = () => {
	if (started || typeof document === 'undefined') return;
	started = true;
	stamp();
	document.addEventListener('mousemove', handleActivity);
	document.addEventListener('keypress', handleActivity);
	document.addEventListener('click', handleActivity);
	document.addEventListener('visibilitychange', handleVisibilityChange);
};
