/**
 * The one react-select style object every dropdown in the app uses.
 *
 * Shared by `CommonSelect` (static dropdowns) and `LookupAsyncSelect` (server-side
 * lookups) so a control renders at the same height, font, border and indicator in
 * every section — the drift this prevents (fields of different heights, browser
 * arrows beside react-select chevrons) is the migration's most-repeated UI bug.
 * Never pass per-field `styles`; extend here instead.
 */
export const buildSelectStyles = (invalid) => ({
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
export default buildSelectStyles;
