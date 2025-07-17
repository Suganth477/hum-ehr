import React from 'react';

const QuickAccessNav = () => {
  return (
    <header className="navbar p-0 hh-ehr-bg-color4" id="application_quick_access_side_nav_container">
      <div id="application_quick_access_nav_container" className="container-fluid p-0">
        <div id="application_quick_access_nav_container_1"></div>
        <div id="application_quick_access_nav_container_2">
          <div className="list-filter-access-icon d-none">
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