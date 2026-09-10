/**
 * Central Day.js configuration — the app-wide replacement for the former moment
 * usage. Always import from here (not the raw 'dayjs') so the required plugins
 * are applied. Kept API-compatible with the previous moment calls used across the
 * codebase: parse-by-format, UTC/timezone (`.tz`), `isSameOrBefore/After`, and
 * relative time (`.fromNow()` — legacy `getRelativeTime`, used by the immunization/
 * goals/preferences list date columns).
 */
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';
import customParseFormat from 'dayjs/plugin/customParseFormat';
import advancedFormat from 'dayjs/plugin/advancedFormat';
import isSameOrBefore from 'dayjs/plugin/isSameOrBefore';
import isSameOrAfter from 'dayjs/plugin/isSameOrAfter';
import relativeTime from 'dayjs/plugin/relativeTime';
import { parseJwtToken } from '../services/authService';

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(advancedFormat);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(relativeTime);

// JWT `timezone` claim (short code or US/* name) -> tz-database zone. Mirrors the
// legacy utility._getTimeZoneCode; unknown/missing values default to US/Eastern.
const TIME_ZONE_CODES = {
	EST: 'US/Eastern', 'US/Eastern': 'US/Eastern',
	CST: 'US/Central', 'US/Central': 'US/Central',
	MST: 'US/Mountain', 'US/Mountain': 'US/Mountain',
	PST: 'US/Pacific', 'US/Pacific': 'US/Pacific',
	AZ: 'US/Arizona', 'US/Arizona': 'US/Arizona',
	AKST: 'US/Alaska', 'US/Alaska': 'US/Alaska',
	HST: 'US/Hawaii', 'US/Hawaii': 'US/Hawaii',
};

/** The logged-in user's tz-database zone, read from the X-Auth-Token `timezone` claim. */
export const getUserTimeZone = () => TIME_ZONE_CODES[parseJwtToken()?.timezone] || 'US/Eastern';

/**
 * "Now" in the LOGGED-IN USER's timezone — not the browser's local clock. The backend
 * stores user-entered dates (recordedDate, dateOfDiagnosis, …) as wall-clock in the
 * user's zone, so every current-time default, max-date bound and past/future check must
 * use this. Using the browser clock (e.g. IST) saves records dated in the user's future,
 * which the date-scoped list queries then hide.
 */
export const userNow = () => dayjs().tz(getUserTimeZone());

export default dayjs;
