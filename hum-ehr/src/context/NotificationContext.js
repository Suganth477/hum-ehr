import { createContext, useContext } from 'react';
/**
 * Notification context object + consumer hook. The provider component (which
 * renders the PrimeReact Toast) lives in NotificationProvider.jsx. Keeping the
 * hook in this component-free module is what lets React Fast Refresh work.
 */
export const NotificationContext = createContext(null);
export const useNotify = () => {
    const context = useContext(NotificationContext);
    if (!context)
        throw new Error('useNotify must be used within a NotificationProvider.');
    return context;
};
