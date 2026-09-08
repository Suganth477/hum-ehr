import { useMemo, useState } from 'react';
import { PatientListFilterContext, DEFAULT_PATIENT_LIST_FILTER } from './PatientListFilterContext';

/**
 * Holds the applied patient-list filter and exposes apply/reset. Rendered high in App so both
 * the filter offcanvas (App shell) and the list (routed view) share the same applied values.
 */
export const PatientListFilterProvider = ({ children }) => {
    const [appliedFilters, setAppliedFilters] = useState(DEFAULT_PATIENT_LIST_FILTER);
    const value = useMemo(() => ({
        appliedFilters,
        applyFilters: (next) => setAppliedFilters({ ...DEFAULT_PATIENT_LIST_FILTER, ...next }),
        resetFilters: () => setAppliedFilters(DEFAULT_PATIENT_LIST_FILTER),
    }), [appliedFilters]);
    return <PatientListFilterContext.Provider value={value}>{children}</PatientListFilterContext.Provider>;
};
