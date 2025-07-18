import React, { useState, useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import moment from 'moment-timezone';
import 'moment-timezone';

// Components
import Header from './components/Header';
import Sidebar from './components/Sidebar';
import Footer from './components/Footer';
import QuickAccessNav from './components/QuickAccessNav';
import FilterOffcanvas from './components/FilterOffCanvas';

// Styles
import './App.css';
import 'material-design-icons-iconfont/dist/material-design-icons.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import '@eonasdan/tempus-dominus/dist/css/tempus-dominus.min.css';
import 'bootstrap-daterangepicker/daterangepicker.css';
import 'datatables.net-bs5/css/dataTables.bootstrap5.css';
import 'jquery-confirm/dist/jquery-confirm.min.css';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'primereact/resources/primereact.min.css';
import 'primeicons/primeicons.css';
import 'primeflex/primeflex.css';

//List
import ActivePatientsList3 from './components/ActivePatientsList3';
import ActivePatientsList1 from './components/ActivePatientList1';

const App = ({ userLoginDetails, userFullName, productCode}) => {
  const [currentTime, setCurrentTime] = useState(moment());
  const [component, setComponent] = useState([]);

  // Global variables
  const url = window.location.origin;

  useEffect(() => {
    // Update time every second
    const timer = setInterval(() => {
      setCurrentTime(moment());
    }, 1000);

    return () => clearInterval(timer);
  }, []);

   const handleMenuClick = (componentName) => {
    let components;
    switch (componentName) {
      case "messageCenter":
        components = <ActivePatientsList3/>
        break;
      case "patientList":
        components = <ActivePatientsList1/>
        break;
      default:
        break;
    }
    setComponent([components]);
  }

  return (
    <div className="application">
      {/* Application Info Container */}
      <div id="application_info_container" className="d-none px-3 py-2 text-center text-bold skippy hh-ehr-bg-color1">
        <p className="hh-ehr-color1 text-decoration-none mb-0">This is a newer version of Humhealth!</p>
        <span className="app-info-close-icon mdi mdi-close-circle-outline"></span>
      </div>
      {/* Main Header */}
      <Header 
        currentTime={currentTime} 
        userLoginDetails={userLoginDetails}
        productCode={productCode}
        baseUrl="https://releasetestapi.humhealth.com/HumHealthTestingAPI"
      />

      {/* Quick Access Side Nav */}
      <QuickAccessNav />

      {/* Sidebar and Main Content */}
      <div className="container-fluid p-0">
        <div className="row">
          <Sidebar onmenuClick={handleMenuClick}/>
        <div id="application_body_container" className="container-fluid hh-ehr-bg-color7">
          {component}
        </div>
        </div>
      </div>
      {/* Filter Offcanvas */}
      <FilterOffcanvas />
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default App;