/**
 * sectionRefreshBus — a tiny pub/sub used to refresh a section's list from
 * outside its React tree.
 *
 * It stands in for the legacy `refreshCustomElementBasedOnConcurrentCode`, which
 * fired a jQuery custom event at the section's web component. Here a section list
 * subscribes with a key of `${resourceNavigationCode}:${patientId}` (e.g.
 * "PROBLEM:97439"), and the session-lock warning modal's "Refresh" publishes to
 * that key so the stale list re-fetches.
 */
const subscribers = new Map(); // key -> Set<callback>

export const sectionRefreshKey = (resourceNavigationCode, patientId) => `${resourceNavigationCode}:${patientId}`;

export const subscribeSectionRefresh = (key, callback) => {
	if (!subscribers.has(key)) subscribers.set(key, new Set());
	subscribers.get(key).add(callback);
	return () => {
		const set = subscribers.get(key);
		if (!set) return;
		set.delete(callback);
		if (!set.size) subscribers.delete(key);
	};
};

export const publishSectionRefresh = (key) => {
	const set = subscribers.get(key);
	if (!set) return;
	set.forEach((callback) => {
		try { callback(); } catch (error) { console.error(error); }
	});
};
