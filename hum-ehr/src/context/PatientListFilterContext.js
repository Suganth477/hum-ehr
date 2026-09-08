import { createContext, useContext } from 'react';

/**
 * Patient-list offcanvas filter context (Gender / Age / Primary Provider / DSI Alert —
 * legacy active.patient.js). The provider component lives in PatientListFilterProvider.jsx;
 * this component-free module holds the context, the default shape, and the consumer hook so
 * React Fast Refresh keeps working (a file may not export both a component and a hook).
 *
 * The filter offcanvas lives in the App shell while the list lives in a routed view, so the
 * two subtrees share the applied values here: the offcanvas writes on "Apply", the list reads.
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
});

export const usePatientListFilter = () => useContext(PatientListFilterContext);
