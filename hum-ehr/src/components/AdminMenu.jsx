import { useNavigate } from 'react-router-dom';
import { LegacyIcon } from './common/CustomIcons';
const AdminMenu = ({ userRoleCode, physicianAdminFlag, clinicianAdminFlag }) => {
	const navigate = useNavigate();
	// Role gate mirroring the logic in admin.jsp.
	const hasAdministrationAccess = () => {
		const role = userRoleCode?.toUpperCase();
		if (role === 'PHYSICIAN' && physicianAdminFlag === 'Y')
			return true;
		if (role === 'CLINICIAN' && clinicianAdminFlag === 'Y')
			return true;
		if (role === 'CARE_ADMIN')
			return true;
		return false;
	};
	const prevent = (e) => e.preventDefault();
	return (<>
		<li className="active application-menu-list" data-section="dashboard" onClick={() => navigate('/dashboard')}>
			<a href="#" className="parent-link" onClick={prevent}>
				<LegacyIcon icon="mdi-view-dashboard" className="app-menu-icon" />
				<span className="app-menu-description">Dashboard</span>
			</a>
		</li>

		{/* Legacy Patient Administration nesting tree */}
		<li className="application-menu-list d-none">
			<ul className="nav-pills nav-stacked d-none sub-menu-ul-list sub-menu-1">
				<li className="application-sub-menu1-list sub-menu-list">
					<a href="#" onClick={prevent}>
						<LegacyIcon icon="mdi-account-plus" className="app-menu-icon" />
						<span className="app-menu-description">Enroll Patient &amp; Program</span>
					</a>
				</li>
				<li className="application-sub-menu1-list sub-menu-list">
					<a href="#" onClick={prevent}>
						<LegacyIcon icon="mdi-account" className="app-menu-icon" />
						<span className="app-menu-description">Active Patients</span>
					</a>
				</li>
				<li className="application-sub-menu1-list sub-menu-list" onClick={() => navigate('/patients')}>
					<a href="#" onClick={prevent}>
						<LegacyIcon icon="fa-building" className="app-menu-icon" />
						<span className="app-menu-description">EHR Patients</span>
					</a>
				</li>
				<li className="application-sub-menu1-list sub-menu-list">
					<a href="#" onClick={prevent}>
						<LegacyIcon icon="mdi-phone-off" className="app-menu-icon" />
						<span className="app-menu-description">Unreachable Patients</span>
					</a>
				</li>
			</ul>
			<a href="#" className="parent-link" onClick={prevent}>
				<LegacyIcon icon="mdi-account" className="app-menu-icon" />
				<span className="app-menu-description">Patient Administration</span>
				<LegacyIcon icon="mdi-menu-right" className="app-sub-menu-icon" />
			</a>
		</li>

		<li className="application-menu-list">
			<a href="#" className="parent-link" onClick={prevent}>
				<LegacyIcon icon="mdi-calendar-month-outline" className="app-menu-icon" />
				<span className="app-menu-description">Appointment</span>
			</a>
		</li>

		<li className="application-menu-list" onClick={() => navigate('/patients')}>
			<a href="#" className="parent-link" onClick={prevent}>
				<LegacyIcon icon="mdi-account" className="app-menu-icon" />
				<span className="app-menu-description">Patients</span>
			</a>
		</li>

		<li className="application-menu-list" onClick={() => navigate('/message-center')}>
			<a href="#" className="parent-link" onClick={prevent}>
				<LegacyIcon icon="mdi-message-text-outline" className="app-menu-icon" />
				<span className="app-menu-description">Message Center</span>
			</a>
		</li>

		<li className="application-menu-list">
			<a href="#" className="parent-link" onClick={() => navigate('/reports')}>
				<LegacyIcon icon="mdi-file-document-outline" className="app-menu-icon" />
				<span className="app-menu-description">Reports</span>
			</a>
		</li>

		<li className="application-menu-list" onClick={() => navigate('/orders')}>
			<a href="#" className="parent-link" onClick={prevent}>
				<LegacyIcon icon="mdi-cart-plus" className="app-menu-icon" />
				<span className="app-menu-description">Orders</span>
			</a>
		</li>

		<li className="application-menu-list">
			<a href="#" className="parent-link" onClick={() => navigate('/referral')}>
				<LegacyIcon icon="mdi-account-multiple-outline" className="app-menu-icon" />
				<span className="app-menu-description">Referral</span>
			</a>
		</li>

		<li className="application-menu-list">
			<a href="#" className="parent-link" onClick={prevent}>
				<LegacyIcon icon="mdi-file-sign" className="app-menu-icon" />
				<span className="app-menu-description">Documentation</span>
			</a>
		</li>

		<li className="application-menu-list">
			<a href="#" className="parent-link" onClick={prevent}>
				<LegacyIcon icon="mdi-currency-usd" className="app-menu-icon" />
				<span className="app-menu-description">Billing</span>
			</a>
		</li>

		{hasAdministrationAccess() && (<li className="application-menu-list">
			<a href="/usermanagement" className="parent-link" target="_blank" rel="noopener noreferrer">
				<LegacyIcon icon="mdi-application-cog-outline" className="app-menu-icon" />
				<span className="app-menu-description">Administration</span>
			</a>
		</li>)}

		<li className="application-menu-list d-none" data-section="help">
			<a href="#" className="parent-link" onClick={() => navigate('/help')}>
				<LegacyIcon icon="mdi-help-circle-outline" className="app-menu-icon" />
				<span className="app-menu-description">Help</span>
			</a>
		</li>
	</>);
};
export default AdminMenu;
