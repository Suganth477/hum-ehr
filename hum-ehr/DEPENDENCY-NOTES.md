# Dependency Notes

Snapshot from the optimization pass. Use this to decide which UI/utility
libraries the migration will standardize on. "Unused" means **zero `import`
references in `src/`** at the time of writing — verify with a quick grep before
acting, since later screens may have wired one up.

## Removed

These were dead and have been removed from `package.json`:

- **AG Grid** — `@ag-grid-community/react` (`^32.3.5`), `ag-grid-community`,
  `ag-grid-enterprise`, `ag-grid-react` (all `^34.0.2`). Unused, and the `^32`
  vs `^34` split was a version mismatch. The patient list uses PrimeReact
  `DataTable`.
- **Redux dead stubs** — the unused `src/js/app/store.js` (exported `null`) and
  `src/js/slices/userSlice.js` (no-op reducer) were removed; no store had been
  wired into `main.jsx`. **NOTE:** Redux Toolkit was subsequently
  **re-introduced intentionally** as the state-management standard — see
  `src/store/` and `src/store/README.md`. `@reduxjs/toolkit` + `react-redux` are
  now wired into a real store (`<Provider>` in `main.jsx`, `auth` slice consumed
  reactively by the Header).

## Unused but retained (kept for upcoming migrated screens)

Currently zero references in `src/`. Kept by decision — re-evaluate as screens
land:

| Area | Packages |
| --- | --- |
| Grids/tables | `@mui/x-data-grid`, `@tanstack/react-table`, `datatables.net-bs5` |
| MUI / styling | `@mui/icons-material`, `@emotion/react`, `@emotion/styled` |
| Rich text / charts | `quill`, `chart.js` |
| Date pickers | `bootstrap-daterangepicker`, `@eonasdan/tempus-dominus` |
| jQuery-era | `jquery-confirm` |
| FontAwesome (npm) | `@fortawesome/fontawesome-svg-core`, `@fortawesome/free-solid-svg-icons`, `@fortawesome/react-fontawesome` |
| Bootstrap (React) | `react-bootstrap` |

## Consolidation recommendations (decisions needed)

The project carries several libraries that solve the same problem. Pick one per
row and drop the rest to cut bundle size and decision-fatigue:

- **Grid/table:** PrimeReact `DataTable` (in use) vs `@mui/x-data-grid` vs
  `@tanstack/react-table` vs `datatables.net-bs5`.
- **Date picker:** `flatpickr` + `react-flatpickr` (in use) vs
  `bootstrap-daterangepicker` vs `@eonasdan/tempus-dominus`.
- **Icons:** `material-design-icons-iconfont` is the one imported (in
  `App.jsx`); `@material-design-icons/font` and `material-design-icons` look
  unused. **Caution:** the `mdi mdi-*` classes used throughout the markup have
  **no obvious source package** in `package.json` (that prefix is the
  Pictogrammers `@mdi/font`, which is not a dependency). Confirm what renders
  those glyphs — possibly a local asset — before changing any icon package, or
  icons will silently break.

## Follow-ups noted elsewhere

- Server-set `httpOnly` auth cookie + token refresh (backend change).
- Thread an `AbortController` `signal` through the service layer (the
  `apiClient` helpers already forward axios `cfg`, so `{ signal }` works there).
- Migrate the embedded legacy web components in `PatientChart.jsx` to React.
- Decide the **server-data fetching** convention for Redux (RTK Query vs
  `createAsyncThunk`) when the next data screen is built — see
  `src/store/README.md`.
