import { createSlice } from '@reduxjs/toolkit';
import { getAuthToken, getLoggedInUser } from '../services/authService';
/**
 * Auth slice — the reference example for this codebase's Redux conventions.
 *
 * IMPORTANT: the `X-Auth-Token` cookie (managed by authService) remains the
 * source of truth for API transport — apiClient reads it on every request.
 * This slice MIRRORS auth state into the store so components can read the
 * logged-in user reactively without prop-drilling. We hydrate from the
 * cookie/JWT at startup so a page reload keeps the user populated.
 *
 * Reducers stay pure (no cookie writes here); the caller pairs a dispatch with
 * the authService cookie call — see App.jsx's login flow.
 */
const initialState = {
    user: getLoggedInUser(),
    token: getAuthToken() || null,
};
const authSlice = createSlice({
    name: 'auth',
    initialState,
    reducers: {
        setCredentials(state, action) {
            const { user, token } = action.payload ?? {};
            if (user !== undefined)
                state.user = user;
            if (token !== undefined)
                state.token = token;
        },
        clearCredentials(state) {
            state.user = null;
            state.token = null;
        },
    },
});
export const { setCredentials, clearCredentials } = authSlice.actions;
export const selectAuthUser = (state) => state.auth.user;
export const selectAuthToken = (state) => state.auth.token;
export const selectIsAuthenticated = (state) => Boolean(state.auth.token);
export default authSlice.reducer;
