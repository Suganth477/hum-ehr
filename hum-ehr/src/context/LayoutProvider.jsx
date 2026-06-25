import { useCallback, useEffect, useMemo, useState } from 'react';
import { LayoutContext } from './LayoutContext';
/**
 * Owns the application shell layout state (the `<body>` view-mode classes, the
 * side-navigation visibility, and the mobile nav drawer) that the legacy
 * screens drove by poking the DOM directly. Components read/update this state
 * through `useLayout()` and a single effect mirrors it onto `document.body`,
 * which lives outside the React root. Nothing should toggle these classes by
 * hand anymore.
 */
const INITIAL_LAYOUT = {
    expandedView: false,
    ignoreMenuIcon: false,
    sideNavHidden: false,
    // Mobile off-canvas drawer (used below the `lg` breakpoint). Independent of
    // the desktop `sideNavHidden`/hover-expand behaviour.
    mobileNavOpen: false,
};
export const LayoutProvider = ({ children }) => {
    const [layout, setLayout] = useState(INITIAL_LAYOUT);
    useEffect(() => {
        const { classList } = document.body;
        classList.toggle('expanded-view', layout.expandedView);
        classList.toggle('ignore-menu-icon-view', layout.ignoreMenuIcon);
        classList.toggle('mobile-nav-open', layout.mobileNavOpen);
    }, [layout.expandedView, layout.ignoreMenuIcon, layout.mobileNavOpen]);
    // Patient-chart view collapses the side nav and expands the content area;
    // the patient-list view restores the default layout. Also closes the mobile
    // drawer so a navigation never leaves it hanging open.
    const setChartView = useCallback((isChartView) => {
        setLayout((previous) => ({
            ...previous,
            expandedView: isChartView,
            ignoreMenuIcon: isChartView,
            sideNavHidden: isChartView,
            mobileNavOpen: false,
        }));
    }, []);
    // Mirrors the legacy header menu-button behaviour exactly, but on state
    // instead of by reading/toggling `document.body` class names.
    const toggleSideMenu = useCallback(() => {
        setLayout((previous) => {
            const next = { ...previous };
            if (!next.expandedView)
                next.expandedView = true;
            else if (!next.ignoreMenuIcon)
                next.expandedView = false;
            if (next.ignoreMenuIcon)
                next.sideNavHidden = !next.sideNavHidden;
            return next;
        });
    }, []);
    const toggleMobileNav = useCallback(() => setLayout((previous) => ({ ...previous, mobileNavOpen: !previous.mobileNavOpen })), []);
    const closeMobileNav = useCallback(() => setLayout((previous) => (previous.mobileNavOpen ? { ...previous, mobileNavOpen: false } : previous)), []);
    const value = useMemo(() => ({ ...layout, setChartView, toggleSideMenu, toggleMobileNav, closeMobileNav }), [layout, setChartView, toggleSideMenu, toggleMobileNav, closeMobileNav]);
    return <LayoutContext.Provider value={value}>{children}</LayoutContext.Provider>;
};
