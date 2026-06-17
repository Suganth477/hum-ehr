import React from "react";
import Sidebar from "./Sidebar";

const QuickAccessNav = ({ openTabs, activeTab, setActiveTab, onCloseTab }) => {
  const handleTabClickEvent = (section, tabId, e) => {
    // 1. Replicates target visibility logic from legacy event block
    const filterIcon = document.querySelector(".list-filter-access-icon");
    if (filterIcon) {
      if (section === "patient_list") {
        filterIcon.classList.remove("d-none");
      } else {
        filterIcon.classList.add("d-none");
      }
    }

    // 2. Replicates the conditional dropdown tab shuffle logic cleanly
    const currentTabButton = e.currentTarget;
    if (currentTabButton.closest("#pc_patient_tab_dropdown_list_group")) {
      const clickedPatientTab = currentTabButton.closest(
        ".patient-list-nav-item",
      );
      const primaryTabsList = document.getElementById("patient_list_nav_tabs");
      const dropdownGroup = document.getElementById(
        "pc_patient_tab_dropdown_list_group",
      );

      if (clickedPatientTab && primaryTabsList) {
        // Find the first visible patient tab in the primary row view list
        const visiblePatientTabs = primaryTabsList.querySelectorAll(
          ".patient-list-nav-item[data-section='patient_name']",
        );

        if (visiblePatientTabs.length > 0) {
          const firstVisiblePatientTab = visiblePatientTabs[0];

          // Execute exact swap functionality using native DOM element operations
          const clickedClone = clickedPatientTab.cloneNode(true);
          const visibleClone = firstVisiblePatientTab.cloneNode(true);

          clickedPatientTab.remove();
          firstVisiblePatientTab.remove();

          const masterListTab = primaryTabsList.querySelector(
            ".patient-list-nav-item[data-section='patient_list']",
          );
          if (masterListTab) {
            masterListTab.after(clickedClone);
          }
          if (dropdownGroup) {
            dropdownGroup.prepend(visibleClone);
          }
        }
      }
    }

    // 3. Update active pointer state to synchronize with App viewport router
    setActiveTab(tabId);
  };

  return (
    <header
      className="navbar p-0 hh-ehr-bg-color4"
      id="application_quick_access_side_nav_container"
    >
      <div
        id="application_quick_access_nav_container"
        className="container-fluid p-0"
      >
        <div id="application_quick_access_nav_container_1">
          <ul
            className="nav nav-pills patient-list-nav-tabs"
            role="tablist"
            id="patient_list_nav_tabs"
          >
            <li
              className={`nav-item patient-list-nav-item ${activeTab === "patient_list" ? "active" : ""}`}
              data-section="patient_list"
              role="presentation"
            >
              <button
                id="pills_patient_list_tab"
                className={`nav-link patient-list-nav-link rounded-top ${activeTab === "patient_list" ? "active" : ""}`}
                type="button"
                role="tab"
                onClick={(e) =>
                  handleTabClickEvent("patient_list", "patient_list", e)
                }
                aria-controls="patient_list_container"
                aria-selected={activeTab === "patient_list"}
              >
                <span className="patient-name patient-list-label">
                  Patient List{" "}
                </span>
                <span className="badge" id="patient_list_filter_count">
                  0
                </span>
              </button>
            </li>

            {openTabs.map((tab) => (
              <li
                key={tab.patientId}
                className={`nav-item patient-list-nav-item patient-list-nav-item-${tab.patientId} ${activeTab === tab.patientId ? "active" : ""}`}
                data-patient-id={tab.patientId}
                data-section="patient_name"
                role="presentation"
              >
                <button
                  id={`pills_${tab.patientId}_chart_tab`}
                  className={`nav-link patient-list-nav-link rounded-top ${activeTab === tab.patientId ? "active" : ""}`}
                  type="button"
                  role="tab"
                  onClick={(e) =>
                    handleTabClickEvent("patient_name", tab.patientId, e)
                  }
                  aria-controls={`${tab.patientId}_chart_tab_pane`}
                  aria-selected={activeTab === tab.patientId}
                >
                  <span className="text-truncate patient-name">
                    {tab.patientName}
                  </span>
                  <span
                    className="mdi mdi-close patient-list-nav-item-close-icon"
                    onClick={(ev) => onCloseTab(tab.patientId, ev)}
                  ></span>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div id="application_quick_access_nav_container_2">
          {/* Managed declaratively to prevent flickering or layout mismatch errors */}
          <div
            className={`list-filter-access-icon ${activeTab === "patient_list" ? "" : "d-none"}`}
          >
            <ul className="list-unstyled m-0 me-1 hh-ehr-color1">
              <li
                className="app-quick-access-icon-list"
                data-bs-toggle="offcanvas"
                data-bs-target="#offcanvasRight"
                aria-controls="offcanvasRight"
              >
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
      <Sidebar />
    </header>
  );
};

export default QuickAccessNav;
