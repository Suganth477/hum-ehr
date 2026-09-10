import { useCallback, useEffect, useMemo, useState } from 'react';
import { useForm, Controller } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Dialog } from 'primereact/dialog';
import Swal from 'sweetalert2';
import { LegacyIcon } from '../../../components/common/CustomIcons';
import { useSectionLock } from '../../../hooks/useSectionLock';
import { userNow } from '../../../utils/dayjs';
import {
    buildHospitalizationSavePayload,
    buildHospitalizationValidatePayload,
    fetchDischargeDispositionList,
    fetchPatientDiagnosisProblems,
    savePatientHospitalization,
    validateHospitalizationUnique,
} from '../../../services/hospitalizationService';
import { fetchProblemStatusMetadata } from '../../../services/lookupService';
import { getSaveOutcome } from '../../../utils/saveResponse';
import { fetchPatientDetails } from '../../../services/patientService';
import patientCache from '../../../utils/patientCache';
import FlatpickrDateTimeInput from '../../../components/common/FlatpickrDateTimeInput';
import FormStatusFooter from '../../../components/common/FormStatusFooter';
import PatientProblemsAddEdit from '../problems/PatientProblemsAddEdit';

const OTHER_DISPOSITION = 'OTH';
// Legacy locks hospitalization under the CARE-STATUS resource code (a hospitalization IS a
// care-status record of type HOSP) — not a "HOSPITALIZATION" code.
const CONCURRENT_CODE = 'CARE-STATUS';
// Legacy notes textarea: maxlength="1000" + the length-indication counter class.
const NOTES_MAX = 1000;

// Themed confirmation (legacy utility.initJqueryPopUpConfirmationWithSelector /
// initBootstrapConfirmationPopover) — never a raw window.confirm.
const swalConfirm = Swal.mixin({
    customClass: { container: 'pp-swal-container', popup: 'pa-swal-popup', title: 'pa-swal-title', confirmButton: 'pa-swal-confirm', cancelButton: 'pa-swal-cancel' },
    buttonsStyling: false, showCancelButton: true, reverseButtons: true, allowOutsideClick: false, allowEscapeKey: false,
});

// Mirrors the legacy jQuery validation rules in patient.ehr.hospitalization.js:
//   pch_patient_chart_hospitalization_name  → required + noWhitespace
//   pch_patient_chart_hospitalization_admitted_date → required (+ date range via picker)
//   pch_patient_chart_hospitalization_other_discharged_disposition → required when disposition === OTH
//   pch_patient_chart_hospitalization_notes → required + noWhitespace
// Legacy alphaNumericWithSingleSpaceAndPunctuation (validation.add.methods.js) — hospital name
// allows alphanumerics + . , ' & / ( ) - with single spaces between words.
const HOSPITAL_NAME_REGEX = /^[a-zA-Z0-9.,'&/()-]+( [a-zA-Z0-9.,'&/()-]+)*$/;
const hospitalizationSchema = z
    .object({
        hospitalName: z.string(),
        admittedDate: z.string(),
        dischargedDate: z.string(),
        dischargeDisposition: z.string(),
        otherDischargeDisposition: z.string(),
        notes: z.string(),
    })
    .superRefine((data, ctx) => {
        if (!data.hospitalName)
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['hospitalName'], message: 'Hospitalization name is required.' });
        else if (!data.hospitalName.trim())
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['hospitalName'], message: 'Enter Valid Hospitalization Name.' });
        else if (!HOSPITAL_NAME_REGEX.test(data.hospitalName.trim()))
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['hospitalName'], message: 'Enter Valid Hospital Name.' });

        if (!data.admittedDate)
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['admittedDate'], message: 'Admitted date is required.' });

        if (data.dischargeDisposition === OTHER_DISPOSITION && !data.otherDischargeDisposition.trim())
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['otherDischargeDisposition'], message: 'Discharge Disposition is required.' });

        if (!data.notes)
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['notes'], message: 'Notes is required.' });
        else if (!data.notes.trim())
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['notes'], message: 'Enter Valid Notes.' });
    });

const buildDefaultValues = (record) => ({
    hospitalName: record?.hospitalName || '',
    admittedDate: record?.effectiveDate || '',
    dischargedDate: record?.lastEffectiveDate || '',
    dischargeDisposition: record?.dischargeDispositionCode || '',
    otherDischargeDisposition: record?.dischargeDispositionOther || '',
    notes: record?.careNotes || '',
});

