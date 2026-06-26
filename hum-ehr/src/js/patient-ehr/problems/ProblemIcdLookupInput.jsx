import { useEffect, useMemo, useRef, useState } from 'react';
import { fetchProblemIcdLookup } from '../../../services/lookupService';
import { getFormattedIcdCode } from '../../../utils/commonUtility';
import { DEBOUNCE_LOOKUP_MS, LOOKUP_MIN_CHARS } from '../../../constants/timing';
const mapIcdItem = (item) => {
    const code = getFormattedIcdCode(item.icdCode || '');
    const description = item.icdDescription || '';
    return { code, description, chronicIndicator: item.chronicIndicator, label: `${code} - ${description}` };
};
/**
 * ICD-10 autocomplete for the problem form. Same custom-dropdown approach as the
 * allergy lookup (a native <datalist> doesn't reliably show async results).
 * onSelect hands the parent { code, description, chronicIndicator } so it can
 * fill the ICD description, auto-pick the type, and fetch the SNOMED codes.
 */
const ProblemIcdLookupInput = ({ id, label, value, disabled = false, required = false, placeholder = '', onChange, onSelect, }) => {
    const [options, setOptions] = useState([]);
    const [loading, setLoading] = useState(false);
    const [open, setOpen] = useState(false);
    const blurTimer = useRef(null);
    const skipSearchRef = useRef(false);
    const listId = useMemo(() => `${id}_list`, [id]);
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
                const response = await fetchProblemIcdLookup(searchText);
                if (ignore)
                    return;
                setOptions((response?.status === 'success' ? response.data || [] : []).map(mapIcdItem));
                setOpen(true);
            }
            catch (error) {
                if (ignore)
                    return;
                console.error('Failed to fetch ICD lookup.', error);
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
    }, [disabled, value]);
    useEffect(() => () => {
        if (blurTimer.current)
            window.clearTimeout(blurTimer.current);
    }, []);
    const handleSelect = (item) => {
        skipSearchRef.current = true;
        onChange?.(item.code);
        onSelect?.(item);
        setOptions([]);
        setOpen(false);
    };
    const showMenu = open && !disabled && options.length > 0;
    return (<div className="icon-input-group position-relative" data-list-id={listId}>
      {label && (<label className="form-label fw-bold" htmlFor={id}>
          {label} {required && <span className="text-danger">*</span>}
        </label>)}
      <input id={id} type="text" autoComplete="off" className="form-control text-capitalize" value={value || ''} placeholder={placeholder} disabled={disabled} onChange={(event) => { onChange?.(event.target.value); setOpen(true); }} onFocus={() => { if (options.length) setOpen(true); }} onBlur={() => { blurTimer.current = window.setTimeout(() => setOpen(false), 150); }}/>
      <span className="problem-lookup-search-icon input-icon input-icon-left-align mdi mdi-magnify"/>
      {loading && (<span className="small text-muted position-absolute end-0 pe-2" style={{ top: label ? 38 : 8 }}>
          Loading...
        </span>)}
      {showMenu && (<ul className="dropdown-menu show w-100" role="listbox" style={{ position: 'absolute', top: '100%', left: 0, zIndex: 1080, maxHeight: 240, overflowY: 'auto' }}>
          {options.map((option) => (<li key={`${option.code}_${option.description.slice(0, 16)}`}>
              <button type="button" className="dropdown-item text-wrap small" role="option" onMouseDown={(event) => { event.preventDefault(); handleSelect(option); }}>
                {option.label}
              </button>
            </li>))}
        </ul>)}
    </div>);
};
export default ProblemIcdLookupInput;
