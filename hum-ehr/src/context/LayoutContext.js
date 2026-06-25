import { createContext, useContext } from 'react';
/**
 * Layout context object + consumer hook. The provider component lives in
 * LayoutProvider.jsx. Keeping the hook in this component-free module is what
 * lets React Fast Refresh work (a file may not export both a component and a
 * hook).
 */
export const LayoutContext = createContext(null);
export const useLayout = () => {
    const context = useContext(LayoutContext);
    if (!context)
        throw new Error('useLayout must be used within a LayoutProvider.');
    return context;
};
