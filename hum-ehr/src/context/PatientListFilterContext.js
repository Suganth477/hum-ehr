import { createContext, useContext } from 'react';

/**
 * Patient-list offcanvas filter context (Gender / Age / Primary Provider / DSI Alert —
 * legacy active.patient.js). The provider component lives in PatientListFilterProvider.jsx;
 * this component-free module holds the context, the default shape, and the consumer hook so
 * React Fast Refresh keeps working (a file may not export both a component and a hook).
 *
 * The filter offcanvas lives in the App shell while the list lives in a routed view, so the
 * two subtrees share the applied values here: the offcanvas writes on "Apply", the list reads.
 * `patientsType` flows the other way — the list publishes the selected Active/Deactivated tab
 * so the offcanvas can hide the DSI Alert field on the deactivated tab (legacy
 * _toggleFiltersBasedOnActive), and `resetToken` lets the offcanvas Reset also clear the
 * list's search box (legacy _resetPatientSearch).
 */
export const DEFAULT_PATIENT_LIST_FILTER = {
    physicianId: '',      // Primary Provider (also sent as pcpId)
    gender: '',           // '' | MALE | FEMA
    ageRange: '',         // '' | BETWEEN | > | >= | < | <=
    minAge: '',           // "from" for BETWEEN, else the single above/below value
    maxAge: '',           // "to" for BETWEEN, else empty
    dsiAlertStatus: '',   // '' | HAS_ALERTS | NO_ALERTS
};

export const PatientListFilterContext = createContext({
    appliedFilters: DEFAULT_PATIENT_LIST_FILTER,
    applyFilters: () => {},
    resetFilters: () => {},
    patientsType: 'active',
    setPatientsType: () => {},
    resetToken: 0,
});

export const usePatientListFilter = () => useContext(PatientListFilterContext);

