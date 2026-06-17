import React, { useEffect } from 'react';

const PatientChartSideMenu = ({ patientId, activeSection, onSectionChange }) => {

	useEffect(() => {
		const cachedConfig = sessionStorage.getItem("patientChartInformation");
		if (cachedConfig) {
			const parsedBlock = JSON.parse(cachedConfig);
			const savedCode = parsedBlock[`${patientId}_patient_details`]?.["selectedMenuCode"];
			if (savedCode && savedCode !== activeSection) {
				onSectionChange(savedCode);
			}
		}
	}, [patientId]);

	const handleMenuTabClick = (sectionCode) => {
		onSectionChange(sectionCode);

		const savedConfig = sessionStorage.getItem("patientChartInformation");
		if (savedConfig) {
			let parsedBlock = JSON.parse(savedConfig);
			if (parsedBlock[`${patientId}_patient_details`]) {
				parsedBlock[`${patientId}_patient_details`]["selectedMenuCode"] = sectionCode;
				sessionStorage.setItem("patientChartInformation", JSON.stringify(parsedBlock));
			}
		}
	};

	const renderMenuItem = (code, iconClass, label, isCustomIcon = false, customSvg = null) => {
		const isActive = activeSection === code;
		return (
			<li className={`pcm-patient-chart-menu-list-item nav-item w-100 ${isActive ? 'active' : ''}`} role="presentation">
				<button
					className={`nav-link pcm-nav-link text-center w-100 d-flex flex-column align-items-center ${isActive ? 'active' : ''}`}
					type="button"
					onClick={() => handleMenuTabClick(code)}
				>
					{isCustomIcon ? customSvg : <span className={`pcm-patient-chart-menu-icon mdi ${iconClass}`}></span>}
					<span className="pcm-patient-chart-menu-desc text-center text-wrap mt-1">{label}</span>
				</button>
			</li>
		);
	};

	return (
		<div className="patient-side-menu-container-node">
			<ul className="pcm-patient-chart-menu-list custom-scrollbar d-flex flex-column" role="tablist">
				{renderMenuItem('PCSUM', 'mdi-view-dashboard', 'Summary')}
				{renderMenuItem('PCPP', 'mdi-id-card', 'Patient Profile')}
				{renderMenuItem('PCAPP', 'mdi-calendar-account-outline', 'Appointments')}
				{renderMenuItem('PCALL', 'mdi-allergy', 'Allergies')}
				{renderMenuItem('PCPRO', 'mdi-emoticon-sick-outline', 'Problems')}
				{renderMenuItem('PCENC', 'mdi-counter', 'Encounters')}
				{renderMenuItem('PCMED', 'mdi-pill-multiple', 'Medications')}
				{renderMenuItem('PCFAH', 'mdi-account-multiple-outline', 'Family Health History')}
				{renderMenuItem('PCPRE', 'mdi-heart-cog', 'Preferences')}
				{renderMenuItem('PCPS', 'mdi-bed-pulse', 'Procedure')}

				{renderMenuItem('PCSUH', '', 'Surgical History', true, (
					<span className="pcm-patient-chart-menu-icon">
						<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 16 16" fill="none">
							<path d="M1.5 3.33437V1.75C1.5 1.33438 1.16562 1 0.75 1C0.334375 1 0 1.33438 0 1.75V5.25C0 5.66563 0.334375 6 0.75 6H4.25C4.66563 6 5 5.66563 5 5.25C5 4.83437 4.66563 4.5 4.25 4.5H2.52187C3.67812 2.69375 5.7 1.5 8 1.5C11.5906 1.5 14.5 4.40938 14.5 8C14.5 11.5906 11.5906 14.5 8 14.5C6.67188 14.5 5.44063 14.1031 4.41563 13.4219C4.07188 13.1938 3.60625 13.2875 3.375 13.6313C3.14375 13.975 3.24062 14.4406 3.58437 14.6719C4.85 15.5125 6.36875 16 8 16C12.4187 16 16 12.4187 16 8C16 3.58125 12.4187 0 8 0C5.32188 0 2.95 1.31562 1.5 3.33437ZM8 4C7.58437 4 7.25 4.33437 7.25 4.75V8C7.25 8.2 7.32812 8.39062 7.46875 8.53125L9.71875 10.7812C10.0125 11.075 10.4875 11.075 10.7781 10.7812C11.0687 10.4875 11.0719 10.0125 10.7781 9.72188L8.74687 7.69063V4.75C8.74687 4.33437 8.4125 4 7.99687 4H8Z" fill="#2E384D" />
						</svg>
					</span>
				))}

				{renderMenuItem('PCHPS', 'mdi-hospital-building', 'Hospitalization')}
				{renderMenuItem('PCIMP', 'mdi-devices', 'Implantable Devices')}
				{renderMenuItem('PCVIT', 'mdi-heart-pulse', 'Vitals')}
				{renderMenuItem('PCIMM', 'mdi-needle', 'Immunization')}
				{renderMenuItem('PCGOAL', 'mdi-bullseye', 'Goals')}
				{renderMenuItem('NTRN', 'mdi-food-apple-outline', 'Nutrition Recommendation')}
				{renderMenuItem('PCCLT', 'mdi-clipboard-text-play-outline', 'Clinical Test')}
				{renderMenuItem('PCIMG', 'mdi-filmstrip', 'Imaging Orders')}
				{renderMenuItem('PCVIS', 'mdi-walk', 'Visits')}
				{renderMenuItem('PCHSA', 'mdi-note-check-outline', 'Health Status Assessment')}
				{renderMenuItem('PCDOC', 'mdi-file-document-multiple-outline', 'Documents')}
				{renderMenuItem('PCREF', 'mdi-account-arrow-right-outline', 'Referrals')}
			</ul>
		</div>
	);
};

export default PatientChartSideMenu;