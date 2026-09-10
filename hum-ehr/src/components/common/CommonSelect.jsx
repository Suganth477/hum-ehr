import Select from 'react-select';
import { buildSelectStyles } from './selectStyles';

/**
 * Shared react-select dropdown — the app-standard replacement for native <select>
 * form controls (the migration stack adopts react-select for dropdowns). Bootstrap-like
 * control sizing + focus/error ring, and a body-portaled menu (z-index above modals) so
 * the option list never clips inside a scrolling modal body.
 *
 * `options` are `{ value, label }`; `value` is the raw code; `onChange` receives the
 * selected value (or '' when cleared) — matching the native <select> event.target.value.
 */
const CommonSelect = ({
    inputId, options = [], value, onChange, isDisabled = false, isClearable = true,
    placeholder = 'Select', invalid = false, className = '', ...rest
}) => {
    const selected = options.find((option) => String(option.value) === String(value)) ?? null;
    return (
        <Select
            inputId={inputId}
            className={className}
            classNamePrefix="react-select"
            options={options}
            value={selected}
            onChange={(option) => onChange?.(option ? option.value : '')}
            isDisabled={isDisabled}
            isClearable={isClearable}
            placeholder={placeholder}
            menuPortalTarget={typeof document !== 'undefined' ? document.body : null}
            menuPosition="fixed"
            styles={buildSelectStyles(invalid)}
            {...rest}
        />
    );
};
export default CommonSelect;
