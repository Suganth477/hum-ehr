import { useEffect, useMemo, useState } from 'react';
import { fetchPhysiciansInCareGroup, fetchHumCodeList, humCodeListToArray } from '../services/lookupService';
import patientCache from '../utils/patientCache';
import { usePatientListFilter, DEFAULT_PATIENT_LIST_FILTER } from '../context/PatientListFilterContext';

// Physicians come back as an id-keyed map; map defensively to {value,label}.
const mapPhysician = (p) => ({
    value: String(p.userId ?? p.physicianId ?? p.id ?? p.value ?? ''),
    label: p.fullName ?? p.userFullName ?? p.physicianName ?? p.name ?? p.label ?? '',
});

const AGE_OPERATORS = [
    { value: 'BETWEEN', label: 'In Between' },
    { value: '>', label: 'Greater than' },
    { value: '>=', label: 'Greater than or equal to' },
    { value: '<', label: 'Less than' },
    { value: '<=', label: 'Less than or equal to' },
];

/**
 * Patient-list filter offcanvas (legacy active-patient.jsp #patient_list_filter_offcanvas +
 * active.patient.js). Gender / Age (range or above-below) / Primary Provider / DSI Alert, with
 * Reset + Apply pinned to a sticky footer.
 *
 * Values are staged locally and committed to PatientListFilterContext on Apply, which the
 * list reads into its request. The DSI Alert field is hidden while the Deactivated tab is
 * selected (legacy _toggleFiltersBasedOnActive) — that endpoint has no DSI filter.
 */
