import React, { useState } from "react";
import PatientDemographics from "./PatientDemographics";
import PatientChartSideMenu from "./PatientChartSideMenu";
import PatientAllergies from "./allergies/PatientAllergies";
import "./PatientChart.css"; // Explicitly linked here

const PatientChart = ({ patientId }) => {
	const [section, setSection] = useState("PCSUM");

	const renderTabContentBody = () => {
		switch (section) {
			case "PCSUM":
				return (
					<div className="tab-pane fade show active">
						Summary Profile Core Dashboard View
					</div>
				);
			case "PCPP":
				return (
					<patient-chart-patient-profile
						patient-id={patientId}
					></patient-chart-patient-profile>
				);
			case "PCAPP":
				return (
					<div className="tab-pane fade show active">
						Appointments Log Workspace Canvas
					</div>
				);
			case "PCALL":
				return <PatientAllergies patientId={patientId} />;
			case "PCPRO":
				return (
					<patient-problems
						patient-id={patientId}
						record-type="active"
					></patient-problems>
				);
			case "PCENC":
				return (
					<patient-encounter
						patient-id={patientId}
						record-type="active"
					></patient-encounter>
				);
			case "PCPS":
				return (
					<patient-ehr-procedure-details-main-element
						patient-id={patientId}
						section-code="PROCEDURE"
						record-type="active"
					></patient-ehr-procedure-details-main-element>
				);
			case "PCHPS":
				return (
					<patient-ehr-hospitalization
						patient-id={patientId}
						section-code="HOSPITALIZATION"
						record-type="active"
					></patient-ehr-hospitalization>
				);
			case "PCSUH":
				return (
					<patient-surgical-history
						patient-id={patientId}
						section-code="SUH"
					></patient-surgical-history>
				);
			case "PCMED":
				return (
					<ehr-orders-main-element
						order-type="EHR-MEDI-ORDER"
						is-patient-chart="Y"
						patient-id={patientId}
					></ehr-orders-main-element>
				);
			case "PCFAH":
				return (
					<patient-family-history
						is-patient-chart="Y"
						patient-id={patientId}
					></patient-family-history>
				);
			case "PCPRE":
				return (
					<patient-ehr-preferences
						patient-id={patientId}
					></patient-ehr-preferences>
				);
			case "PCIMP":
				return (
					<patient-implantable-device
						patient-id={patientId}
						data-record-type="active"
						invalid-flag=""
					></patient-implantable-device>
				);
			case "PCVIT":
				return <patient-ehr-vitals patient-id={patientId}></patient-ehr-vitals>;
			case "PCIMM":
				return (
					<patient-immunization patient-id={patientId}></patient-immunization>
				);
			case "PCGOAL":
				return <patient-goals patient-id={patientId}></patient-goals>;
			case "NTRN":
				return (
					<patient-nutrition-recommandation
						patient-id={patientId}
						record-type="active"
					></patient-nutrition-recommandation>
				);
			case "PCCLT":
				return (
					<ehr-orders-main-element
						patient-id={patientId}
						order-type="EHR-CLINIC-ORDER"
						is-patient-chart="Y"
					></ehr-orders-main-element>
				);
			case "PCIMG":
				return (
					<ehr-orders-main-element
						patient-id={patientId}
						order-type="EHR-IMAG-ORDER"
						is-patient-chart="Y"
					></ehr-orders-main-element>
				);
			case "PCHSA":
				return (
					<patient-health-status-assessment
						patient-id={patientId}
					></patient-health-status-assessment>
				);
			case "PCDOC":
				return (
					<patient-ehr-documents patient-id={patientId}></patient-ehr-documents>
				);
			case "PCREF":
				return (
					<patient-ehr-referrals
						patient-id={patientId}
						patient-chart="Y"
					></patient-ehr-referrals>
				);
			default:
				return <div className="tab-pane fade show active">Summary</div>;
		}
	};

	return (
		<div
			className="patient-chart-container-node container-fluid p-0"
			id={`patient_chart_element_${patientId}`}
		>
			<div className="container-fluid p-0">
				{/* Upper Demographics Section Area */}
				<div className="pc-patient-demographics-container col-md-12 p-0">
					<PatientDemographics patientId={patientId} />
				</div>

				{/* Central Component Grid Split Screen Workspace Wrapper */}
				<div className="pc-patient-chart-body-container container-fluid p-0 mt-2">
					<div className="d-flex align-items-start h-100 w-100">
						{/* Left Side Subhead Menu Drawer Container */}
						<div className="pc-patient-chart-side-menu h-100">
							<PatientChartSideMenu
								patientId={patientId}
								activeSection={section}
								onSectionChange={(newSection) => setSection(newSection)}
							/>
						</div>

						{/* Right Side Content Canvas Window Display */}
						<div className="pc-patient-chart-side-menu-contents flex-grow-1">
							<div className="tab-content pc-patient-chart-side-menu-tabContent h-100 w-100">
								{renderTabContentBody()}
							</div>
						</div>
					</div>
				</div>
			</div>
		</div>
	);
};

export default PatientChart;
