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

dayjs.extend(utc);
dayjs.extend(timezone);
dayjs.extend(customParseFormat);
dayjs.extend(advancedFormat);
dayjs.extend(isSameOrBefore);
dayjs.extend(isSameOrAfter);
dayjs.extend(relativeTime);

export default dayjs;
