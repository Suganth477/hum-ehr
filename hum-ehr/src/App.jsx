import { useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { apiPost } from './services/apiClient';
import { getAuthToken, storeAuthToken } from './services/authService';
// Components
import Footer from './components/Footer';
import Header from './components/Header';
import PatientListFilter from './components/PatientListFilter';
import QuickAccessNav from './components/QuickAccessNav';
import ErrorBoundary from './components/ErrorBoundary';
import ActivePatientsList from './js/patientlist/ActivePatientsList';
import { LayoutProvider } from './context/LayoutProvider';
import { NotificationProvider } from './context/NotificationProvider';
import { useAppDispatch } from './store/hooks';
import { setCredentials } from './store/authSlice';
// 1. Third-party framework styles (load first)
import 'bootstrap/dist/css/bootstrap.min.css';
import 'material-design-icons-iconfont/dist/material-design-icons.css';
import 'primeflex/primeflex.css';
import 'primeicons/primeicons.css';
import 'primereact/resources/primereact.min.css';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'flatpickr/dist/flatpickr.min.css';
// 2. Custom bundle (must be imported last)
import './App.css';

import "./assets/plugins/font-awesome-pro/all.min.css";
import "./assets/plugins/font-awesome-pro/all.min.js";
import "./assets/css/fontawesome/css/font-awesome.css";

// Responsive overrides — must load after App.css so its media queries win.
import './styles/responsive.css';

const readMemory = () => {
    const cached = sessionStorage.getItem('patientChartInformation');
    if (!cached)
        return {};
    try {
        return JSON.parse(cached);
    }
    catch {
        return {};
    }
};
const App = () => {
    const [loading, setLoading] = useState(true);
    const hasLoggedIn = useRef(false);
    const dispatch = useAppDispatch();
    const [openTabs, setOpenTabs] = useState([]);
    const [activeTab, setActiveTab] = useState('patient_list');
    useEffect(() => {
        const restorePatientTabs = () => {
            const parsedTabs = readMemory();
            if (!Object.keys(parsedTabs).length)
                return;
            const tabsArr = Object.values(parsedTabs);
            setOpenTabs(tabsArr);
            const currentlyActive = tabsArr.find((tab) => tab.isPatientSelected === 'Y');
            if (currentlyActive)
                setActiveTab(currentlyActive.patientId);
        };
        const initializeSession = async () => {
            if (getAuthToken() || hasLoggedIn.current) {
                restorePatientTabs();
                setLoading(false);
                return;
            }
            // Dev-only auto-login. `import.meta.env.DEV` is statically false in
            // production builds, so Vite strips this block entirely and the dev
            // credentials never ship in the production bundle.
            const devUsername = import.meta.env.DEV ? import.meta.env.VITE_DEV_USERNAME : undefined;
            const devPassword = import.meta.env.DEV ? import.meta.env.VITE_DEV_PASSWORD : undefined;
            if (!devUsername || !devPassword) {
                setLoading(false);
                return;
            }
            hasLoggedIn.current = true;
            try {
                const loginResponse = await apiPost('/login-web', {
                    username: devUsername,
                    password: devPassword,
                    isWebLogin: 'Y',
                });
                storeAuthToken(loginResponse?.data?.token);
                dispatch(setCredentials({ user: loginResponse?.data?.user, token: loginResponse?.data?.token }));
                restorePatientTabs();
            }
            catch (error) {
                console.error('Login initialization error.', error);
            }
            finally {
                setLoading(false);
            }
        };
        initializeSession();
    }, [dispatch]);
    const handleOpenPatientWorkspace = (id, name, genderCode) => {
        const memory = readMemory();
        Object.keys(memory).forEach((key) => {
            memory[key].isPatientSelected = 'N';
        });
        memory[`${id}_patient_details`] = {
            patientId: id,
            patientName: name,
            genderCode,
            isPatientSelected: 'Y',
            selectedMenuCode: null,
        };
        sessionStorage.setItem('patientChartInformation', JSON.stringify(memory));
        setOpenTabs(Object.values(memory));
        setActiveTab(id);
    };
    const handleClosePatientWorkspace = (id, e) => {
        e?.stopPropagation();
        const memory = readMemory();
        delete memory[`${id}_patient_details`];
        sessionStorage.setItem('patientChartInformation', JSON.stringify(memory));
        setOpenTabs(Object.values(memory));
        if (activeTab === id) {
            // Returning to the list re-triggers ActivePatientsList's layout
            // effect, which resets the body/side-nav classes via LayoutContext.
            setActiveTab('patient_list');
        }
    };
    if (loading)
        return <div className="text-center mt-5">Loading application framework shell...</div>;
    return (<NotificationProvider>
        <LayoutProvider>
            <div className="application">
        <Header baseUrl={window.location.origin} />

        <QuickAccessNav openTabs={openTabs} activeTab={activeTab} setActiveTab={setActiveTab} onCloseTab={handleClosePatientWorkspace} />

        <PatientListFilter />

        <div className="container-fluid p-0">
            <div className="row m-0">
                <div id="application_body_container" className="container-fluid hh-ehr-bg-color7">
                    <ErrorBoundary>
                    <Routes>
                        <Route path="/" element={<Navigate to="/patients" replace />} />
                        <Route path="/patients" element={<ActivePatientsList activeTab={activeTab} onOpenTab={handleOpenPatientWorkspace} />} />
                        <Route path="/dashboard" element={<div className="p-4 text-muted">Dashboard (not migrated yet).</div>} />
                        <Route path="/messages" element={<div className="p-4 text-muted">Message Center (not migrated yet).</div>} />
                    </Routes>
                    </ErrorBoundary>
                </div>
            </div>
        </div>

        <Footer />
            </div>
        </LayoutProvider>
    </NotificationProvider>);
};

export default App;
