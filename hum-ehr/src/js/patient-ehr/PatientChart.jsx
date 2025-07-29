import React, { useState, useEffect } from 'react';

import useUtilities  from './../app/utility';
import env from '../../env';
import Cookies from 'js-cookie';


const PatientDemographics = ({ patientId}) => {
  const [patientDetails, setPatientDetails] = useState(null);

  const { ageCalculator, displayAddressInUSFormat, failureMessage } = useUtilities();


  useEffect(() => {
    const fetchDetails = async () => {
      try {
        const token = Cookies.get("X-Auth-Token");
        const formData = new FormData();
        formData.append("patientId", patientId);
        const response = await fetch(`${env.BASE_URL}/patient/details`, {
          method: "POST",
          headers: {
            "x-auth-token": token,
          },
          body: formData,
        });
        const data = await response.json();
        if (data.status === "success") {
          setPatientDetails(data.data);
        }
      } catch (error) {
        console.error(error);
        failureMessage("Error fetching patient details");
      }
    };
    if (patientId) {
      fetchDetails();
    }
  }, [patientId]);

  //patient details is failed it will return empty div
  if (!patientDetails) return <div></div>;

  const {
    patientName, emrId, genderDesc, dateOfBirth, gender, email,
    addressLineOne, addressLineTwo, city, state, zipCode,
    mobilePhoneNumber, homePhoneNumber, workPhoneNumber
  } = patientDetails.patientDetails;

  return (
    <div className="pd-patient-demographics-main-container">
      <div className="pd-patient-profile-picture">
        <img className="pd-patient-image profile-image" src="/src/assets/images/doctor.jpeg" alt="Doctor" />
      </div>
      <div className="pd-patient-demographics-details">
        <div className="pd-patient-demographics-list">
          <div className="pd-patient-demographics-list-item">
            <span className="pd-patient-demographics-icon"></span>
            <span className="pd-patient-demographics-data text-capitalize patient-name">{patientName}</span>
          </div>
          <div className="pd-patient-demographics-list-item">
            <span className="pd-patient-demographics-icon mdi mdi-calendar-month-outline"></span>
            <span className="pd-patient-demographics-data">{dateOfBirth} ({ageCalculator(dateOfBirth)}yrs)</span>
          </div>
          <div className="pd-patient-demographics-list-item">
            <span className={`pd-patient-demographics-icon mdi mdi-gender-${gender}`}></span>
            <span className="pd-patient-demographics-data">{genderDesc}</span>
          </div>
          <div className="pd-patient-demographics-list-item">
            <span className="pd-patient-demographics-icon"></span>
            <span className="pd-patient-demographics-data">{emrId}</span>
          </div>
          {mobilePhoneNumber && (
            <div className="pd-patient-demographics-list-item">
              <span className="pd-patient-demographics-icon mdi mdi-phone-outline"></span>
              <span className="pd-patient-demographics-data">{mobilePhoneNumber}</span>
            </div>
          )}
          {homePhoneNumber && (
            <div className="pd-patient-demographics-list-item">
              <span className="pd-patient-demographics-icon mdi mdi-phone-outline"></span>
              <span className="pd-patient-demographics-data">{homePhoneNumber}</span>
            </div>
          )}
          {workPhoneNumber && (
            <div className="pd-patient-demographics-list-item">
              <span className="pd-patient-demographics-icon mdi mdi-phone-outline"></span>
              <span className="pd-patient-demographics-data">{workPhoneNumber}</span>
            </div>
          )}
          <div className="pd-patient-demographics-list-item">
            <span className="pd-patient-demographics-icon mdi mdi-email-outline"></span>
            <span className="pd-patient-demographics-data">{email || ""}</span>
          </div>
          <div className="pd-patient-demographics-list-item">
            <span className="pd-patient-demographics-icon mdi mdi-home-outline"></span>
            <span className="pd-patient-demographics-data">{displayAddressInUSFormat(addressLineOne, addressLineTwo, city, state, zipCode)}</span>
          </div>
          {/* Add other fields as needed */}
        </div>
        <div className="pd-patient-demographics-icons">
          <span className="mdi mdi-dots-vertical action-group-icon" data-bs-toggle="dropdown" data-bs-auto-close="true" aria-expanded="false"></span>
          <ul className="dropdown-menu" aria-labelledby="defaultDropdown">
            <li><a className="dropdown-item" href="#">Menu item</a></li>
            <li><a className="dropdown-item" href="#">Menu item</a></li>
            <li><a className="dropdown-item" href="#">Menu item</a></li>
          </ul>
        </div>
      </div>
    </div>
  );
};

