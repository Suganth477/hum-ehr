import { useEffect, useMemo, useRef, useState } from 'react';
import moment, { userNow } from '../../../utils/dayjs';
import AsyncSelect from 'react-select/async';
import {
    getPatientDetails, refreshPatientDetails, fetchDemographicsHumCodes, fetchProfileTimeZones,
    fetchEthnicityLookup, fetchRaceLookupPage, fetchLanguageLookupPage, fetchOccupationLookupPage,
    fetchOccupationIndustryLookupPage, saveDemographics, buildDemographicsSavePayload, calculatePatientBMI,
} from '../../../services/patientProfileService';
import FlatpickrDateTimeInput from '../../../components/common/FlatpickrDateTimeInput';
import PaginatedLookupSelect from '../../../components/common/PaginatedLookupSelect';
import { SkeletonViewDetails } from '../../../components/common/ContentLoader';
import { useNotify } from '../../../context/NotificationContext';
import { AccountQuestionIcon, HumanHeightIcon, LegacyIcon } from '../../../components/common/CustomIcons';

const EDIT_TABS = [
    { key: 'patient_information', label: 'Patient Details', next: 'patient_identity_information' },
    { key: 'patient_identity_information', label: 'Identity Information', next: 'patient_physical_information' },
    { key: 'patient_physical_information', label: 'Physical Information', next: 'patient_employment_information' },
    { key: 'patient_employment_information', label: 'Employment Information', next: 'patient_mortality_information' },
    { key: 'patient_mortality_information', label: 'Mortality Information', next: null },
];
// Which form fields live on which tab - used to jump to the first tab with an error.
const TAB_FIELDS = {
    patient_information: ['firstName', 'middleName', 'lastName', 'gender', 'dateOfBirth', 'timeZone', 'preferredLanguageCode', 'preferredName', 'race', 'ethnicity', 'tribalAffiliation'],
    patient_identity_information: ['suffixName', 'previousName'],
    patient_physical_information: ['patientHeight', 'patientWeight'],
    patient_employment_information: [],
    patient_mortality_information: ['dateOfDeath', 'causeOfDeath'],
};

const FieldError = ({ message }) => (message ? <div className="small text-danger mt-1">{message}</div> : null);
const ALPHA_NUM_SPACE = /^[a-zA-Z0-9 ]+$/;

const humCodeOptions = (map = {}, omit = []) => Object.values(map || {})
    .filter((item) => item && !omit.includes(item.code))
    .map((item) => ({ code: item.code, description: item.description }));

const ChipList = ({ items, onRemove }) => (items.length ? (
    <div className="pp-selected-chip-container mt-2">
      {items.map((item) => (
        <span className="pp-selected-chip text-capitalize" key={item.conceptCode}>
          <span>{item.conceptName}{item.conceptCode !== 'ASKU' && item.categoryName ? ` - ${item.categoryName}` : ''}</span>
          <LegacyIcon icon="mdi-close-circle-outline" className="pp-chip-remove" role="button" onClick={() => onRemove(item.conceptCode)}/>
        </span>
      ))}
    </div>
) : null);

// Hoisted so re-renders don't remount the subtree (an inline component type
// changes identity every render, which resets DOM state and input focus).
const Section = ({ icon, IconComp, title, children }) => (
    <div className="d-flex gap-3">
      <div className="d-flex flex-column align-items-center">
        {IconComp
          ? <span style={{ fontSize: 20, lineHeight: 1 }}><IconComp/></span>
          : <LegacyIcon icon={icon} style={{ fontSize: 20 }}/>}
        <div className="pp-demographics-sections-connector flex-grow-1"/>
      </div>
      <div className="flex-grow-1">
        <span>{title}</span>
        <div className="pp-demographics-sections">{children}</div>
      </div>
    </div>
);

