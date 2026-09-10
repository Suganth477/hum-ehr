import { useCallback } from 'react';
import { fetchProblemIcdLookup } from '../../../services/lookupService';
import { getFormattedIcdCode } from '../../../utils/commonUtility';
import LookupAsyncSelect from '../../../components/common/LookupAsyncSelect';

const mapIcdItem = (item) => {
    const code = getFormattedIcdCode(item.icdCode || '');
    const description = item.icdDescription || '';
    return {
        value: code,
        code,
        description,
        chronicIndicator: item.chronicIndicator,
        label: `${code} - ${description}`,
    };
};

/**
 * ICD-10 search for the problem form — the React port of the legacy jQuery UI autocomplete
 * on #pp_patient_problem_icd_code (`minLength: 3`, fetch guarded at 3+ chars, and validated
 * with `allowOnlyProblemLookupData` so the user must pick from the list).
 *
 * Uses the shared LookupAsyncSelect, so search/loading/selection behave identically to the
 * allergy subtype and reaction lookups. Because the value is an option object, free text can
 * no longer be submitted — which is exactly what allowOnlyProblemLookupData enforced.
 *
 * Display matches the legacy field: the SELECTED value shows only the ICD code (the
 * description lives in the separate read-only ICD Description box), while the menu lists
 * "<code> - <description>".
 *
 * `onSelect` receives `{ code, description, chronicIndicator }`, or `null` when cleared.
 */
const ProblemIcdLookupInput = ({
    id, label, code, description, disabled = false, required = false,
    invalid = false, placeholder, onSelect,
}) => {
    const loadIcdOptions = useCallback(
        (searchTerm) => fetchProblemIcdLookup(searchTerm)
            .then((response) => (response?.status === 'success' ? response.data || [] : []).map(mapIcdItem)),
        [],
    );

    const selectedValue = code
        ? { value: code, code, description, label: description ? `${code} - ${description}` : code }
        : null;

    return (
        <div className="position-relative">
            {label && (
                <label className="form-label fw-bold" htmlFor={id}>
                    {label} {required && <span className="text-danger">*</span>}
                </label>
            )}
            <LookupAsyncSelect
                inputId={id}
                loadOptions={loadIcdOptions}
                value={selectedValue}
                onChange={(selected) => onSelect?.(selected
                    ? { code: selected.code, description: selected.description, chronicIndicator: selected.chronicIndicator }
                    : null)}
                isDisabled={disabled}
                invalid={invalid}
                placeholder={placeholder}
                noResultsMessage="No matching ICD code or description"
                formatOptionLabel={(option, { context }) => (context === 'value' ? option.code : option.label)}
            />
        </div>
    );
};
export default ProblemIcdLookupInput;
