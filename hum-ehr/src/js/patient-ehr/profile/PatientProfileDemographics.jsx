import { useCallback, useEffect, useState } from 'react';
import { getPatientDetails, calculatePatientBMI } from '../../../services/patientProfileService';
import PatientProfileDemographicsEdit from './PatientProfileDemographicsEdit';
import { SkeletonViewDetails } from '../../../components/common/ContentLoader';
import { AccountQuestionIcon, HumanHeightIcon, LegacyIcon } from '../../../components/common/CustomIcons';

const VIEW_TABS = [
    { key: 'patient_information', label: 'Patient Details' },
    { key: 'patient_identity_information', label: 'Identity Information' },
    { key: 'patient_physical_information', label: 'Physical Information' },
    { key: 'patient_employment_information', label: 'Employment Information' },
    { key: 'patient_mortality_information', label: 'Mortality Information' },
];

const Field = ({ label, value, className = '' }) => (
    <div className="col-md-3 col-6 mb-3">
      <div className="pp-label pb-1">{label}</div>
      <div className={`fw-bold ${className}`}>{value || '-'}</div>
    </div>
);

const EditButton = ({ title, section, onEdit }) => (
    <button type="button" className="btn pp-edit-btn" title={title} onClick={() => onEdit(section)}>
      <LegacyIcon icon="mdi-pencil" className="me-1"/>Edit
    </button>
);

/**
 * Demographics tab (legacy patient-chart-demographics-*): view with five pill
 * sub-tabs, each section owning an Edit action that swaps the whole panel to
 * the tabbed edit form opened on that section.
 */
