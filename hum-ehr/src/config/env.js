// IMPORTANT SECURITY NOTE
// -----------------------------------------------------------------------------
// The old `env.js` shipped secrets (APP_KEY, RD, BUGSNAG_API_KEY, DB-style
// values) inside the client bundle. ANYTHING imported here is downloaded by the
// browser and is fully readable by any user via devtools. For a healthcare app
// this is a compliance problem. Those values must live ONLY on the server.
//
// This file keeps just the handful of values the browser legitimately needs,
// read from Vite env vars (prefixed VITE_, set in `.env` / deployment config).
// Provide them in .env.local, e.g.:
//   VITE_API_BASE_URL=https://dev-api.humhealth.com/HumHealthDevAPI
//   VITE_APP_VERSION=021201
//   VITE_RPM_DEVICE_ENV=TEST
export const config = {
    apiBaseUrl: import.meta.env.VITE_API_BASE_URL ?? '',
    appVersion: import.meta.env.VITE_APP_VERSION ?? '',
    deviceEnv: import.meta.env.VITE_RPM_DEVICE_ENV ?? 'TEST',
};
export default config;
