import { useEffect, useRef, useState } from 'react';
import { fetchPatientDiagnosisProblems } from '../../services/procedureService';
import { getFormattedIcdCode } from '../../utils/commonUtility';
import { LegacyIcon } from './CustomIcons';
import './DiagnosisPicker.css';

/**
 * Clinical Indication / Diagnosis picker shared by the Procedure and Surgical History
 * forms (legacy procedureSurgicalUtils diagnosis dropdown). Problem List / Encounter
 * List tabs with checkboxes; selections render as chips below. Selection semantics
 * mirror the legacy working list:
 *   - problem entries keep diagnosisId; encounter entries get hevpdId (their id)
 *   - re-checking an existing (edit-seeded) entry flips invalidFlag back to 'N'
 *   - unchecking / removing a chip sets invalidFlag 'Y' (entries are never dropped,
 *     so deletions reach the save payload)
 * `value` is the working diagnosis list; `onChange` receives the updated list.
 */
const DiagnosisPicker = ({ patientId, value, onChange, title = 'Clinical Indication / Diagnosis', labels = { problem: 'Problem List', encounter: 'Encounter List' }, onAddNew, refreshKey = 0 }) => {
    const [open, setOpen] = useState(false);
    const [tab, setTab] = useState('problem');
    const [lists, setLists] = useState({ problemDiagnosisList: [], encounterDiagnosisList: [] });
    const [loading, setLoading] = useState(false);
    const wrapRef = useRef(null);

    useEffect(() => {
        let ignore = false;
        (async () => {
            setLoading(true);
            try {
                const data = await fetchPatientDiagnosisProblems(patientId);
                if (!ignore) setLists(data);
            }
            catch (error) { console.error('Failed to get patient problem diagnosis.', error); }
            finally { if (!ignore) setLoading(false); }
        })();
        return () => { ignore = true; };
    }, [patientId, refreshKey]);

    useEffect(() => {
        if (!open) return undefined;
        const close = (e) => { if (wrapRef.current && !wrapRef.current.contains(e.target)) setOpen(false); };
        document.addEventListener('click', close);
        return () => document.removeEventListener('click', close);
    }, [open]);

    const list = value || [];
    const isChecked = (icdCode) => list.some((d) => getFormattedIcdCode(d.icdCode || '') === getFormattedIcdCode(icdCode || '') && d.invalidFlag !== 'Y');

    const toggle = (record, checked, isProblem) => {
        const icd = getFormattedIcdCode(record.icdCode || '');
        const next = [...list];
        const existingIndex = next.findIndex((d) => getFormattedIcdCode(d.icdCode || '') === icd);
        if (checked) {
            if (existingIndex > -1) next[existingIndex] = { ...next[existingIndex], invalidFlag: 'N' };
            else {
                next.push(isProblem
                    ? { ...record, invalidFlag: 'N' }
                    : { ...record, hevpdId: record.id, id: null, invalidFlag: 'N' });
            }
        }
        else if (existingIndex > -1) next[existingIndex] = { ...next[existingIndex], invalidFlag: 'Y' };
        onChange(next);
    };
    const removeChip = (icdCode) => {
        const icd = getFormattedIcdCode(icdCode || '');
        onChange(list.map((d) => (getFormattedIcdCode(d.icdCode || '') === icd ? { ...d, invalidFlag: 'Y' } : d)));
    };

    const activeChips = list.filter((d) => d.invalidFlag !== 'Y');
    const chipName = (d) => (d.icdDescription || d.icdCodeDescription || d.longDescription || d.snomedCode || '');
    const chipIcd = (d) => getFormattedIcdCode(d.value || d.icdCode || d.diagnosisCode || '');

    return (<div className="form-group diagnosis-picker" ref={wrapRef}>
      <div className="d-flex justify-content-between align-items-center mb-1">
        <label className="label-name mb-0">{title}</label>
        {onAddNew && <a href="#" className="text-success fw-bold small diagnosis-picker-add-new" onClick={(e) => { e.preventDefault(); onAddNew(); }}>Add New Diagnosis</a>}
      </div>
      <div className="position-relative">
        <button type="button" className="form-control form-select form-select-sm text-start" onClick={() => setOpen((v) => !v)}>Select Diagnosis</button>
        {open && (<div className="diagnosis-picker-menu p-2">
          <ul className="nav nav-pills active-history-toggle-group-list mb-2" role="tablist" style={{ width: 'max-content' }}>
            <li className="nav-item"><button type="button" className={`nav-link small ${tab === 'problem' ? 'active' : ''}`} onClick={() => setTab('problem')}>{labels.problem}</button></li>
            <li className="nav-item"><button type="button" className={`nav-link small ${tab === 'encounter' ? 'active' : ''}`} onClick={() => setTab('encounter')}>{labels.encounter}</button></li>
          </ul>
          <div className="diagnosis-picker-scroll custom-scrollbar">
            {loading && <div className="text-muted small p-2">Loading...</div>}
            {!loading && tab === 'problem' && (lists.problemDiagnosisList.length
              ? lists.problemDiagnosisList.map((rec) => (
                  <div key={rec.diagnosisId} className="form-group form-check d-flex align-items-center mx-2 mb-1">
                    <input type="checkbox" className="form-check-input me-2" id={`diag_${patientId}_${rec.diagnosisId}`} checked={isChecked(rec.icdCode)} onChange={(e) => toggle(rec, e.target.checked, true)}/>
                    <label className="form-check-label" htmlFor={`diag_${patientId}_${rec.diagnosisId}`}>{getFormattedIcdCode(rec.icdCode || '')} &ensp;{rec.icdDescription}</label>
                  </div>
                ))
              : <div className="nodata d-flex justify-content-center align-items-center p-2"><LegacyIcon icon="mdi-information-outline" className="me-2" style={{ fontSize: '1.2rem' }}/>Patient doesn't have any problem diagnosis yet!</div>)}
            {!loading && tab === 'encounter' && (lists.encounterDiagnosisList.length
              ? lists.encounterDiagnosisList.map((enc, encIndex) => (
                  <div key={encIndex} className="d-flex mx-2 my-2 flex-column">
                    <div className="my-1"><span className="me-2">Encounter Date:</span><span className="fw-semibold">{enc.recordedDate}</span></div>
                    <div className="my-1"><span className="me-2">Visit Reason:</span><span className="fw-semibold">{enc.visitReason}</span></div>
                    <div><span>Diagnosis List:</span></div>
                    {(enc.encounterDiagnosisList || []).map((rec) => (
                      <div key={rec.id} className="form-group form-check d-flex align-items-center my-1">
                        <input type="checkbox" className="form-check-input me-2" id={`enc_diag_${patientId}_${rec.id}`} checked={isChecked(rec.icdCode)} onChange={(e) => toggle(rec, e.target.checked, false)}/>
                        <label className="form-check-label" htmlFor={`enc_diag_${patientId}_${rec.id}`}>{getFormattedIcdCode(rec.icdCode || '')}&ensp;{rec.icdCodeDescription}</label>
                      </div>
                    ))}
                  </div>
                ))
              : <div className="nodata d-flex justify-content-center align-items-center p-2"><LegacyIcon icon="mdi-information-outline" className="me-2" style={{ fontSize: '1.2rem' }}/>Patient doesn't have any encounter diagnosis yet!</div>)}
          </div>
        </div>)}
      </div>
      <div className="diagnosis-picker-chips">
        {activeChips.map((d, i) => (
          <div key={`${chipIcd(d)}_${i}`} className="diagnosis-picker-chip mt-2">
            <div className="d-flex p-1 gap-2 justify-content-between me-2 align-items-center">
              <div>
                <span style={{ color: '#3C6691', fontWeight: 600 }}>{chipIcd(d)}</span>&nbsp;
                <span style={{ color: '#37474F' }}>{chipName(d)}</span>
              </div>
              <span className="diagnosis-picker-chip-delete" role="button" onClick={() => removeChip(d.icdCode)}>
                <svg width="10" height="8" viewBox="0 0 6 6" fill="none"><path d="M5.86827 0.769502C6.04448 0.593295 6.04448 0.308363 5.86827 0.13403C5.69207 -0.0403028 5.40713 -0.0421774 5.2328 0.13403L3.00209 2.36474L0.769502 0.132156C0.593295 -0.0440519 0.308363 -0.0440519 0.13403 0.132156C-0.0403028 0.308363 -0.0421774 0.593294 0.13403 0.767627L2.36474 2.99834L0.132156 5.23093C-0.0440519 5.40713 -0.0440519 5.69207 0.132156 5.8664C0.308363 6.04073 0.593295 6.04261 0.767628 5.8664L2.99834 3.63569L5.23093 5.86827C5.40713 6.04448 5.69207 6.04448 5.8664 5.86827C6.04073 5.69207 6.04261 5.40713 5.8664 5.2328L3.63569 3.00209L5.86827 0.769502Z" fill="#D50B0B"/></svg>
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>);
};
export default DiagnosisPicker;
