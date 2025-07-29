import { createRoot } from 'react-dom/client';
import PatientChart from "../js/patient-ehr/PatientChart";
import Sidebar from './Sidebar';

/**
 * function to show and hide application side menu 
 * on screen loading
 * @param {*} isHideIcon 
 */
const showHideSideNavigationMenuIconOnLoading = (isHideIcon = "Y") => {
  const applicationSideNavMenuContainer = document.getElementById('application_side_navigation_menu_container');

  if (isHideIcon === "Y") {
    if (!applicationSideNavMenuContainer.classList.contains("d-none")) {
      document.body.classList.add("expanded-view", "ignore-menu-icon-view");
      applicationSideNavMenuContainer.classList.add("d-none");
    }
  } else {
    document.body.classList.remove("expanded-view", "ignore-menu-icon-view");
    applicationSideNavMenuContainer.classList.remove("d-none");
  }
};

export const displayPatientNameInNewTab = (patientId, patientName) => {
  const patientListTab = document.getElementById('patient_list_nav_tabs');
  const patientChartTab = document.getElementById('patient_chart_main_container');

  if (patientListTab && patientChartTab) {
    const activeButtons = document.getElementsByClassName("patient-list-nav-link");
    Array.from(activeButtons).forEach((el) => {
      el.classList.remove("active");
    });
    
    const li = document.createElement('li');
    li.className = `nav-item patient-list-nav-item patient-list-nav-item-${patientId}`;
    li.setAttribute('data-patient-id', patientId);
    li.setAttribute('data-section', 'patient_name');

    li.innerHTML = `
      <button id="pills_${patientId}_chart_tab"
        class="nav-link patient-list-nav-link active rounded-top"
        data-bs-toggle="pill"
        data-bs-target="#${patientId}_chart_tab_pane"
        type="button"
        role="tab"
        aria-controls="${patientId}_chart_tab_pane"
        aria-selected="true"
        tabindex="-1">
        <span class="text-truncate patient-name">${patientName}</span>
        <span class="mdi mdi-close patient-list-nav-item-close-icon"></span>
      </button>
    `;
    patientListTab.appendChild(li);

    // === Create and append tab content ===
    const wrapper = document.createElement('div');
    const tabContainers = document.getElementsByClassName("tab-pane");
    Array.from(tabContainers).forEach((el) => {
      el.classList.remove("active", "show");
    });
    
    wrapper.innerHTML = `
      <div class="tab-pane patient-chart-tab-pane fade show active px-3"
           id="${patientId}_chart_tab_pane"
           role="tabpanel">
        <div id="patient_chart_wrapper_${patientId}"></div>
      </div>
    `;

    const tabPaneDiv = wrapper.firstElementChild;
    patientChartTab.appendChild(tabPaneDiv);

    // === Mount React component inside that div ===
    const patientChartBodyId = document.getElementById(`patient_chart_wrapper_${patientId}`);
    const root = createRoot(patientChartBodyId);
    root.render(<PatientChart patientId={patientId} />);

    showHideSideNavigationMenuIconOnLoading();
  }
};


const QuickAccessNav = ({onmenuClick}) => {
  return (
    <header className="navbar p-0 hh-ehr-bg-color4" id="application_quick_access_side_nav_container">
      <div id="application_quick_access_nav_container" className="container-fluid p-0">
        <div id="application_quick_access_nav_container_1">
          <ul className="nav nav-pills patient-list-nav-tabs" role="tablist" id="patient_list_nav_tabs">
            <li className="nav-item patient-list-nav-item active" data-section="patient_list" role="presentation">
			        <button id="pills_patient_list_tab" className="nav-link patient-list-nav-link rounded-top active" data-bs-toggle="pill" data-bs-target="#patient_list_container" type="button" role="tab" aria-controls="patient_list_container" aria-selected="true">
			            <span className="patient-name patient-list-label">Patient List </span>
                  <span className="badge" id="patient_list_filter_count"></span>
			        </button>
			      </li>
          </ul>
        </div>
        <div id="application_quick_access_nav_container_2">
          <div className="list-filter-access-icon">
            <ul className="list-unstyled m-0 me-1 hh-ehr-color1">
              <li className="app-quick-access-icon-list" data-bs-toggle="offcanvas" data-bs-target="#offcanvasRight"
                  aria-controls="offcanvasRight">
                <span className="mdi mdi-filter-variant"></span>
              </li>
            </ul>
          </div>
          <div className="app-quick-access-icon-section hh-ehr-bg-color5 hh-ehr-color1">
            <ul>
              <li className="app-quick-access-icon-list">
                <span className="mdi mdi-calendar-plus-outline"></span>
              </li>
              <li className="app-quick-access-icon-list">
                <span className="mdi mdi-heart-pulse"></span>
              </li>
              <li className="app-quick-access-icon-list">
                <span className="mdi mdi-devices"></span>
              </li>
              <li className="app-quick-access-icon-list">
                <span className="mdi mdi-currency-usd"></span>
              </li>
              <li className="app-quick-access-icon-list">
                <span className="mdi mdi-chart-multiple"></span>
              </li>
              <li className="app-quick-access-icon-list">
                <span className="mdi mdi-list-box-outline"></span>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <Sidebar onmenuClick={onmenuClick} />
    </header>
  );
};

export default QuickAccessNav;