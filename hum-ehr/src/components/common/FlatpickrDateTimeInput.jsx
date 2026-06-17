import React, { useMemo } from "react";
import Flatpickr from "react-flatpickr";
import "flatpickr/dist/flatpickr.min.css";

/**
 * Shared Flatpickr wrapper for migrated JSP date/datetime inputs.
 *
 * Keep value as a string because old backend/JSP code expects formatted strings.
 * Examples:
 *   dateFormat="m-d-Y"        -> 06-16-2026
 *   dateFormat="m-d-Y h:i K"  -> 06-16-2026 04:30 PM
 */
const FlatpickrDateTimeInput = ({
	id,
	name,
	value,
	onChange,
	className = "form-control",
	placeholder = "",
	disabled = false,
	required = false,
	enableTime = true,
	dateFormat = "m-d-Y h:i K",
	minDate,
	maxDate,
	options = {},
	onBlur,
}) => {
	const flatpickrOptions = useMemo(
		() => ({
			enableTime,
			dateFormat,
			allowInput: true,
			minuteIncrement: 1,
			time_24hr: false,
			disableMobile: true,
			minDate: minDate || undefined,
			maxDate: maxDate || undefined,
			...options,
		}),
		[enableTime, dateFormat, minDate, maxDate, options],
	);

	return (
		<Flatpickr
			id={id}
			name={name || id}
			value={value || ""}
			className={className}
			placeholder={placeholder}
			disabled={disabled}
			required={required}
			options={flatpickrOptions}
			onChange={(_selectedDates, dateStr) => {
				onChange?.(dateStr || "");
			}}
			onClose={(_selectedDates, dateStr) => {
				onChange?.(dateStr || "");
			}}
			onBlur={onBlur}
		/>
	);
};

export default FlatpickrDateTimeInput;
