# State management conventions

This app uses **Redux Toolkit (RTK)** for shared application state. This folder
holds the store and its feature slices. `authSlice.js` is the reference example
— copy its shape when adding new slices.

## When to use what

Pick the **lowest-power** tool that fits. Not everything belongs in Redux.

| Need | Use | Examples here |
| --- | --- | --- |
| State for one component (or a parent + a couple children) | `useState` / props | form fields, expand/collapse, pagination |
| Localized cross-component UI concern, app-wide but ephemeral | **React Context** | `LayoutProvider` (body/side-nav classes), `NotificationProvider` (toasts) |
| App state shared across distant, unrelated components | **Redux slice** | logged-in user (`authSlice`) |
| Server data (cache, dedupe, loading/error, invalidation) | **TBD — see below** | patients, allergies, lookups |

Do **not** move toasts or layout flags into Redux "for consistency" — Context is
the correct tool for those, and mixing the two is normal and expected.

## Adding a slice

1. Create `src/store/<feature>Slice.js` modeled on `authSlice.js`:
   - `createSlice({ name, initialState, reducers })`
   - export the generated actions, a few `select*` selectors, and the reducer as default.
2. Register it in `store.js`:
   ```js
   reducer: { auth: authReducer, <feature>: <feature>Reducer }
   ```
3. In components, read with `useAppSelector(selectX)` and write with
   `useAppDispatch()` + an action. Always import the hooks from
   `src/store/hooks.js`, never from `react-redux` directly.
4. Keep reducers **pure** — no API calls, cookie writes, or other side effects
   inside them. Pair the dispatch with the side effect in the caller (see how
   `App.jsx` calls `storeAuthToken(...)` alongside `dispatch(setCredentials(...))`).

## Auth specifics

The `X-Auth-Token` cookie (managed by `services/authService.js`) stays the
**source of truth for API transport** — `apiClient` reads it on every request.
`authSlice` *mirrors* auth state into the store so components read the user
reactively; it hydrates from the cookie/JWT on startup so a reload stays logged
in. Token in cookie = how requests authenticate; token/user in the store = how
the UI reacts.

## Async / data fetching — not yet standardized

This first pass intentionally covers only client/app state. The convention for
loading **server data** through the store (the choice between **RTK Query** —
recommended for this API-heavy app, wrapping the existing axios client via an
`axiosBaseQuery` — vs. `createAsyncThunk` over the `services/` layer) should be
decided when the next data screen is built, then documented here. Until then,
data fetching continues to live in `services/` + component effects.
