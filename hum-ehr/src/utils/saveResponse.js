// Care-plan save endpoints (problems, allergies, encounters, vitals, ...) always
// respond HTTP 200 with an envelope: { status, data, message }. Only
// status === 'success' means the record was actually saved. The non-success
// statuses — 'warning', 'failure' and 'errors' — all mean "not saved" and carry a
// human-readable reason in `data` (a string), e.g. the duplicate-record message.
//
// This mirrors the legacy auto-save handler (patient.chart.auto.save.js), which
// closes the form only on 'success' and otherwise keeps it open and surfaces that
// message. Because axios is rejected only on non-2xx, these non-success bodies
// arrive on the resolved (.then) path — they must be handled there, not in catch.
export const isSaveSuccess = (response) => response?.status === 'success';

/**
 * Classify a save response into a UI outcome.
 * @param {*} response       The unwrapped API envelope returned by the save call.
 * @param {string} fallback  Message to show when the server sends no usable text.
 * @returns {{ok: boolean, tone: 'success'|'warning'|'error', message: string}}
 */
export const getSaveOutcome = (
	response,
	fallback = 'Save failed. Please review the details and try again.',
) => {
	if (isSaveSuccess(response))
		return { ok: true, tone: 'success', message: '' };
	const message =
		(typeof response?.data === 'string' && response.data.trim()) ||
		(typeof response?.message === 'string' && response.message.trim()) ||
		fallback;
	// 'warning' is advisory (amber); 'failure'/'errors'/anything else is an error (red).
	return { ok: false, tone: response?.status === 'warning' ? 'warning' : 'error', message };
};

const saveResponse = { isSaveSuccess, getSaveOutcome };
export default saveResponse;
