import React, { useEffect, useMemo, useState } from 'react';
import { fetchAllergyLookup } from '../../../services/lookupService';

const mapLookupItem = (item) => ({
	id: item.id,
	code: item.code,
	value: item.conceptName || item.value || item.description || '',
	raw: item,
});

const PatientAllergyLookupInput = ({
	id,
	label,
	conceptCategory,
	value,
	disabled = false,
	required = false,
	placeholder = '',
	excludeIds = [],
	onChange,
	onSelect,
}) => {
	const [options, setOptions] = useState([]);
	const [loading, setLoading] = useState(false);
	const listId = useMemo(() => `${id}_list`, [id]);
	const excludeIdKey = useMemo(() => (Array.isArray(excludeIds) ? excludeIds.join(',') : ''), [excludeIds]);

	useEffect(() => {
		const searchText = String(value || '').trim();
		if (disabled || searchText.length < 3) {
			setOptions((previous) => (previous.length ? [] : previous));
			return;
		}

		let ignore = false;
		const timer = window.setTimeout(async () => {
			setLoading(true);
			try {
				const response = await fetchAllergyLookup({ conceptCategory, searchParamter: searchText });
				if (ignore) return;
				let lookupOptions = (response?.status === 'success' ? response.data || [] : []).map(mapLookupItem);
				const excludeIdList = excludeIdKey ? excludeIdKey.split(',').filter(Boolean).map(String) : [];
				if (excludeIdList.length) {
					lookupOptions = lookupOptions.filter((item) => !excludeIdList.includes(String(item.id)));
				}
				setOptions(lookupOptions);
			} catch (error) {
				console.error('Failed to fetch allergy lookup.', error);
				setOptions([]);
			} finally {
				if (!ignore) setLoading(false);
			}
		}, 300);

		return () => {
			ignore = true;
			window.clearTimeout(timer);
		};
	}, [conceptCategory, disabled, excludeIdKey, value]);

	const handleChange = (event) => {
		const nextValue = event.target.value;
		onChange?.(nextValue);
		const selected = options.find((item) => item.value === nextValue);
		if (selected) onSelect?.(selected);
	};

	return (
		<div className="icon-input-group position-relative">
			{label && <label className="form-label fw-bold" htmlFor={id}>{label} {required && <span className="text-danger">*</span>}</label>}
			<input
				id={id}
				type="text"
				className="form-control"
				value={value || ''}
				placeholder={placeholder}
				list={listId}
				disabled={disabled}
				required={required && !disabled}
				onChange={handleChange}
			/>
			<span className="allergy-lookup-search-icon input-icon input-icon-left-align mdi mdi-magnify" />
			<datalist id={listId}>
				{options.map((option) => <option key={`${option.id}_${option.code}`} value={option.value} />)}
			</datalist>
			{loading && <span className="small text-muted position-absolute end-0 pe-2" style={{ top: label ? 38 : 8 }}>Loading...</span>}
		</div>
	);
};

export default PatientAllergyLookupInput;