const ActionButtons = ({ saving, nextTab, onCancel, onSave, showContinue = true }) => (
    <div className="d-flex justify-content-end gap-2 mt-3 flex-wrap">
      <button type="button" className="btn pp-cancel-btn" disabled={saving} onClick={onCancel}>Cancel</button>
      <button type="button" className="btn btn-primary rounded-pill" style={{ width: 'fit-content' }} disabled={saving} onClick={() => onSave(null)}>{saving ? 'Saving...' : 'Save & Exit'}</button>
      {showContinue && nextTab && (
        <button type="button" className="btn btn-primary rounded-pill bs-modal-save-btn" style={{ width: 'fit-content' }} disabled={saving} onClick={() => onSave(nextTab)}>{saving ? 'Saving...' : 'Save & Continue'}</button>
      )}
    </div>
);

/**
 * Demographics edit (legacy patient-chart-demographics-edit): five-tab form,
 * per-tab Save & Exit / Save & Continue (payload carries moveNextTab), race &
 * ethnicity chip pickers with the ASKU exclusivity rule, and the deceased
 * branch that requires date + cause of death. A save with a date of death
 * deactivates the patient (the workspace tab is closed, like legacy).
 */
const PatientProfileDemographicsEdit = ({ patientId, initialSection, onClose }) => {
    const { notifySuccess, notifyError } = useNotify();
    const [activeTab, setActiveTab] = useState(initialSection || 'patient_information');
    const [details, setDetails] = useState(null);
    const [humCodes, setHumCodes] = useState({});
    const [timeZones, setTimeZones] = useState([]);
    const ethnicityLookupRef = useRef([]);
    const [form, setForm] = useState(null);
    const [raceList, setRaceList] = useState([]);
    const [ethnicityList, setEthnicityList] = useState([]);
    const [errors, setErrors] = useState({});
    const [saving, setSaving] = useState(false);
    const [dirty, setDirty] = useState(false);

    useEffect(() => {
        let ignore = false;
        (async () => {
            try {
                const [patientDetails, codes, zones, ethnicity] = await Promise.all([
                    getPatientDetails(patientId), fetchDemographicsHumCodes(), fetchProfileTimeZones(), fetchEthnicityLookup(),
                ]);
                if (ignore) return;
                ethnicityLookupRef.current = ethnicity;
                setDetails(patientDetails);
                setHumCodes(codes);
                setTimeZones(zones);
                setRaceList((patientDetails.raceList || []).map((race) => ({ ...race })));
                setEthnicityList((patientDetails.ethnicityList || []).map((eth) => ({ ...eth })));
                setForm({
                    firstName: patientDetails.firstName || '',
                    middleName: patientDetails.middleName || '',
                    lastName: patientDetails.lastName || '',
                    preferredName: patientDetails.patientPreferredName || '',
                    gender: patientDetails.gender || '',
                    dateOfBirth: patientDetails.dateOfBirth || '',
                    timeZone: patientDetails.timeZone || '',
                    preferredLanguageCode: patientDetails.patientPreferredLanguageCode || '',
                    preferredLanguageDesc: patientDetails.patientPreferredLanguageDesc || '',
                    tribalAffiliation: patientDetails.tribalAffiliation || '',
                    genderIdentity: patientDetails.genderIdentityCode || '',
                    pronouns: patientDetails.pronounsCode || '',
                    sexualOrientation: patientDetails.sexualOrientationCode || '',
                    sexParameterForClinicalUse: patientDetails.sexParameterClinicalUseCode || '',
                    suffixName: patientDetails.suffixName || '',
                    previousName: patientDetails.previousName || '',
                    interpreterNeeded: patientDetails.interpreterNeededCode || '',
                    patientHeight: patientDetails.patientHeight ? String(patientDetails.patientHeight) : '',
                    patientWeight: patientDetails.patientWeight ? String(patientDetails.patientWeight) : '',
                    occupationId: patientDetails.occupationId || '',
                    occupationName: patientDetails.occupationName || '',
                    occupationIndustryId: patientDetails.occupationIndustryId || '',
                    occupationIndustryName: patientDetails.occupationIndustryName || '',
                    deceased: patientDetails.dateOfDeath ? 'N' : 'Y',
                    dateOfDeath: patientDetails.dateOfDeath || '',
                    causeOfDeath: patientDetails.causeOfDeath || '',
                });
            }
            catch (error) { console.error('Failed to load demographics form data.', error); notifyError('Failed to fetch the details required to edit demographics. Please try again.'); }
        })();
        return () => { ignore = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [patientId]);

    const update = (patch) => { setForm((prev) => ({ ...prev, ...patch })); setDirty(true); };
    const clearError = (key) => setErrors((prev) => { if (!prev[key]) return prev; const next = { ...prev }; delete next[key]; return next; });

    // ---- lookups ----
    // Race / language / occupation / industry are server-paginated (scroll-to-bottom
    // appends the next 50 — PaginatedLookupSelect). Ethnicity is a one-shot list
    // filtered client-side, matching legacy.
    const loadEthnicity = (input) => Promise.resolve(ethnicityLookupRef.current
        .filter((option) => option.value.toLowerCase().includes((input || '').toLowerCase()))
        .slice(0, 50)
        .map((option) => ({ value: option.code, label: option.value, categoryName: option.categoryName })));

    const addConcept = (option, list, setList, kind) => {
        if (!option) return;
        if (list.some((item) => item.conceptCode === option.value)) {
            setErrors((prev) => ({ ...prev, [kind]: kind === 'race' ? 'Race already added.' : 'Ethnicity already added.' }));
            return;
        }
        clearError(kind);
        // ASKU ("Asked but unknown") is exclusive: it clears every other selection.
        const entry = { conceptCode: option.value, conceptName: option.label, categoryName: option.categoryName };
        setList(option.value === 'ASKU' ? [entry] : [...list.filter((item) => item.conceptCode !== 'ASKU'), entry]);
        setDirty(true);
    };

    const yesterday = useMemo(() => userNow().subtract(1, 'day').format('MM-DD-YYYY'), []);

    // ---- validation (legacy rules + messages) ----
    const validate = () => {
        const next = {};
        const name = (value) => value.trim();
        if (!name(form.firstName)) next.firstName = "Please enter the patient's first name.";
        else if (form.firstName.length > 25) next.firstName = 'Maximum 25 characters.';
        else if (!ALPHA_NUM_SPACE.test(form.firstName.trim())) next.firstName = 'Only alphabets and numbers are allowed.';
        if (form.middleName && (form.middleName.length > 25 || !ALPHA_NUM_SPACE.test(form.middleName))) next.middleName = form.middleName.length > 25 ? 'Maximum 25 characters.' : 'Only alphabets and numbers are allowed.';
        if (!name(form.lastName)) next.lastName = "Please enter the patient's last name.";
        else if (form.lastName.length > 25) next.lastName = 'Maximum 25 characters.';
        else if (!ALPHA_NUM_SPACE.test(form.lastName.trim())) next.lastName = 'Only alphabets and numbers are allowed.';
        if (form.preferredName && form.preferredName.length > 25) next.preferredName = 'Maximum 25 characters.';
        if (!form.gender) next.gender = "Please select the patient's gender.";
        if (!form.dateOfBirth) next.dateOfBirth = "Please provide the patient's date of birth.";
        else if (moment(form.dateOfBirth, 'MM-DD-YYYY').isBefore(moment('01-01-1900', 'MM-DD-YYYY'))) next.dateOfBirth = 'Date of birth should be greater than 01-01-1900.';
        else if (form.dateOfDeath && moment(form.dateOfBirth, 'MM-DD-YYYY').isAfter(moment(form.dateOfDeath, 'MM-DD-YYYY'))) next.dateOfBirth = 'Birth date must be before death date.';
        if (!form.timeZone) next.timeZone = "Please select the patient's time Zone.";
        if (!form.preferredLanguageCode) next.preferredLanguageCode = "Please select the patient's preferred language.";
        if (!raceList.length) next.race = 'Please select a race from the search list.';
        if (!ethnicityList.length) next.ethnicity = 'Please select an ethnicity from the search list.';
        if (form.tribalAffiliation && form.tribalAffiliation.length > 255) next.tribalAffiliation = 'Maximum 255 characters.';
        if (form.suffixName && form.suffixName.length > 25) next.suffixName = 'Maximum 25 characters.';
        if (form.previousName && form.previousName.length > 25) next.previousName = 'Maximum 25 characters.';
        if (!form.patientHeight) next.patientHeight = "Patient enter the patient's height";
        else if (!/^[1-9][0-9]{1,2}$/.test(form.patientHeight)) next.patientHeight = form.patientHeight.length < 2 || form.patientHeight.length > 3 ? 'Please enter a value between 10 and 999.' : 'Invalid value.';
        if (form.patientWeight) {
            if (!/^\d+(\.\d+)?$/.test(form.patientWeight)) next.patientWeight = 'Invalid value.';
            else if (form.patientWeight.length < 2 || form.patientWeight.length > 3) next.patientWeight = 'Please enter a value between 10 and 999.';
        }
        if (form.deceased === 'N') {
            if (!form.dateOfDeath) next.dateOfDeath = 'Please enter the Date of Death.';
            if (!form.causeOfDeath.trim()) next.causeOfDeath = 'Please provide the Cause of Death.';
            else if (form.causeOfDeath.length > 500) next.causeOfDeath = 'Maximum 500 characters.';
        }
        return next;
    };

    const handleSave = async (moveNextTab) => {
        const validation = validate();
        setErrors(validation);
        if (Object.keys(validation).length) {
            // Jump to the first tab containing an error (legacy showErrorFields).
            const errorTab = EDIT_TABS.find((tab) => TAB_FIELDS[tab.key].some((field) => validation[field]));
            if (errorTab && errorTab.key !== activeTab) setActiveTab(errorTab.key);
            return;
        }
        setSaving(true);
        try {
            const payload = buildDemographicsSavePayload({
                patientId, patientDetails: details, raceList, ethnicityList, moveNextTab,
                form: { ...form, dateOfDeath: form.deceased === 'N' ? form.dateOfDeath : '', causeOfDeath: form.deceased === 'N' ? form.causeOfDeath : '' },
            });
            const response = await saveDemographics(payload);
            if (response?.status === 'success') {
                notifySuccess('Patient demographic information has been updated successfully.');
                if (payload.dateOfDeath) {
                    // Deceased patients are auto-deactivated: close the workspace tab (legacy behavior).
                    window.dispatchEvent(new CustomEvent('hum-ehr:closePatientTab', { detail: { patientId } }));
                    return;
                }
                await refreshPatientDetails(patientId);
                setDirty(false);
                if (moveNextTab) setActiveTab(moveNextTab);
                else onClose(true);
            }
            else if (response?.status === 'warning') {
                const fieldName = response.data?.[0]?.fieldName;
                const message = response.data?.[0]?.errorMessage || 'Patient already exists.';
                setErrors((prev) => ({ ...prev, [fieldName === 'firstName' ? 'firstName' : 'lastName']: message }));
                setActiveTab('patient_information');
            }
            else notifyError('Failed to update patient demographics information. Please try again.');
        }
        catch (error) {
            console.error('Failed to save demographics.', error);
            notifyError('Failed to update patient demographics information. Please try again.');
        }
        finally { setSaving(false); }
    };

    const handleCancel = () => {
        if (!dirty || window.confirm('Are you sure you want to cancel?')) onClose(false);
    };

    if (!form) return <SkeletonViewDetails rows={3} cols={4}/>;

    const selectProps = { classNamePrefix: 'react-select', isClearable: true, cacheOptions: true, defaultOptions: true };
    const genderOptions = humCodeOptions(humCodes['PATI-GENDER'], ['BOTH']);
    const currentTab = EDIT_TABS.find((tab) => tab.key === activeTab);
    const actionProps = { saving, nextTab: currentTab?.next, onCancel: handleCancel, onSave: handleSave };

    return (<div className="p-3" id={`patient_profile_demographics_edit_${patientId}`}>
      <ul className="nav nav-pills pp-soft-nav-pill d-inline-flex" role="tablist">
        {EDIT_TABS.map((tab) => (
          <li className="nav-item" key={tab.key} role="presentation">
            <button type="button" className={`nav-link ${activeTab === tab.key ? 'active' : ''}`} onClick={() => setActiveTab(tab.key)}>{tab.label}</button>
          </li>
        ))}
      </ul>
      <form autoComplete="off" onSubmit={(e) => e.preventDefault()} noValidate>
        {activeTab === 'patient_information' && (<div>
          <Section icon="mdi-account" title="Patient Identity">
            <div className="row g-3 mb-2">
              <div className="col-md-3">
                <label>First Name <span className="text-danger">*</span></label>
                <input type="text" className="form-control text-capitalize" maxLength={50} value={form.firstName} onChange={(e) => { update({ firstName: e.target.value }); clearError('firstName'); }}/>
                <FieldError message={errors.firstName}/>
              </div>
              <div className="col-md-3">
                <label>Middle Name</label>
                <input type="text" className="form-control text-capitalize" maxLength={50} value={form.middleName} onChange={(e) => { update({ middleName: e.target.value }); clearError('middleName'); }}/>
                <FieldError message={errors.middleName}/>
              </div>
              <div className="col-md-3">
                <label>Last Name <span className="text-danger">*</span></label>
                <input type="text" className="form-control text-capitalize" maxLength={50} value={form.lastName} onChange={(e) => { update({ lastName: e.target.value }); clearError('lastName'); }}/>
                <FieldError message={errors.lastName}/>
              </div>
              <div className="col-md-3">
                <label>Sex <span className="text-danger">*</span></label>
                <select className="form-select" value={form.gender} onChange={(e) => { update({ gender: e.target.value }); clearError('gender'); }}>
                  <option value="">Select Patient&apos;s Gender</option>
                  {genderOptions.map((option) => <option key={option.code} value={option.code}>{option.description}</option>)}
                </select>
                <FieldError message={errors.gender}/>
              </div>
            </div>
            <div className="row g-3">
              <div className="col-md-3">
                <label>Date of Birth <span className="text-danger">*</span></label>
                <FlatpickrDateTimeInput value={form.dateOfBirth} enableTime={false} dateFormat="m-d-Y" placeholder="MM-DD-YYYY"
                  minDate="01-01-1900" maxDate={form.dateOfDeath || yesterday}
                  onChange={(val) => { update({ dateOfBirth: val }); clearError('dateOfBirth'); }}/>
                <FieldError message={errors.dateOfBirth}/>
              </div>
              <div className="col-md-3">
                <label>Time Zone <span className="text-danger">*</span></label>
                <select className="form-select" value={form.timeZone} onChange={(e) => { update({ timeZone: e.target.value }); clearError('timeZone'); }}>
                  <option value="">Select Time Zone</option>
                  {timeZones.map((zone) => <option key={zone.code} value={zone.code}>{zone.description}</option>)}
                </select>
                <FieldError message={errors.timeZone}/>
              </div>
              <div className="col-md-3">
                <label>Preferred Language <span className="text-danger">*</span></label>
                <PaginatedLookupSelect fetchPage={fetchLanguageLookupPage}
                  value={form.preferredLanguageCode ? { value: form.preferredLanguageCode, label: form.preferredLanguageDesc } : null}
                  onChange={(option) => { update({ preferredLanguageCode: option?.value || '', preferredLanguageDesc: option?.label || '' }); clearError('preferredLanguageCode'); }}/>
                <FieldError message={errors.preferredLanguageCode}/>
              </div>
              <div className="col-md-3">
                <label>Preferred Name</label>
                <input type="text" className="form-control" placeholder="Preferred Name" value={form.preferredName} onChange={(e) => { update({ preferredName: e.target.value }); clearError('preferredName'); }}/>
                <FieldError message={errors.preferredName}/>
              </div>
            </div>
          </Section>
          <Section icon="mdi-account-group-outline" title="Race & Ethnicity">
            <div className="row g-3">
              <div className="col-md-4">
                <label>Race <span className="text-danger">*</span></label>
                <PaginatedLookupSelect fetchPage={fetchRaceLookupPage} value={null}
                  isDisabled={raceList.some((item) => item.conceptCode === 'ASKU')}
                  onChange={(option) => addConcept(option, raceList, setRaceList, 'race')}/>
                <FieldError message={errors.race}/>
                <ChipList items={raceList} onRemove={(code) => { setRaceList(raceList.filter((item) => item.conceptCode !== code)); setDirty(true); }}/>
              </div>
              <div className="col-md-4">
                <label>Ethnicity <span className="text-danger">*</span></label>
                <AsyncSelect {...selectProps} placeholder="Type/Search Here" loadOptions={loadEthnicity} value={null}
                  isDisabled={ethnicityList.some((item) => item.conceptCode === 'ASKU')}
                  onChange={(option) => addConcept(option, ethnicityList, setEthnicityList, 'ethnicity')}/>
                <FieldError message={errors.ethnicity}/>
                <ChipList items={ethnicityList} onRemove={(code) => { setEthnicityList(ethnicityList.filter((item) => item.conceptCode !== code)); setDirty(true); }}/>
              </div>
              <div className="col-md-4">
                <label>Tribal Affiliation</label>
                <input type="text" className="form-control" maxLength={255} value={form.tribalAffiliation} onChange={(e) => { update({ tribalAffiliation: e.target.value }); clearError('tribalAffiliation'); }}/>
                <FieldError message={errors.tribalAffiliation}/>
              </div>
            </div>
          </Section>
          <ActionButtons {...actionProps}/>
        </div>)}

        {activeTab === 'patient_identity_information' && (<div>
          <Section IconComp={AccountQuestionIcon} title="Identity Information">
            <div className="row g-3">
              <div className="col-md-3">
                <label>Gender Identity</label>
                <select className="form-select" value={form.genderIdentity} onChange={(e) => update({ genderIdentity: e.target.value })}>
                  <option value="">Select Gender Identity</option>
                  {humCodeOptions(humCodes['GENDER-IDENTITY']).map((option) => <option key={option.code} value={option.code}>{option.description}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label>Pronouns</label>
                <select className="form-select" style={{ textTransform: 'none' }} value={form.pronouns} onChange={(e) => update({ pronouns: e.target.value })}>
                  <option value="">Select Pronouns</option>
                  {humCodeOptions(humCodes['PATI-PRONOUNS']).map((option) => <option key={option.code} value={option.code}>{option.description}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label>Sexual Orientation</label>
                <select className="form-select" value={form.sexualOrientation} onChange={(e) => update({ sexualOrientation: e.target.value })}>
                  <option value="">Select Sexual Orientation</option>
                  {humCodeOptions(humCodes['SEXUAL-ORIENTATION']).map((option) => <option key={option.code} value={option.code}>{option.description}</option>)}
                </select>
              </div>
              <div className="col-md-3">
                <label>Sex Parameter for Clinical Use</label>
                <select className="form-select" value={form.sexParameterForClinicalUse} onChange={(e) => update({ sexParameterForClinicalUse: e.target.value })}>
                  <option value="">Select Sex Parameter for Clinical Use</option>
                  {humCodeOptions(humCodes['SEX-PARAMETER-CLINICAL-USE']).map((option) => <option key={option.code} value={option.code}>{option.description}</option>)}
                </select>
              </div>
            </div>
          </Section>
          <Section icon="mdi-account-details-outline" title="Additional Information">
            <div className="row g-3">
              <div className="col-md-3">
                <label>Name Suffix</label>
                <input type="text" className="form-control" placeholder="Suffix Name" value={form.suffixName} onChange={(e) => { update({ suffixName: e.target.value }); clearError('suffixName'); }}/>
                <FieldError message={errors.suffixName}/>
              </div>
              <div className="col-md-3">
                <label>Previous Name</label>
                <input type="text" className="form-control" placeholder="Previous Name" value={form.previousName} onChange={(e) => { update({ previousName: e.target.value }); clearError('previousName'); }}/>
                <FieldError message={errors.previousName}/>
              </div>
              <div className="col-md-3">
                <label>Interpreter Needed</label>
                <select className="form-select" value={form.interpreterNeeded} onChange={(e) => update({ interpreterNeeded: e.target.value })}>
                  <option value="">Select Interpreter Needed</option>
                  {humCodeOptions(humCodes['INTERPRETER-NEEDED']).map((option) => <option key={option.code} value={option.code}>{option.description}</option>)}
                </select>
              </div>
            </div>
          </Section>
          <ActionButtons {...actionProps}/>
        </div>)}

        {activeTab === 'patient_physical_information' && (<div>
          <Section IconComp={HumanHeightIcon} title="Physical Details">
            <div className="row g-3">
              <div className="col-md-3">
                <label>Height (inches) <span className="text-danger">*</span></label>
                <input type="text" className="form-control" placeholder="Height" maxLength={3} value={form.patientHeight} onChange={(e) => { update({ patientHeight: e.target.value }); clearError('patientHeight'); }}/>
                <FieldError message={errors.patientHeight}/>
              </div>
              <div className="col-md-3">
                <label>Weight (lbs)</label>
                <input type="text" className="form-control" placeholder="Weight" maxLength={3} value={form.patientWeight} onChange={(e) => { update({ patientWeight: e.target.value }); clearError('patientWeight'); }}/>
                <FieldError message={errors.patientWeight}/>
              </div>
              <div className="col-md-3">
                <label>BMI</label>
                <input type="text" className="form-control" placeholder="BMI" disabled value={calculatePatientBMI(form.patientWeight, form.patientHeight)}/>
              </div>
            </div>
          </Section>
          <ActionButtons {...actionProps}/>
        </div>)}

        {activeTab === 'patient_employment_information' && (<div>
          <Section icon="mdi-briefcase-outline" title="Occupational Information">
            <div className="row g-3">
              <div className="col-md-4">
                <label>Occupation</label>
                <PaginatedLookupSelect fetchPage={fetchOccupationLookupPage}
                  value={form.occupationId ? { value: form.occupationId, label: form.occupationName } : null}
                  onChange={(option) => update({ occupationId: option?.value || '', occupationName: option?.label || '' })}/>
              </div>
              <div className="col-md-4">
                <label>Occupation Industry</label>
                <PaginatedLookupSelect fetchPage={fetchOccupationIndustryLookupPage}
                  value={form.occupationIndustryId ? { value: form.occupationIndustryId, label: form.occupationIndustryName } : null}
                  onChange={(option) => update({ occupationIndustryId: option?.value || '', occupationIndustryName: option?.label || '' })}/>
              </div>
            </div>
          </Section>
          <ActionButtons {...actionProps}/>
        </div>)}

        {activeTab === 'patient_mortality_information' && (<div style={{ padding: 10 }}>
          <div className="d-flex gap-5 mb-2 align-items-center">
            <label>Patient Status</label>
            <div className="d-flex gap-4">
              <label className="d-flex align-items-center gap-1">
                <input type="radio" name={`patient_deceased_${patientId}`} value="Y" disabled={!!details.dateOfDeath}
                  checked={form.deceased === 'Y'} onChange={() => update({ deceased: 'Y' })}/> Alive
              </label>
              <label className="d-flex align-items-center gap-1">
                <input type="radio" name={`patient_deceased_${patientId}`} value="N" disabled={!!details.dateOfDeath}
                  checked={form.deceased === 'N'} onChange={() => update({ deceased: 'N' })}/> Deceased
              </label>
            </div>
          </div>
          {form.deceased === 'N' && (<div className="row g-3">
            <div className="col-md-3">
              <label>Date of Death <span className="text-danger">*</span></label>
              <FlatpickrDateTimeInput value={form.dateOfDeath} enableTime={false} dateFormat="m-d-Y" placeholder="MM-DD-YYYY"
                minDate={form.dateOfBirth || undefined} maxDate={yesterday}
                onChange={(val) => { update({ dateOfDeath: val }); clearError('dateOfDeath'); }}/>
              <FieldError message={errors.dateOfDeath}/>
            </div>
            <div className="col-md-6">
              <label>Cause Of Death <span className="text-danger">*</span></label>
              <textarea className="form-control" maxLength={500} value={form.causeOfDeath} onChange={(e) => { update({ causeOfDeath: e.target.value }); clearError('causeOfDeath'); }}/>
              <div className="text-end"><label>({form.causeOfDeath.trim().length}/500)</label></div>
              <FieldError message={errors.causeOfDeath}/>
            </div>
            <div className="col-md-12" style={{ color: 'rgb(246, 85, 13)' }}>Note: Deceased Patient will be Automatically Deactivated.</div>
          </div>)}
          <ActionButtons {...actionProps} showContinue={false}/>
        </div>)}
      </form>
    </div>);
};
export default PatientProfileDemographicsEdit;
