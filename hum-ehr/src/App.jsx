import moment from "moment-timezone";
import { useEffect, useRef, useState } from "react";
import { Routes, Route, Navigate } from "react-router-dom";
import { apiPost } from "./services/apiClient";
import {
  getAuthToken,
  mapLoginGlobals,
  storeAuthToken,
} from "./services/authService";

// Components
import Footer from "./components/Footer";
import Header from "./components/Header";
import PatientListFilter from "./components/PatientListFilter";
import QuickAccessNav from "./components/QuickAccessNav";

// 1. THIRD-PARTY UTILITIES & FRAMEWORKS STYLES (Load these first)
import "bootstrap/dist/css/bootstrap.min.css";
import "material-design-icons-iconfont/dist/material-design-icons.css";
import "primeflex/primeflex.css";
import "primeicons/primeicons.css";
import "primereact/resources/primereact.min.css";
import "primereact/resources/themes/lara-light-indigo/theme.css";

// 2. YOUR EXACT CUSTOM CSS BUNDLE (Must be imported LAST)
// Place your file inside the src/ folder alongside App.jsx
import "./App.css";

import "./assets/plugins/font-awesome-pro/all.min.css";
import "./assets/plugins/font-awesome-pro/all.min.js";
import "./assets/css/fontawesome/css/font-awesome.css";

import "flatpickr/dist/flatpickr.min.css";

// List Components
import ActivePatientsList from "./js/patientlist/ActivePatientsList";
// import ActivePatientsList3 from './js/patientlist/ActivePatientsList3';

const App = () => {
  const [currentTime, setCurrentTime] = useState(moment());
  const [loginData, setLoginData] = useState(null);
  const [loading, setLoading] = useState(true);
  const hasLoggedIn = useRef(false);

  // Shared Tab States lifted from components to sync navigation layout and viewport
  const [openTabs, setOpenTabs] = useState([]);
  const [activeTab, setActiveTab] = useState("patient_list");

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentTime(moment());
    }, 1000);

    const restorePatientTabs = () => {
      const savedTabs = sessionStorage.getItem("patientChartInformation");
      if (!savedTabs) return;

      try {
        const parsedTabs = JSON.parse(savedTabs);
        const tabsArr = Object.keys(parsedTabs).map((key) => parsedTabs[key]);
        setOpenTabs(tabsArr);
        const currentlyActive = tabsArr.find(
          (tab) => tab.isPatientSelected === "Y",
        );
        if (currentlyActive) setActiveTab(currentlyActive.patientId);
      } catch (error) {
        console.error("Failed to restore patient chart tabs.", error);
      }
    };

    const initializeSession = async () => {
      console.log(import.meta.env.VITE_DEV_USERNAME);
      if (getAuthToken() || hasLoggedIn.current) {
        restorePatientTabs();
        setLoading(false);
        return;
      }

      const devUsername = import.meta.env.VITE_DEV_USERNAME;
      const devPassword = import.meta.env.VITE_DEV_PASSWORD;

      if (!devUsername || !devPassword) {
        setLoading(false);
        return;
      }
      hasLoggedIn.current = true;

      try {
        const loginResponse = await apiPost("/login-web", {
          username: devUsername,
          password: devPassword,
          isWebLogin: "Y",
        });

        storeAuthToken(loginResponse?.data?.token);
        setLoginData(loginResponse);
        mapLoginGlobals(loginResponse);
        restorePatientTabs();
      } catch (error) {
        console.error("Login initialization error.", error);
      } finally {
        setLoading(false);
      }
    };

    initializeSession();
    return () => clearInterval(timer);
  }, []);

  // Central functions to modify tab states across navigation header and table grid components
  const handleOpenPatientWorkspace = (id, name, genderCode) => {
    let currentMemoryBlock = {};
    const cached = sessionStorage.getItem("patientChartInformation");
    if (cached) currentMemoryBlock = JSON.parse(cached);

    Object.keys(currentMemoryBlock).forEach(
      (key) => (currentMemoryBlock[key].isPatientSelected = "N"),
    );

    currentMemoryBlock[`${id}_patient_details`] = {
      patientId: id,
      patientName: name,
      genderCode: genderCode,
      isPatientSelected: "Y",
      selectedMenuCode: null,
    };

    sessionStorage.setItem(
      "patientChartInformation",
      JSON.stringify(currentMemoryBlock),
    );
    setOpenTabs(
      Object.keys(currentMemoryBlock).map((key) => currentMemoryBlock[key]),
    );
    setActiveTab(id);
  };

  const handleClosePatientWorkspace = (id, e) => {
    if (e) e.stopPropagation();
    let currentMemoryBlock = {};
    const cached = sessionStorage.getItem("patientChartInformation");
    if (cached) currentMemoryBlock = JSON.parse(cached);

    // Delete the specific patient context block matching legacy array drop tracking rules
    delete currentMemoryBlock[`${id}_patient_details`];

    sessionStorage.setItem(
      "patientChartInformation",
      JSON.stringify(currentMemoryBlock),
    );
    const tabStateArray = Object.keys(currentMemoryBlock).map(
      (key) => currentMemoryBlock[key],
    );
    setOpenTabs(tabStateArray);

    // If the closed tab was the currently open active workspace view
    if (activeTab === id) {
      setActiveTab("patient_list");

      const applicationSideNavMenuContainer = document.getElementById(
        "application_side_navigation_menu_container",
      );

      // Remove the layout expanding tracking utility classes from body
      document.body.classList.remove("expanded-view", "ignore-menu-icon-view");

      // Unhide the primary menu bar navigation drawer shell container
      if (applicationSideNavMenuContainer) {
        applicationSideNavMenuContainer.classList.remove("d-none");
      }
      // ==========================================================================
    }
  };

  if (loading)
    return (
      <div className="text-center mt-5">
        Loading application framework shell...
      </div>
    );

  return (
    <div className="application">
      <Header
        currentTime={currentTime}
        userLoginDetails={loginData?.data?.user}
        productCode={loginData?.data?.user?.programCode || ""}
        baseUrl={window.location.origin}
      />

      {/* Inject shared declarative tab arrays inside the Top QuickAccess nav container */}
      <QuickAccessNav
        openTabs={openTabs}
        activeTab={activeTab}
        setActiveTab={setActiveTab}
        onCloseTab={handleClosePatientWorkspace}
      />

      <PatientListFilter />

      <div className="container-fluid p-0">
        <div className="row m-0">
          <div
            id="application_body_container"
            className="container-fluid hh-ehr-bg-color7"
          >
            <Routes>
              <Route path="/" element={<Navigate to="/patients" replace />} />
              <Route
                path="/patients"
                element={
                  <ActivePatientsList
                    openTabs={openTabs}
                    activeTab={activeTab}
                    setActiveTab={setActiveTab}
                    onOpenTab={handleOpenPatientWorkspace}
                    onCloseTab={handleClosePatientWorkspace}
                  />
                }
              />
              <Route path="/dashboard" element="" />
              <Route path="/messages" element="" />

              {/* <Route path="/messages" element={<ActivePatientsList3 />} /> */}
            </Routes>
          </div>
		</div>
      </div>

      <Footer />
    </div>
  );
};

export default App;