const diagnosisKey = (isEncounter, id) => `${isEncounter ? 'E' : 'P'}_${id}`;
const descOfDiagnosis = (item) => item.icdDescription || item.icdCodeDescription || item.longDescription || item.snomedCode || '';

const FieldError = ({ message }) => message ? <div className="small text-danger mt-1">{message}</div> : null;

const PatientHospitalizationAddEdit = ({ patientId, hospitalizationRecord, onClose }) => {
    const isEditMode = !!hospitalizationRecord?.id;
    const [dispositions, setDispositions] = useState([]);
    const [problemList, setProblemList] = useState([]);
    const [encounterGroups, setEncounterGroups] = useState([]);
    const [diagnosisTab, setDiagnosisTab] = useState('problem');
    // selectedDiagnoses: { key, problemId, id (existing mapping id|null), isEncounter, code, description, invalidFlag }
    const [selectedDiagnoses, setSelectedDiagnoses] = useState([]);
    const [originalMappings, setOriginalMappings] = useState({});
    const [saving, setSaving] = useState(false);
    const [dateRangeError, setDateRangeError] = useState('');
    const [saveError, setSaveError] = useState(null);
    const [problemModalOpen, setProblemModalOpen] = useState(false);
    const [problemStatusMetadata, setProblemStatusMetadata] = useState(null);
    // Diagnosis chips live outside react-hook-form, so track their edits for the dirty gate.
    const [diagnosisDirty, setDiagnosisDirty] = useState(false);

    // Concurrency lock (existing records only): the hook locks on mount, heartbeats/resumes while
    // the form is open and releases on close — unless we saved, in which case the save's sessionId
    // releases it server-side. Another user already holding it shows the warning modal and closes.
    const { markSaved } = useSectionLock({
        patientId,
        resourceNavigationCode: CONCURRENT_CODE,
        sectionReferenceId: hospitalizationRecord?.id || null,
        versionId: hospitalizationRecord?.versionId ?? 0,
        enabled: isEditMode,
        onLockDenied: () => onClose(false),
    });

    const { control, handleSubmit, watch, formState: { errors, isDirty } } = useForm({
        resolver: zodResolver(hospitalizationSchema),
        defaultValues: buildDefaultValues(hospitalizationRecord),
        mode: 'onSubmit',
        reValidateMode: 'onChange',
    });
    const admittedDate = watch('admittedDate');
    const dischargeDisposition = watch('dischargeDisposition');
    const notesValue = watch('notes');
    // Upper bound = TODAY IN THE USER'S timezone (legacy utility.loggedInUserDate()), not the
    // browser's "today" — a browser a day ahead/behind would allow or block the wrong date.
    const userToday = userNow().format('MM-DD-YYYY');
    const [dob, setDob] = useState('');
    // Patient DOB → lower bound for admitted/discharged dates (legacy data-min).
    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                let details = patientCache.get(`${patientId}_details`);
                if (!details) {
                    const response = await fetchPatientDetails(patientId);
                    details = response?.status === 'success' ? response.data?.patientDetails : null;
                }
                if (!ignore && details?.dateOfBirth) setDob(details.dateOfBirth);
            }
            catch (error) { console.error('Failed to load patient details.', error); }
        })();
        return () => { ignore = true; };
    }, [patientId]);

    // ---- reference data ----
    const loadDiagnosisProblems = useCallback(async (autoSelectAgainst) => {
        const response = await fetchPatientDiagnosisProblems(patientId);
        const data = response?.status === 'success' ? response.data || {} : {};
        const problems = data.problemDiagnosisList || [];
        const encounters = data.encounterDiagnosisList || [];
        setProblemList(problems);
        setEncounterGroups(encounters);
        // Auto-select any problem that wasn't present before "Add new Diagnosis".
        if (autoSelectAgainst) {
            const previousIds = new Set(autoSelectAgainst.map((item) => String(item.diagnosisId)));
            const fresh = problems.filter((item) => !previousIds.has(String(item.diagnosisId)));
            if (fresh.length) {
                setSelectedDiagnoses((previous) => [
                    ...previous,
                    ...fresh.map((item) => ({
                        key: diagnosisKey(false, item.diagnosisId),
                        problemId: item.diagnosisId,
                        id: null,
                        isEncounter: false,
                        code: item.icdCode,
                        description: descOfDiagnosis(item),
                        invalidFlag: 'N',
                    })),
                ]);
            }
        }
        return problems;
    }, [patientId]);

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const [dispositionList] = await Promise.all([
                    fetchDischargeDispositionList(),
                    loadDiagnosisProblems(),
                ]);
                if (ignore)
                    return;
                setDispositions(dispositionList || []);
            }
            catch (error) {
                console.error('Failed to load hospitalization reference data.', error);
            }
        })();
        return () => { ignore = true; };
    }, [loadDiagnosisProblems]);

    // Pre-select existing diagnoses in edit mode.
    useEffect(() => {
        const list = hospitalizationRecord?.diagnosisList || [];
        if (!list.length)
            return;
        const mappings = {};
        const selected = list.map((problem) => {
            const isEncounter = !!problem.hevpdId;
            const problemId = isEncounter ? problem.hevpdId : problem.diagnosisId;
            const key = diagnosisKey(isEncounter, problemId);
            mappings[key] = { id: problem.id, diagnosisId: problem.diagnosisId, hevpdId: problem.hevpdId };
            return {
                key,
                problemId,
                id: problem.id ?? null,
                isEncounter,
                code: problem.icdCode,
                description: problem.longDescription || problem.snomedCode || problem.icdDescription || '',
                invalidFlag: problem.invalidFlag || 'N',
            };
        });
        setOriginalMappings(mappings);
        setSelectedDiagnoses(selected);
    }, [hospitalizationRecord]);

    const activeSelected = useMemo(() => selectedDiagnoses.filter((item) => item.invalidFlag !== 'Y'), [selectedDiagnoses]);
    const isChecked = useCallback((isEncounter, id) => activeSelected.some((item) => item.key === diagnosisKey(isEncounter, id)), [activeSelected]);

    const toggleDiagnosis = (problem, isEncounter, checked) => {
        setDiagnosisDirty(true);
        const problemId = problem.diagnosisId;
        const key = diagnosisKey(isEncounter, problemId);
        setSelectedDiagnoses((previous) => {
            const existing = previous.find((item) => item.key === key);
            if (checked) {
                if (existing)
                    return previous.map((item) => (item.key === key ? { ...item, invalidFlag: 'N' } : item));
                return [...previous, {
                    key,
                    problemId,
                    id: originalMappings[key]?.id ?? null,
                    isEncounter,
                    code: problem.icdCode,
                    description: descOfDiagnosis(problem),
                    invalidFlag: 'N',
                }];
            }
            // unchecking: keep (invalidFlag 'Y') if it maps to a saved record, else drop.
            const hasMapping = existing?.id || originalMappings[key]?.id;
            if (hasMapping)
                return previous.map((item) => (item.key === key ? { ...item, invalidFlag: 'Y' } : item));
            return previous.filter((item) => item.key !== key);
        });
    };

    const removeSelectedChip = (item) => toggleDiagnosis({ diagnosisId: item.problemId, icdCode: item.code }, item.isEncounter, false);

    // diagnosisList payload (active 'N' + removed-existing 'Y'), mirrors getEhrPatientHospitalizationSaveRequestParam.
    const buildDiagnosisPayload = () => selectedDiagnoses
        .filter((item) => item.invalidFlag === 'N' || item.id)
        .map((item) => ({
            id: item.id ? Number(item.id) : null,
            diagnosisId: item.isEncounter ? null : Number(item.problemId),
            hevpdId: item.isEncounter ? Number(item.problemId) : null,
            invalidFlag: item.invalidFlag,
        }));

    const openAddNewDiagnosis = async () => {
        if (!problemStatusMetadata) {
            try {
                setProblemStatusMetadata(await fetchProblemStatusMetadata());
            }
            catch (error) {
                console.error('Failed to load problem status metadata.', error);
            }
        }
        setProblemModalOpen(true);
    };

    const handleProblemModalClose = async (saved) => {
        setProblemModalOpen(false);
        if (saved) {
            const before = problemList;
            await loadDiagnosisProblems(before);
        }
    };

    // Legacy back-arrow guard (backButtonProps) vs the Cancel button's own popover — different
    // wording in the legacy, so keep both.
    const confirmAndClose = async (title, text) => {
        const confirmed = await swalConfirm.fire({ title, text, confirmButtonText: 'YES', cancelButtonText: 'NO' });
        if (confirmed.isConfirmed) onClose(false);
    };
    const handleBack = () => confirmAndClose('Exit Hospitalization Form', 'Are you sure about to exit hospitalization form?');
    const handleCancel = () => confirmAndClose('Cancel Hospitalization Form', 'Are you sure about cancel hospitalization form?');

    const onSubmit = async (form) => {
        setSaveError(null);
        setDateRangeError('');
        setSaving(true);
        try {
            // Server-side uniqueness check for the date range (data:"true" ⇒ unique/allowed).
            const uniqueResponse = await validateHospitalizationUnique(buildHospitalizationValidatePayload({ patientId, form, record: hospitalizationRecord }));
            if (uniqueResponse?.data !== 'true') {
                setDateRangeError('Care status already exists for the selected date range.');
                setSaving(false);
                return;
            }
            const payload = buildHospitalizationSavePayload({ patientId, form, record: hospitalizationRecord, diagnosisList: buildDiagnosisPayload() });
            const response = await savePatientHospitalization(payload);
            const outcome = getSaveOutcome(response, 'Failed to update hospitalization details. Please try again.');
            if (outcome.ok) {
                markSaved(); // the save released the lock server-side — skip the unlock on unmount
                onClose(true);
                return;
            }
            setSaveError(outcome);
        }
        catch (error) {
            console.error('Failed to save hospitalization.', error);
            setSaveError({ tone: 'error', message: error?.message || 'Failed to update hospitalization details. Please try again.' });
        }
        finally {
            setSaving(false);
        }
    };

    const fieldId = (base) => `${base}_${patientId}`;

    return (<div className="pc-patient-chart-hospitalization-add-element-wrapper">
      <form id={fieldId('pc_patient_hospitalization_add_edit_form')} autoComplete="off" className="care-plan-data-entry" onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="row">
          <div className="d-flex align-items-center gap-1">
            <button type="button" className="btn btn-link p-0 text-dark" id={fieldId('pch_add_edit_back_button')} onClick={handleBack} aria-label="Back to hospitalization list">
              <LegacyIcon icon="mdi-arrow-left" className="input-icon-left-align fs-4"/>
            </button>
            <div>
              <span className="pch-add-edit-explanation-detail-label fw-bold" style={{ fontSize: '1rem' }}><span>{isEditMode ? 'Edit' : 'Add'}</span> Hospitalization Details</span>
            </div>
          </div>
        </div>
        <div className="mx-3">
          <div className="pch-hospitalization-add-form-content px-3 p-2 mt-2 mb-3">
            <div className="row m-0 p-0">
              <div className="col-12 col-sm-6 col-md-3">
                <div className="form-group">
                  <label htmlFor={fieldId('pch_patient_chart_hospitalization_name')}>Hospital Name <span className="mandatory text-danger">*</span></label>
                  <Controller name="hospitalName" control={control} render={({ field }) => (<input type="text" id={fieldId('pch_patient_chart_hospitalization_name')} className="form-control" {...field}/>)}/>
                  <FieldError message={errors.hospitalName?.message}/>
                </div>
              </div>
            </div>
            <div className="row m-0 p-0">
              <div className="col-12 col-sm-6 col-md-3">
                <div className="form-group">
                  <label htmlFor={fieldId('pch_patient_chart_hospitalization_admitted_date')}>Admitted Date <span className="mandatory text-danger">*</span></label>
                  <Controller name="admittedDate" control={control} render={({ field }) => (<FlatpickrDateTimeInput id={fieldId('pch_patient_chart_hospitalization_admitted_date')} value={field.value} onChange={(value) => { field.onChange(value); setDateRangeError(''); }} enableTime={false} dateFormat="m-d-Y" placeholder="MM-DD-YYYY" minDate={dob || undefined} maxDate={userToday}/>)}/>
                  <FieldError message={errors.admittedDate?.message}/>
                  {dateRangeError && <div className="small text-danger mt-1">{dateRangeError}</div>}
                </div>
              </div>
              <div className="col-12 col-sm-6 col-md-3">
                <div className="form-group">
                  <label htmlFor={fieldId('pch_patient_chart_hospitalization_discharged_date')}>Discharged Date</label>
                  <Controller name="dischargedDate" control={control} render={({ field }) => (<FlatpickrDateTimeInput id={fieldId('pch_patient_chart_hospitalization_discharged_date')} value={field.value} onChange={field.onChange} enableTime={false} dateFormat="m-d-Y" placeholder="MM-DD-YYYY" minDate={admittedDate || dob || undefined} maxDate={userToday}/>)}/>
                </div>
              </div>
              <div className="col-12 col-sm-6 col-md-3">
                <div className="form-group">
                  <label htmlFor={fieldId('pch_patient_chart_hospitalization_discharged_disposition')}>Discharged Disposition</label>
                  <Controller name="dischargeDisposition" control={control} render={({ field }) => (<select id={fieldId('pch_patient_chart_hospitalization_discharged_disposition')} className="form-control form-select" {...field}>
                      <option value="">Select Discharge Disposition</option>
                      {dispositions.map((option) => <option key={option.code} value={option.code}>{option.description}</option>)}
                    </select>)}/>
                </div>
              </div>
              {dischargeDisposition === OTHER_DISPOSITION && (<div className="col-12 col-sm-6 col-md-3">
                  <div className="form-group">
                    <label htmlFor={fieldId('pch_patient_chart_hospitalization_other_discharged_disposition')}>Other Discharged Disposition <span className="mandatory text-danger">*</span></label>
                    <Controller name="otherDischargeDisposition" control={control} render={({ field }) => (<input id={fieldId('pch_patient_chart_hospitalization_other_discharged_disposition')} className="form-control" {...field}/>)}/>
                    <FieldError message={errors.otherDischargeDisposition?.message}/>
                  </div>
                </div>)}
            </div>
            <div className="row m-0 p-0">
              <div className="col-md-6">
                <div className="form-group">
                  <div className="clinical-diagnosis-option ehr-clinical-test-input-search-fields">
                    <label>Admitted Diagnosis</label>
                    <div className="ehr-order-add-new-diagnosis" onClick={openAddNewDiagnosis}>Add new Diagnosis</div>
                  </div>
                  <div id={fieldId('ehr_add_order_patient_problem_drop_down_button')} className="ehr-clinical-test-input-search-fields dropdown-toggle" data-bs-toggle="dropdown" data-bs-auto-close="outside" aria-expanded="false">Select Diagnosis</div>
                  <ul className="dropdown-menu ehr-order-problem-list-drop-down-menu">
                    <div className="ehr-order-problem-list-drop-down-menu-container">
                      <ul className="nav nav-tabs clinical-test-problem-list-container" role="tablist">
                        <li className="nav-item">
                          <button type="button" className={`nav-link ehr-order-patient-problem-tab ${diagnosisTab === 'problem' ? 'active' : ''}`} onClick={() => setDiagnosisTab('problem')}>Problem List</button>
                        </li>
                        <li className="nav-item">
                          <button type="button" className={`nav-link ehr-order-patient-encounter-problem-tab ${diagnosisTab === 'encounter' ? 'active' : ''}`} onClick={() => setDiagnosisTab('encounter')}>Encounter List</button>
                        </li>
                      </ul>
                    </div>
                    <div className="tab-content clinical-test-problem-tab-content-container">
                      {diagnosisTab === 'problem' ? (<div className="tab-pane fade show active ehr-order-patient-problem-tab-content">
                          <div className="ehr-order-problem-list-items-container">
                            {problemList.length > 0 ? problemList.map((problem) => (<div className="mx-3" key={diagnosisKey(false, problem.diagnosisId)}>
                                <div className="clinical-test-problem-list-item form-group form-check" style={{ borderBottom: '1px solid #D7DDE3' }}>
                                  <input type="checkbox" className="ehr-add-order-problem-item-input form-check-input mx-2" checked={isChecked(false, problem.diagnosisId)} onChange={(event) => toggleDiagnosis(problem, false, event.target.checked)}/>
                                  <div className="clinical-test-problem-item-content">
                                    <span className="clinical-test-problem-code">{problem.icdCode}</span>
                                    <span className="clinical-test-problem-description"> {descOfDiagnosis(problem)}</span>
                                  </div>
                                </div>
                              </div>)) : (<div style={{ display: 'flex', alignItems: 'center', height: 100, justifyContent: 'center', gap: 4 }}><LegacyIcon icon="mdi-information-outline"/> The patient doesn't have any diagnosis yet! </div>)}
                          </div>
                        </div>) : (<div className="tab-pane fade show active ehr-order-patient-encounter-problem-tab-content">
                          <div className="ehr-order-encounter-problem-list-items-container">
                            {encounterGroups.length > 0 ? encounterGroups.map((encounter, encIndex) => (<div className="ehr-order-encounter-problem-list-items p-2 mb-2" key={encIndex}>
                                <div className="d-flex pb-2"><div className="ehr-order-encounter-problem-list-labels">Encounter Date &amp; Time: </div><div className="ehr-order-encounter-problem-list-values ms-1">{encounter.recordedDate}</div></div>
                                <div className="d-flex pb-2"><div className="ehr-order-encounter-problem-list-labels">Visit Reasons: </div><div className="ehr-order-encounter-problem-list-values ms-1">{encounter.visitReason}</div></div>
                                <div>
                                  <div className="ehr-order-encounter-problem-list-labels">Diagnosis List</div>
                                  <div className="ehr-order-encounter-problem-list-container">
                                    {(encounter.encounterDiagnosisList || []).map((problem) => (<div className="mx-3" key={diagnosisKey(true, problem.diagnosisId)}>
                                        <div className="clinical-test-problem-list-item form-group form-check">
                                          <input type="checkbox" className="ehr-add-order-problem-item-input form-check-input mx-2" checked={isChecked(true, problem.diagnosisId)} onChange={(event) => toggleDiagnosis(problem, true, event.target.checked)}/>
                                          <div className="clinical-test-problem-item-content">
                                            <span className="clinical-test-problem-code">{problem.icdCode}</span>
                                            <span className="clinical-test-problem-description"> {descOfDiagnosis(problem)}</span>
                                          </div>
                                        </div>
                                      </div>))}
                                  </div>
                                </div>
                              </div>)) : (<div style={{ display: 'flex', alignItems: 'center', height: 100, justifyContent: 'center', gap: 4 }}><LegacyIcon icon="mdi-information-outline"/> The patient doesn't have any encounter diagnosis yet! </div>)}
                          </div>
                        </div>)}
                    </div>
                  </ul>
                  <div className="ehr-add-order-selected-problems-container mt-2 ehr-clinical-test-input-search-fields">
                    {activeSelected.map((item) => (<div className="ehr-add-order-selected-problems" key={item.key}>
                        <div className="clinical-test-selected-problemes-code-description">
                          <div className="ehr-add-order-selected-problems-code">{item.code}</div>
                          <div className="ehr-add-order-selected-problems-description">{item.description}</div>
                        </div>
                        <div className="clinical-test-selected-problem-remove-container">
                          <span><LegacyIcon icon="fa-times" className="ehr-add-order-selected-problem-remove-icon" onClick={() => removeSelectedChip(item)}/></span>
                        </div>
                      </div>))}
                  </div>
                </div>
              </div>
            </div>
            <div className="row m-0 p-0">
              <div className="form-group">
                <label htmlFor={fieldId('pch_patient_chart_hospitalization_notes')}>Notes <span className="mandatory text-danger">*</span></label>
                <Controller name="notes" control={control} render={({ field }) => (<textarea id={fieldId('pch_patient_chart_hospitalization_notes')} className="form-control length-indication" maxLength={NOTES_MAX} {...field}/>)}/>
                <div className="d-flex justify-content-between">
                  <FieldError message={errors.notes?.message}/>
                  <label className="text-muted small mb-0 ms-auto">({(notesValue || '').length}/{NOTES_MAX})</label>
                </div>
              </div>
            </div>
            {saveError && (<div className="row m-0 p-0">
                <div className={`small mt-1 ${saveError.tone === 'warning' ? 'text-warning' : 'text-danger'}`}>
                  <LegacyIcon icon="fa-exclamation-triangle" className="me-1"/>{saveError.message}
                </div>
              </div>)}
            <FormStatusFooter
              dirty={isDirty || diagnosisDirty}
              saving={saving}
              onCancel={handleCancel}
              saveLabel="Save"
            />
          </div>
        </div>
      </form>

      <Dialog visible={problemModalOpen} onHide={() => setProblemModalOpen(false)} header="Add Diagnosis" style={{ width: '70vw' }} breakpoints={{ '768px': '95vw' }}>
        {problemStatusMetadata && (<PatientProblemsAddEdit patientId={patientId} problemRecord={null} actionType="create" statusMetadata={problemStatusMetadata} onClose={handleProblemModalClose}/>)}
      </Dialog>
    </div>);
};
export default PatientHospitalizationAddEdit;
