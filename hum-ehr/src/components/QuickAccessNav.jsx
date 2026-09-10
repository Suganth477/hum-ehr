import { useLocation } from 'react-router-dom';
import Sidebar from './Sidebar';
import { LegacyIcon, HeartPulseIcon, DevicesIcon, ChartMultipleIcon, ListBoxIcon } from './common/CustomIcons';
import CtcHeaderChat from '../js/message-center/CtcHeaderChat';
import { getLoggedInUser } from '../services/authService';
import { isChatHiddenRole } from '../constants/roles';

/**
 * Routes the patient tab strip belongs to. Legacy renders
 * `#application_quick_access_nav_container_1` as an EMPTY div in `ehr-layout.jsp`
 * and injects the strip only on the patient-list page; the strip switches between
 * the patient list and the open patient charts, which both live under /patients.
 */
const PATIENT_LIST_ROUTES = ['/patients'];

const QuickAccessNav = ({ openTabs, activeTab, setActiveTab, onCloseTab }) => {
	const { pathname } = useLocation();
	const isPatientListScreen = PATIENT_LIST_ROUTES.includes(pathname);
	// Legacy `ehr-layout.jsp` wraps the header chat icon (ehr-chat.jsp) in
	// `if (!SUPER_ADMIN && !CARE_ADMIN)` — the same roles the Message Center hides
	// its chat tab from. Preserve that permission branch.
	const showHeaderChat = !isChatHiddenRole(getLoggedInUser()?.roleCode);
	const handleTabClickEvent = (section, tabId, e) => {
		// The filter-icon visibility is rendered declaratively from `activeTab`
		// (see the `list-filter-access-icon` block below), so no DOM toggle is
		// needed here.
		// Replicate the conditional dropdown tab shuffle. This is width-based
		// overflow management that is impractical to express declaratively, so it
		// stays as direct DOM work for now.
		const currentTabButton = e.currentTarget;
		if (currentTabButton.closest('#pc_patient_tab_dropdown_list_group')) {
			const clickedPatientTab = currentTabButton.closest('.patient-list-nav-item');
			const primaryTabsList = document.getElementById('patient_list_nav_tabs');
			const dropdownGroup = document.getElementById('pc_patient_tab_dropdown_list_group');
			if (clickedPatientTab && primaryTabsList) {
				const visiblePatientTabs = primaryTabsList.querySelectorAll(".patient-list-nav-item[data-section='patient_name']");
				if (visiblePatientTabs.length > 0) {
					const firstVisiblePatientTab = visiblePatientTabs[0];
					const clickedClone = clickedPatientTab.cloneNode(true);
					const visibleClone = firstVisiblePatientTab.cloneNode(true);
					clickedPatientTab.remove();
					firstVisiblePatientTab.remove();
					const masterListTab = primaryTabsList.querySelector(".patient-list-nav-item[data-section='patient_list']");
					masterListTab?.after(clickedClone);
					dropdownGroup?.prepend(visibleClone);
				}
			}
		}
		// Sync the active pointer with the App viewport router.
		setActiveTab(tabId);
	};
	return (<header className="navbar p-0 hh-ehr-bg-color4" id="application_quick_access_side_nav_container">
		<div id="application_quick_access_nav_container" className="container-fluid p-0">
			<div id="application_quick_access_nav_container_1">
				{isPatientListScreen && (<ul className="nav nav-pills patient-list-nav-tabs" role="tablist" id="patient_list_nav_tabs">
					<li className={`nav-item patient-list-nav-item ${activeTab === 'patient_list' ? 'active' : ''}`} data-section="patient_list" role="presentation">
						<button id="pills_patient_list_tab" className={`nav-link patient-list-nav-link rounded-top ${activeTab === 'patient_list' ? 'active' : ''}`} type="button" role="tab" onClick={(e) => handleTabClickEvent('patient_list', 'patient_list', e)} aria-controls="patient_list_container" aria-selected={activeTab === 'patient_list'}>
							<span className="patient-name patient-list-label">Patient List </span>
							<span className="badge" id="patient_list_filter_count">0</span>
						</button>
					</li>

					{openTabs.map((tab) => (<li key={tab.patientId} className={`nav-item patient-list-nav-item patient-list-nav-item-${tab.patientId} ${activeTab === tab.patientId ? 'active' : ''}`} data-patient-id={tab.patientId} data-section="patient_name" role="presentation">
						<button id={`pills_${tab.patientId}_chart_tab`} className={`nav-link patient-list-nav-link rounded-top ${activeTab === tab.patientId ? 'active' : ''}`} type="button" role="tab" onClick={(e) => handleTabClickEvent('patient_name', tab.patientId, e)} aria-controls={`${tab.patientId}_chart_tab_pane`} aria-selected={activeTab === tab.patientId}>
							<span className="text-truncate patient-name">{tab.patientName}</span>
							<LegacyIcon icon="mdi-close" className="patient-list-nav-item-close-icon" role="button" tabIndex={0} aria-label={`Close ${tab.patientName} tab`} onClick={(ev) => onCloseTab(tab.patientId, ev)} onKeyDown={(ev) => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); onCloseTab(tab.patientId, ev); } }} />
						</button>
					</li>))}
				</ul>)}
			</div>

			<div id="application_quick_access_nav_container_2">
				{/* Legacy ships `.list-filter-access-icon` with `d-none` (and `hide` on the
				    item) and reveals it only on the patient-list page — so it stays hidden
				    on a patient chart AND on every other screen (Message Center, Dashboard). */}
				<div className={`list-filter-access-icon ${isPatientListScreen && activeTab === 'patient_list' ? '' : 'd-none'}`}>
					<ul className="list-unstyled m-0 me-1 hh-ehr-color1">
						<li className="app-quick-access-icon-list" data-bs-toggle="offcanvas" data-bs-target="#offcanvasRight" aria-controls="offcanvasRight">
							<LegacyIcon icon="mdi-filter-variant" />
						</li>
					</ul>
				</div>
				<div className="app-quick-access-icon-section hh-ehr-bg-color5 hh-ehr-color1">
					<ul>
						{showHeaderChat && <li className="app-quick-access-icon-list"><CtcHeaderChat /></li>}
						<li className="app-quick-access-icon-list"><LegacyIcon icon="mdi-cog" className="ehr-user-import-ccd-configuration-icon" /></li>
						<li className="app-quick-access-icon-list"><LegacyIcon icon="mdi-calendar-plus-outline" /></li>
						<li className="app-quick-access-icon-list"><HeartPulseIcon /></li>
						<li className="app-quick-access-icon-list"><DevicesIcon /></li>
						<li className="app-quick-access-icon-list"><LegacyIcon icon="mdi-currency-usd" /></li>
						<li className="app-quick-access-icon-list"><ChartMultipleIcon /></li>
						<li className="app-quick-access-icon-list"><ListBoxIcon /></li>
					</ul>
				</div>
			</div>
		</div>
		<Sidebar />
	</header>);
};
export default QuickAccessNav;
