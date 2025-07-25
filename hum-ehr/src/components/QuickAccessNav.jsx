export const displayPatientNameInNewTab = (patientId, patientName) => {
  const patientTab = document.getElementById('patient_list_nav_tabs');
  if (patientTab) {
    const li = document.createElement('li');
    li.className = `nav-item patient-list-nav-item patient-list-nav-item-${patientId}`;
    li.setAttribute('data-patient-id', patientId);
    li.setAttribute('data-section', 'patient_name');

    li.innerHTML = `
      <button id="pills_${patientId}_chart_tab" class="nav-link patient-list-nav-link active rounded-top" data-bs-toggle="pill" data-bs-target="#${patientId}_chart_tab_pane" type="button" role="tab" aria-controls="${patientId}_chart_tab_pane" aria-selected="true" tabindex="-1">
          <span className="text-truncate patient-name">${patientName}</span>
          <span className="mdi mdi-close patient-list-nav-item-close-icon"></span>
      </button>
    `;
    patientTab.appendChild(li);
  }
};

const QuickAccessNav = () => {
  return (
    <header className="navbar p-0 hh-ehr-bg-color4" id="application_quick_access_side_nav_container">
      <div id="application_quick_access_nav_container" className="container-fluid p-0 ms-5">
        <div id="application_quick_access_nav_container_1">
          <ul className="nav nav-pills patient-list-nav-tabs" role="tablist" id="patient_list_nav_tabs"></ul>
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
    </header>
  );
};

export default QuickAccessNav;