const PatientProfileDemographics = ({ patientId }) => {
    // undefined = fetching (skeleton), null = fetch failed.
    const [details, setDetails] = useState(undefined);
    const [viewTab, setViewTab] = useState('patient_information');
    const [editSection, setEditSection] = useState(null); // null = view mode

    const load = useCallback(async () => {
        setDetails(undefined);
        try { setDetails((await getPatientDetails(patientId)) || null); }
        catch (error) { console.error('Failed to fetch patient details.', error); setDetails(null); }
    }, [patientId]);
    useEffect(() => { load(); }, [load]);

    const closeEdit = (didSave) => {
        setEditSection(null);
        if (didSave) load();
    };

    if (details === undefined) return <SkeletonViewDetails avatar rows={3} cols={4}/>;
    if (!details) return <div className="alert alert-warning m-3">Patient data unavailable.</div>;

    if (editSection) {
        return <PatientProfileDemographicsEdit patientId={patientId} initialSection={editSection} onClose={closeEdit}/>;
    }

    const raceText = details.raceList?.length ? details.raceList.map((race) => race.conceptName).join(', ') : '-';
    const ethnicityText = details.ethnicityList?.length ? details.ethnicityList.map((eth) => eth.conceptName).join(', ') : '-';
    const initials = `${(details.firstName || '?')[0] || ''}${(details.lastName || '?')[0] || ''}`.toUpperCase();

    return (<div className="p-2">
      <ul className="nav nav-pills pp-soft-nav-pill d-inline-flex" role="tablist">
        {VIEW_TABS.map((tab) => (
          <li className="nav-item" key={tab.key} role="presentation">
            <button type="button" className={`nav-link ${viewTab === tab.key ? 'active' : ''}`} onClick={() => setViewTab(tab.key)}>{tab.label}</button>
          </li>
        ))}
      </ul>

      {viewTab === 'patient_information' && (<div className="px-3">
        <div className="row">
          <div className="col-md-2 d-flex justify-content-center align-items-center">
            <div className="pp-avatar-name fw-bold">{initials}</div>
          </div>
          <div className="col-md-10">
            <div className="d-flex justify-content-between align-items-center mb-2">
              <div className="fw-bold"><LegacyIcon icon="fa-user" className="me-2"/>Patient Information</div>
              <EditButton title="Edit Patient Demographics" section="patient_information" onEdit={setEditSection}/>
            </div>
            <div className="row mx-md-3 mb-2">
              <Field label="Full Name" value={details.patientName} className="text-capitalize"/>
              <Field label="Date of Birth" value={details.dateOfBirth}/>
              <Field label="Sex" value={details.genderDesc}/>
              <Field label="Preferred Name" value={details.patientPreferredName}/>
            </div>
            <div className="row mx-md-3">
              <Field label="Patient Time Zone" value={details.timeZone}/>
              <Field label="Preferred Language" value={details.patientPreferredLanguageDesc}/>
              <Field label="Patient Creation Date" value={details.patientEffectiveDate || ''}/>
            </div>
          </div>
        </div>
        <div className="mt-3">
          <div className="fw-bold mb-2"><LegacyIcon icon="mdi-account-group-outline" className="me-2"/>Race &amp; Ethnicity</div>
          <div className="row mx-md-3">
            <Field label="Race" value={raceText} className="text-capitalize"/>
            <Field label="Ethnicity" value={ethnicityText} className="text-capitalize"/>
            <Field label="Tribal Affiliation" value={details.tribalAffiliation}/>
          </div>
        </div>
      </div>)}

      {viewTab === 'patient_identity_information' && (<div className="px-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="fw-bold"><AccountQuestionIcon className="me-2"/>Identity Information</div>
          <EditButton title="Edit Identity Information" section="patient_identity_information" onEdit={setEditSection}/>
        </div>
        <div className="row mx-md-3 my-3">
          <Field label="Gender Identity" value={details.genderIdentityDesc} className="text-capitalize"/>
          <Field label="Pronouns" value={details.pronounsDesc}/>
          <Field label="Sexual Orientation" value={details.sexualOrientationDesc}/>
          <Field label="Sex Parameter for Clinical Use" value={details.sexParameterClinicalUseDesc} className="text-capitalize"/>
        </div>
        <div className="fw-bold mb-2"><LegacyIcon icon="mdi-account-details-outline" className="me-2"/>Additional Information</div>
        <div className="row mx-md-3 my-3">
          <Field label="Name Suffix" value={details.suffixName}/>
          <Field label="Previous Name" value={details.previousName}/>
          <Field label="Interpreter Needed" value={details.interpreterNeededDesc}/>
        </div>
      </div>)}

      {viewTab === 'patient_physical_information' && (<div className="px-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="fw-bold"><HumanHeightIcon className="me-2"/>Physical Information</div>
          <EditButton title="Edit Physical Information" section="patient_physical_information" onEdit={setEditSection}/>
        </div>
        <div className="row mx-md-3 my-3">
          <Field label="Height (inches)" value={details.patientHeight}/>
          <Field label="Weight (lbs)" value={details.patientWeight}/>
          <Field label="BMI" value={calculatePatientBMI(details.patientWeight, details.patientHeight)}/>
        </div>
      </div>)}

      {viewTab === 'patient_employment_information' && (<div className="px-3">
        <div className="d-flex justify-content-between align-items-center mb-2">
          <div className="fw-bold"><LegacyIcon icon="mdi-briefcase-outline" className="me-2"/>Occupational Information</div>
          <EditButton title="Edit Occupational Information" section="patient_employment_information" onEdit={setEditSection}/>
        </div>
        <div className="row mx-md-3 my-3">
          <Field label="Occupation" value={details.occupationName}/>
          <Field label="Occupation Industry" value={details.occupationIndustryName}/>
        </div>
      </div>)}

      {viewTab === 'patient_mortality_information' && (<div className="px-3">
        <div className="my-2">
          <div className="pp-label pb-1">
            Patient Status - <span className="fw-bold text-body">{details.dateOfDeath ? 'Deceased' : 'Alive'}</span>
            <LegacyIcon icon="mdi-pencil" className="ms-2" role="button" title="Edit Mortality Information" onClick={() => setEditSection('patient_mortality_information')}/>
          </div>
        </div>
        {details.dateOfDeath && (<div className="row my-3">
          <Field label="Date of Death" value={details.dateOfDeath}/>
          <Field label="Cause of Death" value={details.causeOfDeath}/>
        </div>)}
      </div>)}
    </div>);
};
export default PatientProfileDemographics;
