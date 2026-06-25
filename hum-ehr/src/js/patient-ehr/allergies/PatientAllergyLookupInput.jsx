import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchAllergyLookup } from '../../../services/lookupService';
import { DEBOUNCE_LOOKUP_MS, LOOKUP_MIN_CHARS } from '../../../constants/timing';
const mapLookupItem = (item) => ({
    id: item.id,
    code: item.code,
    value: item.conceptName || item.value || item.description || '',
    raw: item,
});
/**
 * Remote autocomplete for allergy concept lookups (subtype, reaction, etc.).
 *
 * Uses a custom suggestion dropdown rather than a native <datalist>: with a
 * datalist the browser reads its <option>s at keypress time, but our options
 * arrive ~300ms later (debounce + fetch), so the native popup frequently never
 * shows. This mirrors the legacy jQuery-UI autocomplete behaviour.
 */
const PatientAllergyLookupInput = ({ id, label, conceptCategory, value, disabled = false, required = false, placeholder = '', excludeIds = [], onChange, onSelect, }) => {
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const blurTimer = useRef(null);
    // Set right after a selection so the value-change effect doesn't immediately
    // re-search and reopen the menu over the chosen value.
    const skipSearchRef = useRef(false);
    const excludeIdKey = useMemo(() => excludeIds.join(','), [excludeIds]);
    useEffect(() => {
        if (skipSearchRef.current) {
            skipSearchRef.current = false;
            return undefined;
        }
        const searchText = String(value || '').trim();
        if (disabled || searchText.length < LOOKUP_MIN_CHARS) {
            setOptions([]);
            return undefined;
        }
        let ignore = false;
        const timer = window.setTimeout(async () => {
            setLoading(true);
            try {
                const response = await fetchAllergyLookup({ conceptCategory, searchParameter: searchText });
                if (ignore)
                    return;
                let lookupOptions = (response?.status === 'success' ? response.data || [] : []).map(mapLookupItem);
                const excludeIdList = excludeIdKey ? excludeIdKey.split(',').filter(Boolean) : [];
                if (excludeIdList.length)
                    lookupOptions = lookupOptions.filter((item) => !excludeIdList.includes(String(item.id)));
                setOptions(lookupOptions);
                setOpen(true);
            }
            catch (error) {
                if (ignore)
                    return;
                console.error('Failed to fetch allergy lookup.', error);
                setOptions([]);
            }
            finally {
                if (!ignore)
                    setLoading(false);
            }
        }, DEBOUNCE_LOOKUP_MS);
        return () => {
            ignore = true;
            window.clearTimeout(timer);
        };
    }, [conceptCategory, disabled, excludeIdKey, value]);
    useEffect(() => () => {
        if (blurTimer.current)
            window.clearTimeout(blurTimer.current);
    }, []);
    const handleInputChange = (event) => {
        onChange?.(event.target.value);
        setOpen(true);
    };
    const handleSelect = (item) => {
        skipSearchRef.current = true;
        onChange?.(item.value);
        onSelect?.(item);
        setOptions([]);
        setOpen(false);
    };
    const handleFocus = () => {
        if (options.length)
            setOpen(true);
    };
    const handleBlur = () => {
        // Delay closing so an option's mousedown can register before unmounting.
        blurTimer.current = window.setTimeout(() => setOpen(false), 150);
    };
    const showMenu = open && !disabled && options.length > 0;
    return (<div className="icon-input-group position-relative">
      {label && (<label className="form-label fw-bold" htmlFor={id}>
          {label} {required && <span className="text-danger">*</span>}
        </label>)}
      <input id={id} type="text" autoComplete="off" className="form-control" value={value || ''} placeholder={placeholder} disabled={disabled} required={required && !disabled} onChange={handleInputChange} onFocus={handleFocus} onBlur={handleBlur}/>
      <span className="allergy-lookup-search-icon input-icon input-icon-left-align mdi mdi-magnify"/>
      {loading && (<span className="small text-muted position-absolute end-0 pe-2" style={{ top: label ? 38 : 8 }}>
          Loading...
        </span>)}
      {showMenu && (<ul className="dropdown-menu show w-100" role="listbox" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 1080, maxHeight: 220, overflowY: 'auto' }}>
          {options.map((option) => (<li key={`${option.id}_${option.code}`}>
              <button type="button" className="dropdown-item text-wrap" role="option" onMouseDown={(event) => { event.preventDefault(); handleSelect(option); }}>
                {option.value}
              </button>
            </li>))}
        </ul>)}
    </div>);
};
export default PatientAllergyLookupInput;
