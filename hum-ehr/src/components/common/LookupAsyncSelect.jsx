import { useCallback, useEffect, useRef } from 'react';
import AsyncSelect from 'react-select/async';
import { DEBOUNCE_LOOKUP_MS, LOOKUP_MIN_CHARS } from '../../constants/timing';

/**
 * Shared "type at least N characters" server-side lookup dropdown — the app-standard
 * replacement for the legacy jQuery UI `.autocomplete()` search inputs (allergy subtype,
 * allergy reaction, problem ICD search).
 *
 * The legacy autocompletes all behave the same way: jQuery UI is configured with a small
 * minLength but the fetch itself is guarded by `searchParamter.length >= 3`, so the API
 * only fires at 3+ characters, an input loader shows while the request is in flight, and
 * the field is validated with `allowOnlyLookupData` — the user MUST pick from the list.
 * This component reproduces exactly that: below `minChars` nothing is requested, the search
 * is debounced, and because the value is an option object free text can never be submitted.
 *
 * `loadOptions` is the RAW fetcher: it receives the trimmed search term (already past the
 * minChars gate) and returns a promise of `{ value, label, ... }` options. Callers don't
 * repeat the length check or the error swallowing.
 *
 * Styling/portaling matches CommonSelect so static and lookup dropdowns are visually
 * identical, and the body-portaled menu keeps the option list from clipping inside a
 * scrolling modal body (the allergy-reaction dialog).
 */
const buildStyles = (invalid) => ({
    menuPortal: (base) => ({ ...base, zIndex: 20000 }),
    control: (base, state) => ({
        ...base,
        minHeight: 38,
        fontSize: 14,
        borderColor: invalid ? '#dc3545' : state.isFocused ? '#86b7fe' : '#ced4da',
        boxShadow: invalid
            ? '0 0 0 0.25rem rgba(220,53,69,.25)'
            : state.isFocused ? '0 0 0 0.25rem rgba(13,110,253,.25)' : 'none',
        '&:hover': { borderColor: invalid ? '#dc3545' : '#86b7fe' },
    }),
    option: (base) => ({ ...base, fontSize: 14 }),
});

const LookupAsyncSelect = ({
    inputId,
    loadOptions,
    value = null,
    onChange,
    isDisabled = false,
    isClearable = true,
    invalid = false,
    minChars = LOOKUP_MIN_CHARS,
    debounceMs = DEBOUNCE_LOOKUP_MS,
    placeholder = `Type at least ${LOOKUP_MIN_CHARS} characters…`,
    noResultsMessage = 'No results found',
    className = '',
    ...rest
}) => {
    const timerRef = useRef(null);
    useEffect(() => () => { if (timerRef.current) window.clearTimeout(timerRef.current); }, []);

    // Gate on minChars, then debounce so a fast typist fires one request instead of one per
    // keystroke. A superseded timer is cleared and its promise simply never settles —
    // react-select renders whichever call resolves last, and the final call always fires.
    const debouncedLoadOptions = useCallback((inputValue) => {
        const term = String(inputValue || '').trim();
        if (term.length < minChars) return Promise.resolve([]);
        return new Promise((resolve) => {
            if (timerRef.current) window.clearTimeout(timerRef.current);
            timerRef.current = window.setTimeout(() => {
                Promise.resolve(loadOptions(term))
                    .then((options) => resolve(Array.isArray(options) ? options : []))
                    .catch((error) => { console.error('Lookup search failed.', error); resolve([]); });
            }, debounceMs);
        });
    }, [loadOptions, minChars, debounceMs]);

    return (
        <AsyncSelect
            inputId={inputId}
            className={className}
            classNamePrefix="react-select"
            cacheOptions
            defaultOptions={false}
            loadOptions={debouncedLoadOptions}
            value={value}
            onChange={(selected) => onChange?.(selected)}
            isDisabled={isDisabled}
            isClearable={isClearable}
            placeholder={placeholder}
            loadingMessage={() => 'Searching…'}
            noOptionsMessage={({ inputValue }) => (
                String(inputValue || '').trim().length < minChars
                    ? `Type at least ${minChars} characters to search`
                    : noResultsMessage
            )}
            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
            menuPosition="fixed"
            styles={buildStyles(invalid)}
            {...rest}
        />
    );
};
export default LookupAsyncSelect;
