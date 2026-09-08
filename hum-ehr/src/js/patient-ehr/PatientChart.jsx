import { lazy, Suspense, useState } from 'react';
import PatientDemographics from './PatientDemographics';
import PatientChartSideMenu from './PatientChartSideMenu';
import { SkeletonTable } from '../../components/common/ContentLoader';
import './PatientChart.css';

// Each clinical section is code-split: opening a patient loads only the shell +
// demographics + side menu; a section's bundle loads the first time it is opened.
const PatientProfile = lazy(() => import('./profile/PatientProfile'));
const PatientAllergies = lazy(() => import('./allergies/PatientAllergies'));
const PatientProblems = lazy(() => import('./problems/PatientProblems'));
const PatientHospitalization = lazy(() => import('./hospitalization/PatientHospitalization'));
const PatientGoals = lazy(() => import('./goals/PatientGoals'));
const PatientImmunization = lazy(() => import('./immunization/PatientImmunization'));
const PatientImplantableDevice = lazy(() => import('./implantable-device/PatientImplantableDevice'));
const PatientFamilyHistory = lazy(() => import('./family-history/PatientFamilyHistory'));
const PatientPreferences = lazy(() => import('./preferences/PatientPreferences'));
const PatientDocuments = lazy(() => import('./documents/PatientDocuments'));
const PatientProcedure = lazy(() => import('./procedure/PatientProcedure'));
const PatientSurgicalHistory = lazy(() => import('./surgical-history/PatientSurgicalHistory'));
const PatientChart = ({ patientId }) => {
    const [section, setSection] = useState('PCSUM');
    const renderTabContentBody = () => {
        switch (section) {
            case 'PCSUM':
                return <div className="tab-pane fade show active">Summary Profile Core Dashboard View</div>;
            case 'PCPP':
                return <PatientProfile patientId={patientId}/>;
            case 'PCAPP':
                return <div className="tab-pane fade show active">Appointments Log Workspace Canvas</div>;
            case 'PCALL':
                return <PatientAllergies patientId={patientId}/>;
            case 'PCPRO':
                return <PatientProblems patientId={patientId}/>;
            case 'PCENC':
                return <patient-encounter patient-id={patientId} record-type="active"/>;
            case 'PCPS':
                return <PatientProcedure patientId={patientId}/>;
            case 'PCHPS':
                return <PatientHospitalization patientId={patientId}/>;
            case 'PCSUH':
                return <PatientSurgicalHistory patientId={patientId}/>;
            case 'PCMED':
                return <ehr-orders-main-element order-type="EHR-MEDI-ORDER" is-patient-chart="Y" patient-id={patientId}/>;
            case 'PCFAH':
                return <PatientFamilyHistory patientId={patientId}/>;
            case 'PCPRE':
                return <PatientPreferences patientId={patientId}/>;
            case 'PCIMP':
                return <PatientImplantableDevice patientId={patientId}/>;
            case 'PCVIT':
                return <patient-ehr-vitals patient-id={patientId}/>;
            case 'PCIMM':
                return <PatientImmunization patientId={patientId}/>;
            case 'PCGOAL':
                return <PatientGoals patientId={patientId}/>;
            case 'NUTRIREC':
                return <patient-nutrition-recommandation patient-id={patientId} record-type="active"/>;
            case 'PCCLT':
                return <ehr-orders-main-element patient-id={patientId} order-type="EHR-CLINIC-ORDER" is-patient-chart="Y"/>;
            case 'PCIMG':
                return <ehr-orders-main-element patient-id={patientId} order-type="EHR-IMAG-ORDER" is-patient-chart="Y"/>;
            case 'PCHSA':
                return <patient-health-status-assessment patient-id={patientId}/>;
            case 'PCDOC':
                return <PatientDocuments patientId={patientId}/>;
            case 'PCREF':
                return <patient-ehr-referrals patient-id={patientId} patient-chart="Y"/>;
            default:
                return <div className="tab-pane fade show active">Summary</div>;
        }
    };
    return (<div className="patient-chart-container-node container-fluid p-0" id={`patient_chart_element_${patientId}`}>
      <div className="container-fluid p-0">
        <div className="pc-patient-demographics-container col-md-12 p-0">
          <PatientDemographics patientId={patientId}/>
        </div>

        <div className="pc-patient-chart-body-container container-fluid p-0 mt-2">
          <div className="d-flex align-items-start h-100 w-100">
            <div className="pc-patient-chart-side-menu h-100">
              <PatientChartSideMenu patientId={patientId} activeSection={section} onSectionChange={setSection}/>
            </div>

            <div className="pc-patient-chart-side-menu-contents flex-grow-1">
              <div className="tab-content pc-patient-chart-side-menu-tabContent h-100 w-100">
                <Suspense fallback={<SkeletonTable/>}>
                  {renderTabContentBody()}
                </Suspense>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>);
};
export default PatientChart;
