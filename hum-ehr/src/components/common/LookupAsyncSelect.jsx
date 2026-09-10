import { useCallback, useEffect, useRef } from 'react';
import AsyncSelect from 'react-select/async';
import AsyncCreatableSelect from 'react-select/async-creatable';
import { buildSelectStyles } from './selectStyles';
import { DEBOUNCE_LOOKUP_MS, LOOKUP_MIN_CHARS } from '../../constants/timing';

/**
 * The shared server-side lookup dropdown — the React form of every legacy
 * jQuery-UI `.autocomplete()` concept search.
 *
 * The WRAPPER owns the min-character gate, the debounce, the loading / no-options
 * messages, the error styling and the body portal; a caller passes only a raw
 * fetcher `(term) => Promise<option[]>` plus `value`/`onChange`. Callers must not
 * re-implement the length check — that is exactly how three divergent
 * implementations (two hand-rolled `<input>` + `<ul>` dropdowns and a bare
 * AsyncSelect firing one request per keystroke) appeared in the legacy app.
 *
 * `minChars` defaults to the app-wide 3. Read the LEGACY FETCH GUARD, not the
 * widget's `minLength`, when deciding a field's real threshold — they differ.
 *
 * Because the value is an option object, free text cannot be submitted, so the
 * legacy `allowOnlyLookupData` rule is enforced by construction. Where the legacy
 * DID accept a typed value (e.g. a Direct address that isn't in the directory),
 * pass `creatable` — with `isValidNewOption` still rejecting whitespace.
 *
 * @param {Object}   props
 * @param {string}   [props.inputId]
 * @param {(term: string) => Promise<Array<{value: any, label: string}>>} props.loadOptions raw fetcher.
 * @param {number}   [props.minChars=3]      characters before a request fires.
 * @param {boolean}  [props.isMulti=false]
 * @param {boolean}  [props.creatable=false] allow a typed value the lookup didn't return.
 * @param {boolean}  [props.invalid=false]   draws the error ring.
 * @param {string}   [props.noOptionsText='No results found']
 */
const LookupAsyncSelect = ({
    inputId,
    loadOptions,
    minChars = LOOKUP_MIN_CHARS,
    isMulti = false,
    creatable = false,
    isDisabled = false,
    isClearable = true,
    placeholder = 'Search',
    invalid = false,
    noOptionsText = 'No results found',
    className = '',
    ...rest
}) => {
    const timerRef = useRef(null);
    useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

    // Gate first, then debounce — the timer lives in a ref so a superseded promise
    // is simply abandoned and only the last keystroke's request resolves.
    const gatedDebouncedLoader = useCallback((inputValue) => new Promise((resolve) => {
        const term = (inputValue || '').trim();
        if (term.length < minChars) {
            resolve([]);
            return;
        }
        if (timerRef.current)
            clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            Promise.resolve(loadOptions(term)).then(resolve).catch(() => resolve([]));
        }, DEBOUNCE_LOOKUP_MS);
    }), [loadOptions, minChars]);

    const shared = {
        inputId,
        className,
        classNamePrefix: 'react-select',
        cacheOptions: true,
        defaultOptions: false,
        loadOptions: gatedDebouncedLoader,
        isMulti,
        isDisabled,
        isClearable,
        placeholder,
        loadingMessage: () => 'Searching…',
        noOptionsMessage: ({ inputValue }) => ((inputValue || '').trim().length < minChars
            ? `Type at least ${minChars} characters to search`
            : noOptionsText),
        menuPortalTarget: typeof document !== 'undefined' ? document.body : null,
        menuPosition: 'fixed',
        styles: buildSelectStyles(invalid),
        ...rest,
    };

    if (!creatable)
        return <AsyncSelect {...shared} />;

    return (
        <AsyncCreatableSelect
            {...shared}
            // Legacy's "noSpace" rule: a typed recipient may not contain whitespace.
            isValidNewOption={(input) => Boolean(input) && !/\s/.test(input.trim())}
            formatCreateLabel={(input) => `Add "${input}"`}
            getNewOptionData={(input) => ({ value: input.trim(), label: input.trim(), __isNew__: true })}
        />
    );
};
export default LookupAsyncSelect;
