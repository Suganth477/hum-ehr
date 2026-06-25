import { configureStore } from '@reduxjs/toolkit';
import authReducer from './authSlice';
/**
 * Application Redux store. Register one reducer per feature slice here.
 * `configureStore` wires up the Redux DevTools and the default middleware
 * (including thunks) automatically. See ./README.md for conventions.
 */
export const store = configureStore({
    reducer: {
        auth: authReducer,
    },
});
export default store;
