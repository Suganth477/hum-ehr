// Replaces the old `window.patientCache` global. A module-scoped Map gives the
// same "cache survives across components" behaviour without polluting `window`,
// and is easy to clear in tests. Not reactive by design — used only as a
// read-through cache to avoid duplicate fetches.
const cache = new Map();
export const patientCache = {
    get(key) {
        return cache.get(key);
    },
    set(key, value) {
        cache.set(key, value);
    },
    has(key) {
        return cache.has(key);
    },
    delete(key) {
        cache.delete(key);
    },
    clear() {
        cache.clear();
    },
};
export default patientCache;