const PatientListFilter = () => {
    const { appliedFilters, applyFilters, resetFilters, patientsType } = usePatientListFilter();
    const [draft, setDraft] = useState(appliedFilters);
    const [physicians, setPhysicians] = useState([]);
    const [genders, setGenders] = useState([]);

    // Keep the staged form in sync when the applied filter changes elsewhere (e.g. Reset).
    useEffect(() => { setDraft(appliedFilters); }, [appliedFilters]);

    useEffect(() => {
        let ignore = false;
        const load = async () => {
            const cached = patientCache.get('careGroupPhysicians');
            if (cached) { setPhysicians(cached); return; }
            try {
                const response = await fetchPhysiciansInCareGroup();
                const data = response?.status === 'success' ? response.data : response;
                const list = Array.isArray(data) ? data : Object.values(data || {});
                if (ignore) return;
                patientCache.set('careGroupPhysicians', list);
                setPhysicians(list);
            } catch (error) {
                console.error('Failed to load care-group physicians for the patient filter.', error);
            }
        };
        load();
        return () => { ignore = true; };
    }, []);

    // Gender options come from the PATI-GENDER hum codes, minus BOTH (legacy
    // _appendPatientGenderListOptions hides that option).
    useEffect(() => {
        let ignore = false;
        const load = async () => {
            const cached = patientCache.get('patientGenderHumCodes');
            if (cached) { setGenders(cached); return; }
            try {
                const list = humCodeListToArray(await fetchHumCodeList('PATI-GENDER'))
                    .filter((item) => item.code !== 'BOTH');
                if (ignore) return;
                patientCache.set('patientGenderHumCodes', list);
                setGenders(list);
            } catch (error) {
                console.error('Failed to load the gender list for the patient filter.', error);
            }
        };
        load();
        return () => { ignore = true; };
    }, []);

    const providerOptions = useMemo(
        () => physicians.map(mapPhysician).filter((p) => p.value && p.label),
        [physicians],
    );

    const set = (key, value) => setDraft((prev) => ({ ...prev, [key]: value }));
    const onAgeRangeChange = (value) => setDraft((prev) => ({
        ...prev,
        ageRange: value,
        // switching operator clears the operand(s) so stale ages aren't submitted
        minAge: '',
        maxAge: '',
    }));

    const onApply = () => applyFilters(draft);
    const onReset = () => { setDraft(DEFAULT_PATIENT_LIST_FILTER); resetFilters(); };

    const isBetween = draft.ageRange === 'BETWEEN';
    const isAboveBelow = draft.ageRange && !isBetween;

    return (<div className="offcanvas offcanvas-end patient-list-filter-offcanvas-container" data-bs-scroll="true" data-bs-backdrop="true" tabIndex={-1} id="patient_list_filter_offcanvas" aria-labelledby="patient_list_filter_offcanvas_label">
      <div className="offcanvas-header py-1">
        <h5 className="offcanvas-title" id="patient_list_filter_offcanvas_label">Filters</h5>
        <button type="button" className="btn-close" data-bs-dismiss="offcanvas" aria-label="Close" />
      </div>
      <div className="offcanvas-body custom-scrollbar position-relative pt-1">
        <form id="patient_list_filter_form" name="patient_list_filter_form" onSubmit={(e) => e.preventDefault()}>
          <div className="row mr-none ml-none flex-column">
            <div className="col-md pl-none mb-1">
              <div className="form-group m-none">
                <label htmlFor="patient_filter_gender">Gender</label>
                <select id="patient_filter_gender" name="patient_filter_gender" className="filter-inputs form-control form-select"
                  value={draft.gender} onChange={(e) => set('gender', e.target.value)}>
                  <option value="">Select Gender</option>
                  {genders.map((item) => <option key={item.code} value={item.code}>{item.description}</option>)}
                </select>
              </div>
            </div>

            <div className="col-md pl-none mb-1">
              <div className="form-group m-none">
                <label htmlFor="patient_list_filter_age">Age</label>
                <select name="patient_list_filter_age" id="patient_list_filter_age" className="form-control form-select"
                  value={draft.ageRange} onChange={(e) => onAgeRangeChange(e.target.value)}>
                  <option value="">Select age limit</option>
                  {AGE_OPERATORS.map((op) => <option key={op.value} value={op.value}>{op.label}</option>)}
                </select>
                {isBetween && (
                  <div className="age-in-between-container d-flex justify-content-between gap-2 mt-2 align-items-center">
                    <input type="text" inputMode="numeric" className="form-control patient-list-filter-in-between-age" id="patient_filter_age_from" name="patient_filter_age_from"
                      value={draft.minAge} onChange={(e) => set('minAge', e.target.value)} />
                    <span className="patient-list-filter-in-between-age">To</span>
                    <input type="text" inputMode="numeric" className="form-control patient-list-filter-in-between-age" id="patient_filter_age_to" name="patient_filter_age_to"
                      value={draft.maxAge} onChange={(e) => set('maxAge', e.target.value)} />
                  </div>
                )}
                {isAboveBelow && (
                  <input type="text" inputMode="numeric" className="form-control patient-list-filter-above-below-input mt-2" id="patient_filter_age_above_below" name="patient_filter_age_above_below"
                    value={draft.minAge} onChange={(e) => set('minAge', e.target.value)} />
                )}
              </div>
            </div>

            <div className="col-md mb-1 pl-none">
              <div className="form-group m-none">
                <label htmlFor="patient_list_filter_primary_provider">Primary Provider</label>
                <select className="form-control form-select" name="patient_list_filter_primary_provider" id="patient_list_filter_primary_provider"
                  value={draft.physicianId} onChange={(e) => set('physicianId', e.target.value)}>
                  <option value="">All</option>
                  {providerOptions.map((p) => <option key={p.value} value={p.value}>{p.label}</option>)}
                </select>
              </div>
            </div>

            <div className={`col-md mb-1 pl-none dsi-alert-status-filter-container ${patientsType === 'inactive' ? 'd-none' : ''}`}>
              <div className="form-group m-none">
                <label htmlFor="patient_list_filter_dsi_alert">DSI Alert</label>
                <select className="form-control form-select" name="patient_list_filter_dsi_alert" id="patient_list_filter_dsi_alert"
                  value={draft.dsiAlertStatus} onChange={(e) => set('dsiAlertStatus', e.target.value)}>
                  <option value="">Select DSI Alert</option>
                  <option value="HAS_ALERTS">Yes</option>
                  <option value="NO_ALERTS">No</option>
                </select>
              </div>
            </div>
          </div>
        </form>
      </div>
      <div className="offcanvas-footer patient-list-filter-sticky-footer">
        <button className="btn btn-primary border-radius-button bs-modal-cancel-btn cancel px-3" type="button" id="reset_patient_filter_search" style={{ width: 'auto' }} onClick={onReset}>Reset</button>
        <button className="btn btn-primary border-radius-button save px-3" type="button" id="apply_patient_list_filter" aria-label="Close" data-bs-dismiss="offcanvas" onClick={onApply}>Apply</button>
      </div>
    </div>);
};
export default PatientListFilter;
