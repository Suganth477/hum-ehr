/** Shared debounce / timing constants. Values are in milliseconds. */
export const DEBOUNCE_PATIENT_LIST_MS = 350;
export const DEBOUNCE_ALLERGY_LIST_MS = 350;
export const DEBOUNCE_LOOKUP_MS = 300;
/** Minimum characters typed before a lookup/autocomplete search fires. */
export const LOOKUP_MIN_CHARS = 3;

/**
 * Section-lock (concurrency) timing — legacy globals injected via ehr-layout.jsp scriptlet.
 * FORM_TIME_OUT_DURATION is in SECONDS: after this much inactivity the edit form goes idle
 * and stops sending heartbeats (releasing its lock). FORM_ACTIVE_HEART_BEAT_DURATION is the
 * heartbeat interval in MILLISECONDS.
 */
export const FORM_TIME_OUT_DURATION = 15;
export const FORM_ACTIVE_HEART_BEAT_DURATION = 5000;
