/**
 * changeLogService — React port of the legacy `patient.change.log.js`
 * (PatientChangeLog singleton).
 *
 * The care-plan "change log" is a per-section audit trail the backend groups
 * under a `logId`. As a user adds / edits / deletes records inside one browser
 * session, every human-readable message ("A new problem … has been added") is
 * accumulated in sessionStorage keyed by patient + section, so each save can
 * send the FULL running message list (`careplanLogMessage`) plus the session's
 * `logId` — letting the server append to one audit entry instead of creating a
 * fresh one per record.
 *
 * sessionStorage layout (per patient), verbatim from legacy:
 *   `${patientId}_CARE_PLAN_LOG_SESSION_MESSAGES` → { [section]: [{id, message, type}] }
 *   `${patientId}_CARE_PLAN_LOG_SESSION_ID`       → { [section]: logId }
 *
 * Faithful to the legacy behaviour, with two deliberate deviations, both marked
 * inline below:
 *   1. A "DIAGNOSIS" case is ADDED to constructChangeLogMessageBasedOnSection
 *      (the legacy switch has none — it returned undefined for problems).
 *   2. Call sites pass arguments in the CORRECT order; the legacy problem code
 *      swapped `patientId`/`operationType` on delete (and used a mistyped
 *      field name), so its delete messages silently read "modified". We keep
 *      the intended semantics.
 */

const messagesKey = (patientId) => `${patientId}_CARE_PLAN_LOG_SESSION_MESSAGES`;
const sessionIdKey = (patientId) => `${patientId}_CARE_PLAN_LOG_SESSION_ID`;

const readJson = (key, fallback) => {
	try {
		const raw = sessionStorage.getItem(key);
		return raw ? JSON.parse(raw) : fallback;
	} catch (error) {
		console.error(`Failed to read ${key} from sessionStorage.`, error);
		return fallback;
	}
};

const writeJson = (key, value) => {
	try {
		sessionStorage.setItem(key, JSON.stringify(value));
	} catch (error) {
		console.error(`Failed to write ${key} to sessionStorage.`, error);
	}
};

const getEncounterId = () => {
	try {
		return new URLSearchParams(window.location.search).get('encounter_id');
	} catch {
		return null;
	}
};

/**
 * Build the section-specific audit sentence. `operationType === "DELETE"` →
 * "deleted"; an existing (numeric) recordId → "modified"; otherwise → "added".
 */
export const constructChangeLogMessageBasedOnSection = (section, recordId, requiredParamForMessage = {}, operationType = null) => {
	const operationTypeDesc = operationType === 'DELETE' ? 'deleted' : (parseInt(recordId, 10) ? 'modified' : 'added');
	const startingWithMessage = parseInt(recordId, 10) ? 'An existing' : 'A new';
	const name = requiredParamForMessage?.name ?? '';

	switch (section) {
		// Added for the React migration — the legacy switch has no DIAGNOSIS case.
		case 'DIAGNOSIS':
			return `${startingWithMessage} problem "${name}" has been ${operationTypeDesc} `;
		case 'ALLERGY':
			return `${startingWithMessage} allergy "${name}" has been ${operationTypeDesc} `;
		case 'LAB':
			return `${startingWithMessage} lab test/panel "${name}" has been ${operationTypeDesc} `;
		case 'SMKSTS':
			return `${startingWithMessage} smoking status "${name}" has been ${operationTypeDesc} `;
		case 'IMMUNIZATION':
			return `${startingWithMessage} immunization "${name}" has been ${operationTypeDesc} `;
		case 'FAMILY-HISTORY':
			return `${startingWithMessage} family history "${name}" (${requiredParamForMessage?.relation ?? ''}) has been ${operationTypeDesc} `;
		case 'SOCIAL-HISTORY':
			return `${startingWithMessage} social history " ${name}" has been ${operationTypeDesc}`;
		case 'SOCIAL-HISTORY-TOBACCO':
			return `${startingWithMessage} tobacco use status " ${name}" has been ${operationTypeDesc}`;
		case 'SOCIAL-HISTORY-SMOKING':
			return `${startingWithMessage} smoking status " ${name}" has been ${operationTypeDesc}`;
		case 'SOCIAL-HISTORY-ALCOHOL':
			return `${startingWithMessage} alcohol status " ${name}" has been ${operationTypeDesc}`;
		case 'GOAL':
			return `${startingWithMessage} Goal" ${name}" has been ${operationTypeDesc}`;
		case 'LIFESTYLE':
			return `${startingWithMessage} Lifestyle changes" ${name}" has been ${operationTypeDesc}`;
		default:
			return '';
	}
};

/**
 * Resolve the message for a record, reusing/refreshing the one already tracked
 * in this session when present. On DELETE it drops a still-unsaved NEW record
 * entirely (returns null) or rewrites an OLD record's message to the delete text.
 */
