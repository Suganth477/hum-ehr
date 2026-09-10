import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import { Routes, Route, Navigate, Outlet } from 'react-router-dom';
import { apiPost } from './services/apiClient';
import { getAuthToken, storeAuthToken } from './services/authService';
// Components
import Footer from './components/Footer';
import Header from './components/Header';
import PatientListFilter from './components/PatientListFilter';
import { PatientListFilterProvider } from './context/PatientListFilterProvider';
import QuickAccessNav from './components/QuickAccessNav';
import ErrorBoundary from './components/ErrorBoundary';
import NotFound from './components/NotFound';
import { SkeletonTable } from './components/common/ContentLoader';
import { LayoutProvider } from './context/LayoutProvider';
import { NotificationProvider } from './context/NotificationProvider';
import { useAppDispatch } from './store/hooks';
import { setCredentials } from './store/authSlice';
// 1. Third-party framework styles (load first).
// PrimeFlex must load BEFORE Bootstrap: both define non-responsive `.col-1..12`,
// and this app uses Bootstrap's grid (`.row` + responsive `.col-{bp}-*`). With
// PrimeFlex loaded last, its plain `.col-12` (no media query) won the cascade over
// Bootstrap's `.col-md-*`, collapsing multi-column form rows into a single stacked
// column on desktop. Loading Bootstrap last makes its grid authoritative.
import 'primeflex/primeflex.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import 'primeicons/primeicons.css';
import 'primereact/resources/primereact.min.css';
import 'primereact/resources/themes/lara-light-indigo/theme.css';
import 'flatpickr/dist/flatpickr.min.css';
// 2. Custom bundle (must be imported last)
import './App.css';

// Responsive overrides — must load after App.css so its media queries win.
import './styles/responsive.css';

// Route-level code-splitting: the patient list and message center load on demand.
const ActivePatientsList = lazy(() => import('./js/patientlist/ActivePatientsList'));
const MessageCenter = lazy(() => import('./js/message-center/MessageCenter'));

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
    // Holds the in-flight dev login so StrictMode's second effect pass awaits the same
    // request instead of falling through. With a plain `hasLoggedIn` boolean the second
    // pass returned early and cleared `loading`, so the shell rendered (and its lookups
    // fired) before the token existed — the first 401 then wiped the cookie and bounced
    // the app to /logout on every cold load.
    const loginRequest = useRef(null);
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
            if (getAuthToken()) {
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
            loginRequest.current = loginRequest.current || apiPost('/login-web', {
                username: devUsername,
                password: devPassword,
                isWebLogin: 'Y',
            });
            try {
                const loginResponse = await loginRequest.current;
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
    // Patient deactivation / deceased save (Patient Profile) closes the
    // workspace tab and returns to the list, mirroring the legacy flow.
    useEffect(() => {
        const onForcedClose = (event) => {
            const id = event.detail?.patientId;
            if (!id) return;
            const memory = readMemory();
            delete memory[`${id}_patient_details`];
            sessionStorage.setItem('patientChartInformation', JSON.stringify(memory));
            setOpenTabs(Object.values(memory));
            setActiveTab('patient_list');
        };
        window.addEventListener('hum-ehr:closePatientTab', onForcedClose);
        return () => window.removeEventListener('hum-ehr:closePatientTab', onForcedClose);
    }, []);
    const AppLayout = () => (
        <div className="application">
            <Header baseUrl={window.location.origin} />
            <QuickAccessNav openTabs={openTabs} activeTab={activeTab} setActiveTab={setActiveTab} onCloseTab={handleClosePatientWorkspace} />
            <PatientListFilter />
            <div className="container-fluid p-0">
                <div className="row m-0">
                    <div id="application_body_container" className="container-fluid hh-ehr-bg-color7">
                        <ErrorBoundary>
                            <Suspense fallback={<div className="p-3"><SkeletonTable /></div>}>
                                <Outlet />
                            </Suspense>
                        </ErrorBoundary>
                    </div>
                </div>
            </div>
            <Footer />
        </div>
    );
    if (loading)
        return <div className="text-center mt-5">Loading application framework shell...</div>;
    return (<NotificationProvider>
        <LayoutProvider>
            <PatientListFilterProvider>
                <Routes>
                    <Route element={<AppLayout />}>
                        <Route path="/" element={<Navigate to="/patients" replace />} />
                        <Route path="/patients" element={<ActivePatientsList activeTab={activeTab} onOpenTab={handleOpenPatientWorkspace} />} />
                        <Route path="/dashboard" element={<div className="p-4 text-muted">Dashboard (not migrated yet).</div>} />
                        <Route path="/message-center" element={<MessageCenter />} />
                    </Route>
                    <Route path="*" element={<NotFound />} />
                </Routes>
            </PatientListFilterProvider>
        </LayoutProvider>
    </NotificationProvider>);
};

export default App;
