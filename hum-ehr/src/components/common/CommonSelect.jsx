import Select from 'react-select';

/**
 * Shared react-select dropdown — the app-standard replacement for native <select>
 * form controls (the migration stack adopts react-select for dropdowns). Bootstrap-like
 * control sizing + focus/error ring, and a body-portaled menu (z-index above modals) so
 * the option list never clips inside a scrolling modal body.
 *
 * `options` are `{ value, label }`; `value` is the raw code; `onChange` receives the
 * selected value (or '' when cleared) — matching the native <select> event.target.value.
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
            styles={buildStyles(invalid)}
            {...rest}
        />
    );
};
export default CommonSelect;
