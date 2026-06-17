import { useState, useEffect } from 'react';
import moment from 'moment-timezone';

/**
 * Custom React Hook to instantiate a real-time system clock interval loop[cite: 12].
 * @param {string} userTimeZone - Explicit time zone code string constraint (e.g., "US/Eastern")[cite: 12].
 * @returns {Object} Updating system clock dimensions strings[cite: 12].
 */
export const useSystemClock = (userTimeZone = 'US/Eastern') => {
	const [clock, setClock] = useState({
		date: moment().tz(userTimeZone).format('DD MMM YYYY'),
		time: moment().tz(userTimeZone).format('HH:mm')
	});

	useEffect(() => {
		const ticker = setInterval(() => {
			setClock({
				date: moment().tz(userTimeZone).format('DD MMM YYYY'),
				time: moment().tz(userTimeZone).format('HH:mm')
			});
		}, 1000);

		return () => clearInterval(ticker); // Safe interval cleanup on unmount[cite: 12]
	}, [userTimeZone]);

	return clock;
};