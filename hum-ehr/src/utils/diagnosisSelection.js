import { getFormattedIcdCode } from './commonUtility';

/**
 * Merge a newly-created diagnosis into a section's working diagnosis list so it shows as
 * a selected chip — the React equivalent of the legacy
 * `resetPatientProblemFormAfterSave` → `constructNewSelectedDiagnosis` /
 * `checkSelectedDiagnosis`, which auto-selects a problem added from inside the Procedure /
 * Surgical History diagnosis picker.
 *
 * Dedups by ICD code: an existing (possibly removed) entry is re-activated (invalidFlag
 * 'N'); otherwise the new diagnosis is appended. A new selection carries no link `id`, so
 * `buildDiagnosisListPayload` treats it as a fresh diagnosis link on save.
 */
export const mergeSelectedDiagnosis = (list = [], newDiagnosis) => {
	if (!newDiagnosis?.icdCode) return list;
	const icd = getFormattedIcdCode(newDiagnosis.icdCode);
	const next = [...list];
	const index = next.findIndex((entry) => getFormattedIcdCode(entry.icdCode || '') === icd);
	if (index > -1) {
		next[index] = { ...next[index], ...newDiagnosis, invalidFlag: 'N' };
		return next;
	}
	next.push({ ...newDiagnosis, invalidFlag: 'N' });
	return next;
};

export default mergeSelectedDiagnosis;
