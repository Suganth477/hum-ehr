import { useMemo, useRef, useState } from 'react';
import AsyncSelect from 'react-select/async';
import { Dialog } from 'primereact/dialog';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import FormStatusFooter from '../../../components/common/FormStatusFooter';
import {
    saveFamilyMember, saveFamilyHistory, buildFamilyHistorySavePayload,
    searchFamilyHistorySnomed,
} from '../../../services/familyHistoryService';
import { getSaveOutcome } from '../../../utils/saveResponse';
import { useNotify } from '../../../context/NotificationContext';

const YEARS = (() => {
    // Legacy lists birth years ascending (1900 → current year).
    const list = [];
    for (let y = 1900; y <= new Date().getFullYear(); y++) list.push(y);
    return list;
})();
const MAX_MEMBERS = 10;
const MAX_CONDITIONS = 15;
const FH_SNOMED_MIN_CHARS = 5; // legacy family-history SNOMED autocomplete minLength
// Legacy title-cases the first letter of every word of the SNOMED description.
const titleCaseWords = (text) => (text || '').replace(/((^| )[a-z])/g, (a) => a.toUpperCase());
const cellKey = (snomedCode, index) => `${snomedCode}__${index}`;

/**
 * Family-history editable matrix (legacy PatientFamilyHistoryAddEdit). Father/Mother are
 * fixed columns; up to 10 members total, up to 15 SNOMED conditions. Each member is
 * incrementally auto-saved (/member/save) as its name/year/deceased is filled; the whole
 * matrix (checked conditions + notes per member) is committed via /familyHistory/save.
 */
