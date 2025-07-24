import moment from 'moment-timezone';
import { useEffect, useRef, useState } from 'react';

// Components
import Footer from './components/Footer';
import Header from './components/Header';
import PatientListFilter from './components/PatientListFilter';
import QuickAccessNav from './components/QuickAccessNav';
import Sidebar from './components/Sidebar';

// Styles
import '@eonasdan/tempus-dominus/dist/css/tempus-dominus.min.css';
import 'bootstrap-daterangepicker/daterangepicker.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'datatables.net-bs5/css/dataTables.bootstrap5.css';
import 'jquery-confirm/dist/jquery-confirm.min.css';
import 'material-design-icons-iconfont/dist/material-design-icons.css';
import 'primeflex/primeflex.css';
import 'primeicons/primeicons.css';
import 'primereact/resources/primereact.min.css';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import './App.css';
import env from './env';

//List
import ActivePatientsList from './js/patientlist/ActivePatientsList';

import Cookies from 'js-cookie';
import ActivePatientsList3 from './js/patientlist/ActivePatientsList3';

const App = () => {
  const [currentTime, setCurrentTime] = useState(moment());
  const [loginData, setLoginData] = useState(null);
  const [component, setComponent] = useState([]);
  const [loading, setLoading] = useState(true);
  const hasLoggedIn = useRef(false);

  useEffect(() => {
    // Time updater
    const timer = setInterval(() => {
      setCurrentTime(moment());
    }, 1000);

    // Login logic
    const login = async () => {
      if (Cookies.get('X-Auth-Token') || hasLoggedIn.current) {
        // If already logged in, skip login process
        setLoading(false);
        return;
      }
      hasLoggedIn.current = true;

      try {
        const response = await fetch(`${env.BASE_URL}/login-web`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            username: "testing_benjamin",
            password: "Humworld@1",
            isWebLogin: "Y"
          })
        });

        if (!response.ok) throw new Error('Login failed');
        const loginResponse = await response.json();

        Cookies.set('X-Auth-Token', loginResponse.data.token, {
          expires: 1, // 1 day
          path: '/',
        });

        setLoginData(loginResponse);
      } catch (err) {
        console.error('Login error:', err);
        alert('Login failed. Please check credentials.');
      } finally {
        setLoading(false);
      }
    };

    login();

    return () => {
      clearInterval(timer); // Cleanup time interval
    };
  }, []);

  const handleMenuClick = (componentName) => {
    let components;
    switch (componentName) {
      case "patientList":
        components = <ActivePatientsList />;
        break;
      case "messageCenter":
        components = <ActivePatientsList3 />;
        break;
      default:
        break;
    }
    setComponent([components]);
  };

  if (loading) return <div className="text-center mt-5">Loading...</div>;

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
        userLoginDetails={loginData?.user}
        productCode={loginData?.productCode}
        baseUrl="https://releasetestapi.humhealth.com/HumHealthTestingAPI"
      />

      {/* Quick Access Side Nav */}
      <QuickAccessNav />
      <PatientListFilter />
      {/* Offcanvas for Filters */}

      {/* Sidebar and Main Content */}
      <div className="container-fluid p-0">
        <div className="row">
          <Sidebar onmenuClick={handleMenuClick} />
          <div id="application_body_container" className="container-fluid hh-ehr-bg-color7">
            {component}
          </div>
        </div>
      </div>
      {/* Footer */}
      <Footer />
    </div>
  );
};

export default App;