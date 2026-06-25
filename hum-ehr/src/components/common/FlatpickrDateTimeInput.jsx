import { useMemo } from 'react';
import Flatpickr from 'react-flatpickr';
import 'flatpickr/dist/flatpickr.min.css';
/**
 * Keeps value as a formatted string to match the legacy JSP/backend contract.
 */
const FlatpickrDateTimeInput = ({ id, name, value, onChange, onBlur, className = 'form-control', placeholder = '', disabled = false, required = false, enableTime = true, dateFormat = 'm-d-Y h:i K', minDate, maxDate, options = {}, }) => {
	const flatpickrOptions = useMemo(() => ({
		enableTime,
		dateFormat,
		allowInput: true,
		minuteIncrement: 1,
		time_24hr: false,
		disableMobile: true,
		minDate: minDate || undefined,
		maxDate: maxDate || undefined,
		...options,
	}), [enableTime, dateFormat, minDate, maxDate, options]);
	const emit = (_dates, dateStr) => onChange?.(dateStr || '');
	return (<Flatpickr id={id} name={name || id} value={value || ''} className={className} placeholder={placeholder} disabled={disabled} required={required} options={flatpickrOptions} onChange={emit} onClose={emit} onBlur={onBlur} />);
};
export default FlatpickrDateTimeInput;