const PatientFamilyHistoryAddEdit = ({ patientId, initialMembers, initialDiseases, defaultSnomed, relationTypes, onClose }) => {
    const { notifyError, notifySuccess } = useNotify();
    // Existing saved members → edit mode (heading "Edit"/save "Update"); otherwise add mode.
    const isEdit = (initialMembers || []).some((m) => m.memberId);

    // ---- Build initial matrix state from the active family-history data ----
    const [members, setMembers] = useState(() => {
        const byRelation = {};
        const others = [];
        (initialMembers || []).forEach((m) => {
            if (m.relationShip === 'FTH' || m.relationShip === 'MTH') byRelation[m.relationShip] = m;
            else others.push(m);
        });
        const mk = (index, code, desc, fixed, src) => ({
            index, relationCode: src ? src.relationShip : code, relationDesc: src ? src.relationShipDesc : desc,
            memberId: src ? src.memberId : '', name: src ? (src.fullName || '') : '', dob: src ? (src.memberDob || '') : '',
            isDiseased: src && src.isDiseased === 'Y' ? 'Y' : 'N', fixed, empty: !fixed && !src,
        });
        const cols = [mk(1, 'FTH', 'Father', true, byRelation.FTH), mk(2, 'MTH', 'Mother', true, byRelation.MTH)];
        let idx = 3;
        others.forEach((o) => { cols.push(mk(idx, o.relationShip, o.relationShipDesc, false, o)); idx += 1; });
        while (cols.length < 5) { cols.push(mk(idx, '', '', false, null)); idx += 1; }
        return cols;
    });

    const [conditions, setConditions] = useState(() => {
        const rows = (defaultSnomed || []).map((s) => ({ snomedCode: s.snomedCode, snomedDesc: s.snomedDesc }));
        const seen = new Set(rows.map((r) => r.snomedCode));
        (initialDiseases || []).forEach((d) => { if (!seen.has(d.snomedCode)) { rows.push({ snomedCode: d.snomedCode, snomedDesc: d.snomedDesc }); seen.add(d.snomedCode); } });
        return rows;
    });

    const [cells, setCells] = useState(() => {
        const idByMember = {};
        // Rebuild the member→index map the same way the columns were built above.
        const byRelation = {}; const others = [];
        (initialMembers || []).forEach((m) => {
            if (m.relationShip === 'FTH' || m.relationShip === 'MTH') byRelation[m.relationShip] = m;
            else others.push(m);
        });
        if (byRelation.FTH) idByMember[byRelation.FTH.memberId] = 1;
        if (byRelation.MTH) idByMember[byRelation.MTH.memberId] = 2;
        let idx = 3; others.forEach((o) => { idByMember[o.memberId] = idx; idx += 1; });
        const map = {};
        (initialDiseases || []).forEach((d) => {
            (d.memberList || []).forEach((entry) => {
                const index = idByMember[entry.memberId];
                if (index) map[cellKey(d.snomedCode, index)] = { checked: true, notes: entry.notes || '', diseaseId: entry.diseaseId || '' };
            });
        });
        return map;
    });

    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);
    const [saveError, setSaveError] = useState(null);
    const [notesEditor, setNotesEditor] = useState({ open: false, key: null, value: '' });
    const [addingCondition, setAddingCondition] = useState(false);
    const [highlightIndex, setHighlightIndex] = useState(null);
    const savingMemberRef = useRef({}); // guard against duplicate concurrent member saves

    const patchMember = (index, patch) => setMembers((prev) => prev.map((m) => (m.index === index ? { ...m, ...patch } : m)));
    const patchCell = (key, patch) => setCells((prev) => ({ ...prev, [key]: { checked: false, notes: '', diseaseId: '', ...prev[key], ...patch } }));

    // ---- Incremental family-member save ----
    const persistMember = async (col) => {
        if (!col.relationCode) return;
        if (savingMemberRef.current[col.index]) return;
        savingMemberRef.current[col.index] = true;
        try {
            const response = await saveFamilyMember({ id: col.memberId, name: col.name, dob: col.dob, relationshipCode: col.relationCode, isDiseased: col.isDiseased, patientId });
            if (response?.status === 'success' && !col.memberId) patchMember(col.index, { memberId: response.data });
            else if (response?.status !== 'success') notifyError(response?.message || 'Failed to save family member in family history.');
        }
        catch (error) {
            console.error('Failed to save family member.', error);
            notifyError(error?.message || 'Failed to save family member in family history.');
        }
        finally { savingMemberRef.current[col.index] = false; }
    };

    const onNameChange = (col, value) => {
        setDirty(true);
        patchMember(col.index, { name: value });
        // Legacy: first save fires when a new member's name reaches 3 chars; existing members save on change.
        if (col.memberId || value.trim().length === 3) persistMember({ ...col, name: value });
    };
    // Legacy also saves on the name field's change/blur, so a pasted/edited name that
    // never passes through exactly 3 chars still creates the member.
    const onNameBlur = (col) => {
        if (!col.memberId && (col.name || '').trim().length >= 3) persistMember(col);
    };
    const onDobChange = (col, value) => { setDirty(true); patchMember(col.index, { dob: value }); if (col.name || value) persistMember({ ...col, dob: value }); };
    const onDeceasedChange = (col, checked) => { setDirty(true); const v = checked ? 'Y' : 'N'; patchMember(col.index, { isDiseased: v }); if (col.name || col.dob) persistMember({ ...col, isDiseased: v }); };
    const onRelationChange = (col, code) => {
        setDirty(true);
        const rel = relationTypes.find((r) => r.code === code);
        patchMember(col.index, { relationCode: code, relationDesc: rel ? rel.description : '', empty: !code });
    };

    const toggleCondition = (snomedCode, index, checked) => {
        setDirty(true);
        const key = cellKey(snomedCode, index);
        if (checked) patchCell(key, { checked: true });
        else patchCell(key, { checked: false, notes: '' });
        setErrors((e) => ({ ...e, [`member_${index}`]: undefined }));
    };

    const addRelation = () => {
        // Legacy: if an empty relation slot already exists, highlight it instead of adding another.
        const emptySlot = members.find((m) => !m.fixed && !m.relationCode && !m.memberId);
        if (emptySlot) {
            setHighlightIndex(emptySlot.index);
            setTimeout(() => setHighlightIndex((current) => (current === emptySlot.index ? null : current)), 3000);
            return;
        }
        if (members.length >= MAX_MEMBERS) { notifyError("You can add up to 10 family members' history for the patient."); return; }
        setDirty(true);
        const nextIndex = Math.max(...members.map((m) => m.index)) + 1;
        setMembers((prev) => [...prev, { index: nextIndex, relationCode: '', relationDesc: '', memberId: '', name: '', dob: '', isDiseased: 'N', fixed: false, empty: true }]);
    };

    const loadConditionOptions = (input) => {
        if ((input || '').trim().length < FH_SNOMED_MIN_CHARS) return Promise.resolve([]);
        return searchFamilyHistorySnomed({ searchSnomed: input, isDefaultValue: 'N' })
            .then((list) => list.map((s) => ({ value: s.snomedCode, label: titleCaseWords(s.snomedDesc), snomedDesc: titleCaseWords(s.snomedDesc) })));
    };
    const addCondition = (option) => {
        if (!option) return;
        if (conditions.some((c) => String(c.snomedCode) === String(option.value))) { notifyError('SNOMED code already exists.'); return; }
        if (conditions.length >= MAX_CONDITIONS) { notifyError("You can add up to 15 SNOMED condition's for the patient."); return; }
        setDirty(true);
        setConditions((prev) => [...prev, { snomedCode: option.value, snomedDesc: option.snomedDesc || option.label }]);
        setAddingCondition(false);
    };

    const openNotes = (snomedCode, index) => {
        const key = cellKey(snomedCode, index);
        if (!cells[key]?.checked) return;
        setNotesEditor({ open: true, key, value: cells[key]?.notes || '' });
    };
    const saveNotes = () => { setDirty(true); patchCell(notesEditor.key, { notes: notesEditor.value.trim() }); setNotesEditor({ open: false, key: null, value: '' }); };

    const validate = () => {
        const next = {};
        members.filter((m) => m.memberId).forEach((m) => {
            if (!m.name.trim()) next[`member_${m.index}`] = 'Name is required.';
            else if (!conditions.some((c) => cells[cellKey(c.snomedCode, m.index)]?.checked)) next[`member_${m.index}`] = 'Atleast one disease should be added.';
        });
        return next;
    };

    const handleSave = async () => {
        setSaveError(null);
        const v = validate();
        setErrors(v);
        if (Object.keys(v).length) return;
        setSaving(true);
        try {
            const savedMembers = members.filter((m) => m.memberId);
            const changeLogMessage = `Family history updated for: ${savedMembers.map((m) => `${m.name} (${m.relationDesc})`).join(', ')}`;
            const payload = buildFamilyHistorySavePayload({ patientId, members, conditions, cells, changeLogMessage });
            const response = await saveFamilyHistory(payload);
            const outcome = getSaveOutcome(response, 'Failed to update family history details. Please try again.');
            if (outcome.ok) { notifySuccess('Family History details saved successfully.'); onClose(true); return; }
            setSaveError(outcome);
        }
        catch (error) {
            console.error('Failed to save family history.', error);
            setSaveError({ tone: 'error', message: error?.message || 'Failed to update family history details. Please try again.' });
        }
        finally { setSaving(false); }
    };

    const relationOptions = useMemo(() => relationTypes || [], [relationTypes]);

    return (<div className="p-2">
      <div className="row">
        <div className="col-md-12 d-flex justify-content-between my-2 align-items-center">
          <div className="view-edit-family-history-text fw-bold">{isEdit ? 'Edit Family History' : 'Add Family History'}</div>
          <div className="d-flex gap-2 align-items-center">
            <button type="button" className="btn btn-primary btn-sm border-radius-button" onClick={addRelation}><LegacyIcon icon="mdi-plus"/> Add New Relation</button>
            <button type="button" className="btn btn-primary btn-sm border-radius-button" onClick={() => setAddingCondition((v) => !v)}><LegacyIcon icon="mdi-plus"/> Add New Condition</button>
          </div>
        </div>
      </div>

      {addingCondition && (<div className="row mb-2"><div className="col-md-6">
        <AsyncSelect classNamePrefix="react-select" placeholder="Search by SNOMED Code/Condition (min 5 chars)" cacheOptions defaultOptions={false}
          loadOptions={loadConditionOptions} onChange={addCondition} value={null}
          noOptionsMessage={({ inputValue }) => ((inputValue || '').length < FH_SNOMED_MIN_CHARS ? `Type at least ${FH_SNOMED_MIN_CHARS} characters` : 'No results found')}/>
      </div></div>)}

      <div className="pcfh-table-scroll-container custom-scrollbar" id="pcpfh_family_history_container_section">
        <table className="table pcfh-table" id="patient_family_history_detail_table">
          <thead className="thead-border-radius">
            <tr>
              <th data-index="0"/>
              {members.map((m) => (<th key={m.index} data-index={m.index} data-member-id={m.memberId || ''}>
                {m.fixed
                  ? m.relationDesc
                  : (m.memberId
                    ? m.relationDesc
                    : (<select className={`form-control form-select family-history-relation-type${highlightIndex === m.index ? ' fh-relation-highlight' : ''}`} value={m.relationCode} onChange={(e) => onRelationChange(m, e.target.value)}>
                        <option value="">Select Relation</option>
                        {relationOptions.map((r) => <option key={r.code} value={r.code}>{r.description}</option>)}
                      </select>))}
              </th>))}
            </tr>
          </thead>
          <tbody id="patient_family_history_detail_table_body">
            <tr>
              <td data-index="0" className="pcfh-family-member-details-title" style={{ zIndex: 10 }}>Family Member Details</td>
              {members.map((m) => {
                const nameEnabled = m.fixed || !!m.relationCode;
                const detailEnabled = !!m.memberId;
                return (<td key={m.index} className="pcfh-member-cell" data-index={m.index} family-member-id={m.memberId || ''}>
                  <label className="mb-1">Name</label>
                  <input type="text" className="form-control text-capitalize mb-2" value={m.name} disabled={!nameEnabled} onChange={(e) => onNameChange(m, e.target.value)} onBlur={() => onNameBlur(m)}/>
                  <label className="mb-1">Birth Year</label>
                  <select className="form-control form-select mb-2" value={m.dob} disabled={!detailEnabled} onChange={(e) => onDobChange(m, e.target.value)}>
                    <option value="">Select Year</option>
                    {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                  </select>
                  <label className="mt-1 d-block">Deceased <input type="checkbox" className="ms-1" checked={m.isDiseased === 'Y'} disabled={!detailEnabled} onChange={(e) => onDeceasedChange(m, e.target.checked)}/></label>
                  {errors[`member_${m.index}`] && <div className="small text-danger">{errors[`member_${m.index}`]}</div>}
                </td>);
              })}
            </tr>
            {conditions.map((c) => (<tr key={c.snomedCode} data-condition={c.snomedCode}>
              <td data-index="0">
                <div style={{ width: 250, whiteSpace: 'normal' }}>{c.snomedDesc}</div>
                <div>SNOMED Code: {c.snomedCode}</div>
              </td>
              {members.map((m) => {
                const key = cellKey(c.snomedCode, m.index);
                const cell = cells[key] || {};
                const enabled = !!m.memberId;
                return (<td key={m.index} data-index={m.index} className="pcfh-condition-cell">
                  <input type="checkbox" className="family-member-condition" checked={!!cell.checked} disabled={!enabled} onChange={(e) => toggleCondition(c.snomedCode, m.index, e.target.checked)}/>
                  <span tabIndex={0} role="button" className={`family-member-condition-notes pcfh-condition-notes ms-1 ${cell.checked ? 'active-condition' : ''} ${cell.notes ? 'green' : ''}`} onClick={() => openNotes(c.snomedCode, m.index)}>
                    <LegacyIcon icon="fa-book"/>
                  </span>
                </td>);
              })}
            </tr>))}
          </tbody>
        </table>
      </div>

      {saveError && (<div className={`mt-2 small ${saveError.tone === 'warning' ? 'text-warning' : 'text-danger'}`}><LegacyIcon icon="fa-exclamation-triangle" className="me-1"/>{saveError.message}</div>)}

      <FormStatusFooter
        dirty={dirty}
        saving={saving}
        onCancel={() => { if (window.confirm('Are you sure about cancel family history?')) onClose(false); }}
        saveType="button"
        onSave={handleSave}
        saveLabel={isEdit ? 'Update' : 'Save'}
      />

      <Dialog visible={notesEditor.open} onHide={() => setNotesEditor({ open: false, key: null, value: '' })} header="Condition Notes" style={{ width: '30vw' }} breakpoints={{ '768px': '90vw' }}>
        <textarea className="form-control" maxLength={5000} style={{ minHeight: 120 }} value={notesEditor.value} onChange={(e) => setNotesEditor((s) => ({ ...s, value: e.target.value }))}/>
        <div className="d-flex justify-content-end gap-2 mt-3">
          <button type="button" className="btn btn-secondary rounded-pill px-4" onClick={() => setNotesEditor({ open: false, key: null, value: '' })}>Close</button>
          <button type="button" className="btn btn-primary rounded-pill px-4" onClick={saveNotes}>Save</button>
        </div>
      </Dialog>
    </div>);
};
export default PatientFamilyHistoryAddEdit;