const PatientChartSideMenu = ({ patientId, onSectionSelect }) => {
  const menuItems = [
    { code: 'PCSUM', id: `${patientId}_pc_patient_summary`, icon: 'mdi-view-dashboard', label: 'Summary' },
    { code: 'PCPP', id: `${patientId}_pc_patient_profile`, icon: 'mdi-card-account-details', label: 'Patient Profile' },
    { code: 'PCAPP', id: `${patientId}_pc_patient_appointments`, icon: 'mdi-calendar-account-outline', label: 'Appointments' },
    { code: 'PCALL', id: `${patientId}_pc_patient_allergies`, icon: 'mdi-allergy', label: 'Allergies' },
    { code: 'PCPRO', id: `${patientId}_pc_patient_problems`, icon: 'mdi-emoticon-sick-outline', label: 'Problems' },
    { code: 'PCENC', id: `${patientId}_pc_patient_encounters`, icon: 'mdi-counter', label: 'Encounters' },
    { code: 'PCMED', id: `${patientId}_pc_patient_medications`, icon: 'mdi-pill-multiple', label: 'Medications' },
    { code: 'PCIMP', id: `${patientId}_pc_patient_implant_device`, icon: 'mdi-devices', label: 'Implantable Devices' },
    { code: 'PCVIT', id: `${patientId}_pc_patient_vitals`, icon: 'mdi-heart-pulse', label: 'Vitals' },
    { code: 'PCIMM', id: `${patientId}_pc_patient_immunization`, icon: 'mdi-needle', label: 'Immunization' },
    { code: 'PCLAB', id: `${patientId}_pc_patient_lab`, icon: 'mdi-cart-plus', label: 'Lab Orders' },
    { code: 'PCVIS', id: `${patientId}_pc_patient_visits`, icon: 'mdi-walk', label: 'Visits' },
    { code: 'PCPFS', id: `${patientId}_pc_patient_pfsh`, icon: 'mdi-history', label: 'PFSH' },
    { code: 'PCHSA', id: `${patientId}_pc_patient_hsa`, icon: 'mdi-note-check-outline', label: 'Health Status Assessment' },
    { code: 'PCDOC', id: `${patientId}_pc_patient_documents`, icon: 'mdi-file-document-multiple-outline', label: 'Documents' },
  ];

  return (
    <ul className="pcm-patient-chart-menu-list custom-scrollbar" role="tablist">
      {menuItems.map(item => (
        <li key={item.id} className="pcm-patient-chart-menu-list-item nav-item" role="presentation" data-section-code={item.code} data-id={item.id}>
          <button
            className={`nav-link pcm-nav-link${item.code === 'PCSUM' ? ' active' : ''}`}
            id={`${item.id}_tab`}
            data-bs-toggle="pill"
            data-bs-target={`#${item.id}`}
            type="button"
            role="tab"
            aria-controls={item.id}
            aria-selected={item.code === 'PCSUM'}
            onClick={() => onSectionSelect(item)}
          >
            <span className={`pcm-patient-chart-menu-icon mdi ${item.icon}`}></span>
            <span className="pcm-patient-chart-menu-desc text-center text-wrap">{item.label}</span>
          </button>
        </li>
      ))}
    </ul>
  );
};

const PatientChart = ({ patientId, url }) => {
  const [selectedSection, setSelectedSection] = useState('PCSUM');

  const handleSectionSelect = (item) => {
    setSelectedSection(item.code);
  };

  return (
    <div className="container-fluid p-0 h-100">
      <div className="pc-patient-demographics-container col-md-12">
        <PatientDemographics patientId={patientId} url={url} />
      </div>
      <div className="pc-patient-chart-body-container container-fluid p-0">
        <div className="pc-patient-chart-side-menu">
          <PatientChartSideMenu patientId={patientId} onSectionSelect={handleSectionSelect} />
        </div>
        <div className="pc-patient-chart-side-menu-contents">
          <div className="tab-content pc-patient-chart-side-menu-tabContent">
            {selectedSection === 'PCSUM' && (
              <div className="tab-pane fade show active" id={`${patientId}_pc_patient_summary`} role="tabpanel" aria-labelledby={`${patientId}_pc_patient_summary_tab`}>
                Summary
              </div>
            )}
            {/* Add other tab panes for each section as needed */}
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientChart;
