# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev       # Start Vite dev server with HMR
npm run build     # Production build
npm run lint      # ESLint check
npm run preview   # Preview production build
```

No test runner is configured.

## Architecture Overview

This is a React 19 + Vite healthcare EHR (Electronic Health Records) app. The project root is `hum-ehr/` inside this repo.

### Entry & Routing

`src/main.jsx` wraps the app in Redux `Provider` → `BrowserRouter` → `StrictMode`.

`src/App.jsx` is the root: it handles dev auto-login (credentials from `.env`), restores open patient tabs from `sessionStorage`, and renders a tab bar (`QuickAccessNav`) that switches between the patient list and patient chart workspaces. Routes: `/` → redirect, `/patients` → `ActivePatientsList`.

### State Management

- **Redux Toolkit** (`src/store/`) — auth only. `authSlice` holds `user` (decoded JWT) and `token`. The cookie (`X-Auth-Token`) is the source of truth; Redux mirrors it. Use `useAppDispatch`/`useAppSelector` from `src/store/hooks.js`, not the raw hooks.
- **Context API** — `LayoutContext` (sidebar/drawer CSS state) and `NotificationContext` (PrimeReact Toast). Both providers live in `src/context/`.

### API Layer

`src/services/apiClient.js` — Axios instance with:
- Base URL from `config.apiBaseUrl` (set via `VITE_API_BASE_URL`)
- Request interceptor: injects `X-Auth-Token` cookie into headers
- Response interceptor: unwraps `response.data` so callers get data directly; handles 401 by clearing cookie and redirecting to `/logout`

Use the named helpers (`apiGet`, `apiPost`, `apiPut`, `apiDelete`, `apiPostForm`, `apiPostMultipart`) — never call `axios` directly. All endpoints are centralized in `src/services/endpoints.js`.

Service files: `authService.js`, `patientService.js`, `allergyService.js`, `lookupService.js`.

### Feature Modules

`src/js/` holds page-level feature modules:
- `patientlist/` — patient search/filter list with debounced loading and lazy pagination
- `patient-ehr/` — patient chart workspace; sub-modules per clinical domain (allergies, etc.)

`src/components/` holds shared UI (Header, Sidebar, ErrorBoundary, etc.).

### Responsive Pattern

`useIsTabletOrBelow()` hook drives layout switches. Desktop uses PrimeReact `DataTable`; tablet/mobile uses card layouts.

### Session Persistence

Open patient tabs are stored in `sessionStorage` (not `localStorage`) under keys like `{patientId}_patient_details`. The `readMemory()` utility in `src/utils/` restores this on load.

### Environment Variables

| Variable | Purpose |
|---|---|
| `VITE_API_BASE_URL` | Backend API base URL |
| `VITE_DEV_USERNAME` / `VITE_DEV_PASSWORD` | Dev-only auto-login credentials |

### Tech Stack

| Concern | Library |
|---|---|
| UI components | PrimeReact 10, Bootstrap 5, MUI Icons |
| Routing | React Router 7 |
| State | Redux Toolkit 2, React Context |
| HTTP | Axios 1 |
| Auth | JWT in cookies via js-cookie |
| Date/time | Moment + Moment Timezone, Flatpickr |
| Icons | FontAwesome 7, Material Design Icons |
