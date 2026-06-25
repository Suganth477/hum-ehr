import { useCallback, useMemo, useRef } from 'react';
import { Toast } from 'primereact/toast';
import { NotificationContext } from './NotificationContext';
/**
 * App-level toast notifications. Replaces the migration's silent
 * `catch { console.error(...) }` blocks and the legacy `alert()` calls with a
 * single, non-blocking toast surface. Consume it with `useNotify()`.
 */
export const NotificationProvider = ({ children }) => {
    const toastRef = useRef(null);
    const notify = useCallback((options) => {
        toastRef.current?.show({ life: 4000, ...options });
    }, []);
    const notifyError = useCallback((detail, summary = 'Error') => {
        notify({ severity: 'error', summary, detail: detail || 'Something went wrong. Please try again.' });
    }, [notify]);
    const notifySuccess = useCallback((detail, summary = 'Success') => {
        notify({ severity: 'success', summary, detail });
    }, [notify]);
    const value = useMemo(() => ({ notify, notifyError, notifySuccess }), [notify, notifyError, notifySuccess]);
    return (<NotificationContext.Provider value={value}>
        <Toast ref={toastRef} position="top-right" />
        {children}
    </NotificationContext.Provider>);
};