export const getRecordIdMessageInCurrentSessionForLog = (section, id, requiredParamForMessage, patientId, operationType = null) => {
	const sessionMessages = readJson(messagesKey(patientId), {});

	if (parseInt(id, 10) && Object.prototype.hasOwnProperty.call(sessionMessages, section)) {
		const recordIds = sessionMessages[section].map((record) => record.id);
		if (recordIds.includes(parseInt(id, 10))) {
			const indexOfId = recordIds.indexOf(parseInt(id, 10));
			const recordDetails = sessionMessages[section][indexOfId];
			if (operationType === 'DELETE' && recordDetails.type === 'NEW') {
				sessionMessages[section].splice(indexOfId, 1);
				writeJson(messagesKey(patientId), sessionMessages);
				return null;
			}
			if (operationType === 'DELETE' && recordDetails.type === 'OLD') {
				const message = constructChangeLogMessageBasedOnSection(section, id, requiredParamForMessage, 'DELETE');
				sessionMessages[section][indexOfId] = { id: parseInt(id, 10), message, type: recordDetails.type };
				writeJson(messagesKey(patientId), sessionMessages);
				return message;
			}
			return recordDetails.message;
		}
	}

	return constructChangeLogMessageBasedOnSection(section, id, requiredParamForMessage, operationType);
};

/** The active `logId` for a section in this session, or null. */
export const getCarePlanChangeLogSessionId = (section, patientId) => {
	const sessionIds = readJson(sessionIdKey(patientId), {});
	return sessionIds[section] || null;
};

/**
 * The full running message for a section: every tracked message joined with the
 * current one (the current message replaces the tracked copy for its own id).
 * When an encounter is in context the legacy code sends only the current
 * message (no accumulation) — preserved here.
 */
export const getCurrentSessionChangeLogMessagesForSection = (section, currentRecordMessage, currentRecordId, patientId) => {
	const sessionMessages = readJson(messagesKey(patientId), {});
	const encounterId = getEncounterId();

	if (Object.prototype.hasOwnProperty.call(sessionMessages, section) && !encounterId) {
		let runningCurrent = currentRecordMessage;
		const recordedMessages = sessionMessages[section].map((record) => {
			if (parseInt(record.id, 10) === parseInt(currentRecordId, 10)) {
				const copy = runningCurrent;
				runningCurrent = null;
				return copy;
			}
			return record.message;
		});
		return recordedMessages.join(' \r\n') + (runningCurrent ? ' \r\n' + runningCurrent : '');
	}
	return currentRecordMessage || '';
};

/**
 * Track a saved/deleted record's message under its id. Existing ids keep their
 * original NEW/OLD type; new ids are pushed with the supplied type. Returns true
 * when it updated an existing tracked record.
 */
export const checkAndSetRecordIdInCurrentSessionForLog = (section, id, message, recordType, patientId) => {
	const sessionMessages = readJson(messagesKey(patientId), {});

	if (section && parseInt(id, 10) && message) {
		if (Object.prototype.hasOwnProperty.call(sessionMessages, section)) {
			const recordIds = sessionMessages[section].map((record) => record.id);
			if (recordIds.includes(parseInt(id, 10))) {
				const indexOfId = recordIds.indexOf(parseInt(id, 10));
				const selectedRecordType = sessionMessages[section][indexOfId].type;
				sessionMessages[section][indexOfId] = { id: parseInt(id, 10), message, type: selectedRecordType };
				writeJson(messagesKey(patientId), sessionMessages);
				return true;
			}
			sessionMessages[section].push({ id: parseInt(id, 10), message, type: recordType });
		} else {
			sessionMessages[section] = [{ id: parseInt(id, 10), message, type: recordType }];
		}
	}

	writeJson(messagesKey(patientId), sessionMessages);
	return false;
};

/** Set (or, with logId === null, clear) the section's session `logId`. */
export const setCarePlanLogSessionId = (section, logId, patientId) => {
	const sessionIds = readJson(sessionIdKey(patientId), {});

	if (section && parseInt(logId, 10)) {
		sessionIds[section] = parseInt(logId, 10);
	} else if (section && logId === null) {
		delete sessionIds[section];
	}

	try {
		sessionStorage.setItem(`${patientId}_CARE_PLAN_LOG_PATIENT_ID`, String(patientId));
		sessionStorage.setItem(`${patientId}_CARE_PLAN_LOG_SESSION_ORIGIN_PATH`, window.location.pathname);
	} catch (error) {
		console.error('Failed to persist change-log session metadata.', error);
	}
	writeJson(sessionIdKey(patientId), sessionIds);
};

const changeLogService = {
	constructChangeLogMessageBasedOnSection,
	getRecordIdMessageInCurrentSessionForLog,
	getCarePlanChangeLogSessionId,
	getCurrentSessionChangeLogMessagesForSection,
	checkAndSetRecordIdInCurrentSessionForLog,
	setCarePlanLogSessionId,
};

export default changeLogService;
