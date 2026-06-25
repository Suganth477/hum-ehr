import { useState } from 'react';
import PatientDemographics from './PatientDemographics';
import PatientChartSideMenu from './PatientChartSideMenu';
import PatientAllergies from './allergies/PatientAllergies';
import './PatientChart.css';
const PatientChart = ({ patientId }) => {
    const [section, setSection] = useState('PCSUM');
    const renderTabContentBody = () => {
        switch (section) {
            case 'PCSUM':
                return <div className="tab-pane fade show active">Summary Profile Core Dashboard View</div>;
            case 'PCPP':
                return <patient-chart-patient-profile patient-id={patientId}/>;
            case 'PCAPP':
                return <div className="tab-pane fade show active">Appointments Log Workspace Canvas</div>;
            case 'PCALL':
                return <PatientAllergies patientId={patientId}/>;
            case 'PCPRO':
                return <patient-problems patient-id={patientId} record-type="active"/>;
            case 'PCENC':
                return <patient-encounter patient-id={patientId} record-type="active"/>;
            case 'PCPS':
                return <patient-ehr-procedure-details-main-element patient-id={patientId} section-code="PROCEDURE" record-type="active"/>;
            case 'PCHPS':
                return <patient-ehr-hospitalization patient-id={patientId} section-code="HOSPITALIZATION" record-type="active"/>;
            case 'PCSUH':
                return <patient-surgical-history patient-id={patientId} section-code="SUH"/>;
            case 'PCMED':
                return <ehr-orders-main-element order-type="EHR-MEDI-ORDER" is-patient-chart="Y" patient-id={patientId}/>;
            case 'PCFAH':
                return <patient-family-history is-patient-chart="Y" patient-id={patientId}/>;
            case 'PCPRE':
                return <patient-ehr-preferences patient-id={patientId}/>;
            case 'PCIMP':
                return <patient-implantable-device patient-id={patientId} data-record-type="active" invalid-flag=""/>;
            case 'PCVIT':
                return <patient-ehr-vitals patient-id={patientId}/>;
            case 'PCIMM':
                return <patient-immunization patient-id={patientId}/>;
            case 'PCGOAL':
                return <patient-goals patient-id={patientId}/>;
            case 'NTRN':
                return <patient-nutrition-recommandation patient-id={patientId} record-type="active"/>;
            case 'PCCLT':
                return <ehr-orders-main-element patient-id={patientId} order-type="EHR-CLINIC-ORDER" is-patient-chart="Y"/>;
            case 'PCIMG':
                return <ehr-orders-main-element patient-id={patientId} order-type="EHR-IMAG-ORDER" is-patient-chart="Y"/>;
            case 'PCHSA':
                return <patient-health-status-assessment patient-id={patientId}/>;
            case 'PCDOC':
                return <patient-ehr-documents patient-id={patientId}/>;
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
                {renderTabContentBody()}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>);
};
export default PatientChart;
