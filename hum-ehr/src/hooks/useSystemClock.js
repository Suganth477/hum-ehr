import { useEffect, useState } from 'react';
import moment from 'moment-timezone';
/**
 * Real-time clock that re-renders every second. Returns a `moment` object so
 * the caller can format it however it needs. Pass an IANA/legacy zone code
 * (e.g. "US/Eastern") to get zone-aware time, or omit it for local browser
 * time. Isolate this in the smallest component that displays the time so the
 * rest of the tree does not re-render every second.
 */
export const useSystemClock = (userTimeZone) => {
    const [now, setNow] = useState(() => moment());
    useEffect(() => {
        const ticker = window.setInterval(() => setNow(moment()), 1000);
        return () => window.clearInterval(ticker);
    }, []);
    return userTimeZone ? now.clone().tz(userTimeZone) : now;
};
