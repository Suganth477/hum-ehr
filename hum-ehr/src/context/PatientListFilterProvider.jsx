import { useCallback, useMemo, useState } from 'react';
import { PatientListFilterContext, DEFAULT_PATIENT_LIST_FILTER } from './PatientListFilterContext';

/**
 * Holds the applied patient-list filter and exposes apply/reset. Rendered high in App so both
 * the filter offcanvas (App shell) and the list (routed view) share the same applied values.
 * Also carries the selected Active/Deactivated tab and a reset token (see the context module).
 */
export const PatientListFilterProvider = ({ children }) => {
    const [appliedFilters, setAppliedFilters] = useState(DEFAULT_PATIENT_LIST_FILTER);
    const [patientsType, setPatientsType] = useState('active');
    const [resetToken, setResetToken] = useState(0);
    const applyFilters = useCallback((next) => setAppliedFilters({ ...DEFAULT_PATIENT_LIST_FILTER, ...next }), []);
    // Reset clears the filter form AND the header search box, like legacy _resetPatientSearch.
    const resetFilters = useCallback(() => {
        setAppliedFilters(DEFAULT_PATIENT_LIST_FILTER);
        setResetToken((previous) => previous + 1);
    }, []);
    const value = useMemo(() => ({
        appliedFilters,
        applyFilters,
        resetFilters,
        patientsType,
        setPatientsType,
        resetToken,
    }), [appliedFilters, applyFilters, resetFilters, patientsType, resetToken]);
    return <PatientListFilterContext.Provider value={value}>{children}</PatientListFilterContext.Provider>;
};

