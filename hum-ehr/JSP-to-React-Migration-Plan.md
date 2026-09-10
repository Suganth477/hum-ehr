# Enterprise JSP + jQuery to React Vite Migration

> **Document version:** 4.0 (synced to the hum-ehr codebase as actually built)
> **Change summary v2:** coexistence architecture, CSRF, auth handoff, testing/visual-regression, Vite build/deploy, HIPAA specifics, plugin lifecycle, sequencing/rollback. Marked **[ADDED]**.
> **Change summary v3:** libraries adopted during active migration; form validation, SweetAlert2, react-select, PrimeReact, Redux auth, TanStack Table, Chart.js, Quill, js-cookie, icons. Marked **[v3]**.
> **Change summary v4 (this revision):** Reconciled the doc with the real codebase. Corrections marked **[v4]**: (1) **DayJS WAS adopted** — Moment.js removed (v3 said the opposite); (2) **icons are now exact-vector SVGs via `LegacyIcon`** — all icon *fonts* (FA Pro, MDI, MUI) removed; (3) removed dead libraries (react-bootstrap, @mui/*, @tanstack/react-table, datatables.net, jquery-confirm, tempus-dominus, bootstrap-daterangepicker) — **PrimeReact `DataTable`** is the table standard; (4) **TanStack Query + Virtual adopted Message-Center-only**; (5) observability = **Bugsnag**; (6) types = **JSDoc + jsconfig checkJs**; (7) Bootstrap JS = **native (data-bs-*/refs)**, react-bootstrap removed; (8) base path `/emr/`; (9) testing **parked**, verification is manual "drive the running app"; (10) added **Migration Status** and corrected the folder structure to what exists; (11) added a **Problem Statement — Legacy Architecture Issues** section (scriptlet dependencies, architectural bottlenecks, tight coupling) grounded in the current legacy source. Several v2 `[DECISION]` items are now **[RESOLVED]**.

---

## Role

You are a Senior Full Stack Software Architect and Migration Specialist (Java 17 · Spring MVC 6 · Hibernate · JSP · Bootstrap · jQuery · React 19 · Vite · Axios · enterprise healthcare/EHR migration · performance). Your responsibility: migrate the HumHealth EHR frontend from JSP to React while preserving every functionality.

---

# Primary Objective

Convert the existing Spring MVC + JSP + jQuery frontend into a React + Vite app **without changing any business functionality**. Migration is **incremental** (JSP and React coexist for months). **Backend APIs are unchanged.** Only the frontend is migrated.

---

# Existing Technology Stack

**Backend:** Java 17 · Spring MVC 6 · Hibernate · MySQL · Tomcat 10 · JSP · JSTL.
**Frontend:** HTML5 · CSS3 · Bootstrap · JavaScript · jQuery · Flatpickr · Font Awesome Pro · Moment.js · DataTables · custom JS utility framework.
**Auth:** Session + Cookie + `X-Auth-Token` + Spring Session.

---

# Problem Statement — Legacy Architecture Issues **[v4 — NEW]**

> Grounded in the current legacy source (Workspace 3 snapshot: `hum-js.zip`, `hum-application.zip`, `ehr-layout.jsp`, `services/utility.js`, `services/api.utility.js`, `services/request.js`, `services/active.session.handle.js`, `css/hum-css/ehr-theme-style.css`, `css/hum-css/patient-chart-style.css`). These are the **architectural drivers** for the migration — what the React target is built to remove. They are documented here as *problems to eliminate*, not behaviors to preserve (the conversion still preserves every user-facing **business** behavior; see "Important Rule").

## 1. Scriptlet dependencies — the frontend cannot boot without the servlet container

`ehr-layout.jsp` is not HTML; it is a Java template whose runtime config and page structure are produced by **JSP scriptlets at request time**, so the client cannot be served as static assets or run outside Spring MVC:

- **Java executes in the view.** Eight `<%@ page import %>` declarations (`UserLoginDetailsDto`, `WebServiceUtil`, `Environment`, `LocalDate`, …) and inline Java pull request attributes (`request.getAttribute("userLoginDetails")`, `environment.getRequiredProperty(...)`).
- **All global runtime config is server-injected into JS via `<%= %>`.** `const api`, `const env`, `const signalUrl`, `const appVersion`, `const screenLockDuration` (computed server-side as `getTimeOutDuration()*60*1000`), `WRIGHT_CENTER_CARE_GROUP_ID`, `EAST_ALABAMA_CARE_GROUP_ID`, `CHIME_URL`, `FORM_TIME_OUT_DURATION`, plus role/care-team constants from EL (`${ROLE_DESC_*}`, `${CARE_TEAM_ROLE_TYPE_*}`, `${token}`, `${baseUrl}`, `${productCode}`). **Every downstream JS module reads these page-scoped globals.**
- **Page structure is gated by server-side role scriptlets** — `<% if (userRoleCode.equals(PHYSICIAN_ROLE_CODE) …) { %> <jsp:include …/> <% } %>` wrap the notification tray and the entire message-center include; the DOM composition depends on Java role checks.
- **Server data flows straight into the DOM** — `<body data-care-group-name="<%= …getCareGroupName() %>" data-group-id="<%= … %>">`, `<meta name="X-Auth-Token" content="${token}">`, and the whole body assembled by `<jsp:include page="${content}" />`.

**Impact:** no static hosting/CDN, no independent frontend build or deploy, config changes need a JSP redeploy, and the client is welded to the request lifecycle. The React target replaces this with build-time `import.meta.env` + a runtime bootstrap, so the SPA ships as static assets behind `/emr/`.

## 2. Architectural bottlenecks

- **God-object singletons carry the whole app.** Four always-loaded globals total ~11k lines:
  `utility.js` (**5,707 lines**, one `const utility = new Utility()` — ICD formatting, badge HTML, toasts, JWT parsing, loaders, cookie access, all in one object), `api.utility.js` (**4,498 lines**, one `ApiUtility` singleton with **368 endpoint methods** and a single `API_END_POINT_URL` map — every screen's data access funnels through it), `request.js` (184), `active.session.handle.js` (543). A single point of contention and a change-amplifier.
- **Blocking, CDN-heavy boot.** `ehr-layout.jsp` loads ~40 render-blocking `<script>`/`<link>` tags on **every** page (jQuery, jQuery-UI, Moment + moment-timezone + moment-timezone-**with-data**, DataTables, Bootstrap, Flatpickr, Tempus-Dominus, daterangepicker, jquery-confirm, jquery-validate, inputmask, Firebase, spin.js, hotkeys, floating-ui, popper, bootstrap-multiselect, iconify, Font-Awesome-Pro …), most from third-party CDNs — no bundling, tree-shaking, or code-splitting.
- **Synchronous XHR on the failure path.** `request.js` `onerror` fires `$.ajax({ async: false, url: api + "/get/app/version" })` — a **main-thread-freezing** call to disambiguate CORS/offline, and both the 503 branch and that network branch hard-`location.reload()` the whole app.
- **The transport navigates the entire app on auth failure.** A `401` in `request.js` does `window.location.href = appUrl + "/logout"` — no token refresh, no queued replay; a single background 401 tears the session down (the exact behavior that broke React live-verification and had to be worked around). Every response is hand-`JSON.parse`d; there is no retry/backoff/interceptor layer.
- **Chatty, server-round-trip concurrency.** Every form open/close/idle hits `lock` / `un-lock` / `resume` / `heartbeat` (`active.session.handle.js`), coordinated through `sessionStorage` counters (`lockEditSessionCount`, `uiSessionId`) and a `beforeunload` keepalive unlock.

## 3. Tight coupling

- **Nothing runs without the layout-scriptlet globals.** `request.js` needs `api`/`appUrl`; `active.session.handle.js` needs `productUrl`/`url`/`api`; modules everywhere read `env`, `signalUrl`, and role constants. No module is unit-testable or runnable outside the JSP-rendered page.
- **Transport ↔ UI ↔ auth are welded together.** `request.js` calls `utility.failureMessage(...)` **from inside the HTTP layer** and `utility.parseJwt().userId` / `utility.getCookieValue('X-Auth-Token')` on every request; each of `api.utility.js`'s 368 methods calls `request.*` **and** `utility.failureMessage(...)`. The API layer cannot exist without both the transport singleton and the toast/JWT utility singleton.
- **The session-lock service is hardwired to every clinical section.** `active.session.handle.js`'s `refreshCustomElementBasedOnConcurrentCode()` is a single **`switch` of ~40 `resourceNavigationCode` cases** (`PATGOAL`, `CAREPREF`, `IMDD`, `PROBLEM`, `IMMUNIZATION`, `SURGHIS`, …) that reaches into DOM custom elements by attribute selector (`$('patient-goals-list[patient-id="…"][goal-type="…"]')`) and fires string-named jQuery events (`.trigger("sectionList:refreshSectionList")`). The central concurrency service has **hardcoded knowledge of every section's tag name, attributes, and event names** — converting or adding a section means editing this switch — and it further branches on `productUrl.replace(url+'/','').toUpperCase()==="EHR"`.
- **DOM-as-state + jQuery/web-component hybrid.** State is stashed on elements via `$(el).data(...)`; sections are custom elements (`patient-*-list`) driven by jQuery and cross-triggered by string event names — no store, no typed contract between producer and consumer.
- **CSS coupled to component tag names.** `ehr-theme-style.css` / `patient-chart-style.css` target custom-element selectors directly (`patient-allergies .pa-…`, `patient-problems .pp-…`, `patient-procedure-record-information …`), lean on pervasive `!important`, and mix 51 global `--app-color*` tokens with scattered hard-coded hex — so restyling one section can bleed into others.

**The approach that removes each of these problems is the next section.**

---

# Migration Approach — Addressing the Legacy Architecture Issues **[v4 — NEW]**

> Companion to the Problem Statement above: each legacy problem class → the concrete React strategy used in hum-ehr. This is the *narrative*; the enforceable per-concern rules live in the Rules sections below (Service Layer & Axios, React, Component, Icon, Legacy-JS, CSRF/Auth-Handoff/Coexistence, Sequencing & Rollback).

## 0. Overall shape — incremental strangler-fig, backend untouched

- JSP and React **coexist behind the same origin** (base path `/emr/`); Nginx routes converted screens to the React SPA and everything else stays on JSP. No big-bang rewrite; ship screen by screen.
- **Backend APIs are frozen** — every URL, request/response body, field, and param is preserved verbatim (see Important Rule). React adapts to the backend, never the reverse.
- **Convert → verify in the running app → move on.** Automated tests are parked (see Testing — Parked); each screen is verified by driving the real app before it is called done.

## 1. Scriptlet dependencies → static SPA + runtime bootstrap

- The server-injected `<%= %>` globals (`api`, `env`, `signalUrl`, `appVersion`, care-group IDs, `FORM_TIME_OUT_*`, role/EL constants) become build-time **`import.meta.env` (`VITE_*`)** plus a small runtime config/bootstrap, so the SPA ships as **static assets** — config changes no longer need a JSP redeploy.
- `${token}` / `<meta X-Auth-Token>` → the **cookie stays the source of truth**, read **only** inside the Axios interceptor (js-cookie) and mirrored into Redux `authSlice` (decoded JWT). Role gating that was `<% if (role…) %>` scriptlets becomes **client-side checks** off the decoded JWT / auth state.
- `<jsp:include page="${content}">` server-side composition → **React Router 7** routes + React layout components.

## 2. Bottlenecks → layered service architecture + real bundling

- The **5,707-line `utility.js` + 4,498-line `api.utility.js` god-objects** are decomposed into **per-domain service modules** (`allergyService`, `goalService`, `immunizationService`, `preferencesService`, …) behind **one `apiClient`** (single Axios instance). Strict path: **page → service → apiClient → Axios**; a page never calls Axios directly. The single `API_END_POINT_URL` map becomes `constants/endpoints.js`.
- `request.js` transport pathologies are replaced by **Axios interceptors**: request interceptor injects `X-Auth-Token`; response interceptor unwraps `response.data`; a **single 401 handler** (refresh/replay — not a full-page `window.location='/logout'` nuke). No synchronous XHR, no transport-level `location.reload()`, and **no `utility.failureMessage` welded into the transport** — notifications move to a `NotificationContext` used only inside handlers.
- ~40 render-blocking CDN `<script>`/`<link>` tags → **Vite bundling + tree-shaking + route-based code-splitting** (`React.lazy` / `Suspense`). Icon fonts → exact-vector `LegacyIcon`; Moment → **dayjs**; jQuery plugins → their React equivalents (see Target Stack).

## 3. Tight coupling → owned state + shared components, no cross-section event bus

- **No module depends on page-scoped globals** — config/auth/notify arrive via `import.meta.env` / Redux / Context / hooks. Each section is a self-contained React component tree owning its **own** state (Redux for **auth only**, Context for layout/notification/session, local hooks + in-memory `patientCache` otherwise) — no `$(el).data()` DOM-as-state.
- The `active.session.handle.js` **~40-case refresh `switch`** (custom-element selectors + string jQuery events) is **not replicated** — its concurrency *mechanics* are, but the change-amplifying section-refresh dispatch is replaced by a tiny keyed pub/sub (`utils/sectionRefreshBus.js`, keyed `${resourceNavigationCode}:${patientId}`), so adding a section no longer means editing a global switch.
- **Section-lock concurrency + change-log — ported as reusable React infrastructure** (first consumer: Problems). The legacy singletons become services + a hook, page → service → apiClient like everything else:
  - `services/sessionLockService.js` — `lock` / `un-lock` / `resume` / `heartbeat` (`/navigation-resource/*`), `uiSessionId` + `lockEditSessionCount` in sessionStorage, a `beforeunload` keepalive unlock, and a warning subscription (server `status:"warning"` ⇒ notify).
  - `hooks/useSectionLock.js` — owns the **whole** lock lifecycle for a mounted edit form (acquire on mount → heartbeat every `FORM_ACTIVE_HEART_BEAT_DURATION` while active+visible → idle after `FORM_TIME_OUT_DURATION`s → resume on activity → release on unmount unless saved). Acquire+release are symmetric in one effect so it stays correct under **StrictMode** (a list-locks/form-unlocks split releases the lock on the StrictMode unmount and never re-acquires — avoided).
  - `utils/activityTracker.js` — the `layouts.common.js` idle/activity stamping (mouse/key/click/visibility) + resume subscribers.
  - `services/changeLogService.js` — the `patient.change.log.js` per-section audit accumulation (`logId` grouping + running `careplanLogMessage`), **with a `DIAGNOSIS` case added** (legacy had none) and call sites fixed to the intended argument order.
  - `components/common/SessionLockWarningModal.jsx` — the `active_session_warning_message_modal`, mounted once at app root; **Refresh** publishes to the section-refresh bus.
  - Wiring: save payloads carry `logId` / `careplanLogMessage` / `careplanLogMessageUserInput` / `sessionId` verbatim; the save's `sessionId` releases the lock server-side (form-saved ⇒ no explicit unlock). Verified live against staging: lock→heartbeat(5s)→resume→un-lock cycle and the change-log save payload.
- Cross-cutting UI the legacy duplicated through `utility` HTML-builders (`constructEditDeleteIcons`, `renderDiagnosisListView`, `constructDeletedRecordsBadge…`) becomes **shared React components** — `RecordActionIcons`, `DiagnosisListView`, `DeletedRecordBadge`, `DetailField`, `FormStatusFooter` — that every section consumes, so **one change propagates to all sections** (the legacy's shared-helper intent, minus the global coupling).
- CSS coupled to component tag selectors + pervasive `!important` → **scoped component CSS** with the `--app-color*` tokens carried into `App.css`; restyling one section no longer bleeds into others.

**Guardrail:** this is a **framework conversion, not a redesign** — the approach removes architectural coupling, never user-facing **business** behavior (see Important Rule + Preservation Rules). When a legacy behavior's intent is unclear, **preserve it and leave a `TODO`** rather than dropping it.

---

# Target Technology Stack — as actually adopted in hum-ehr

> This table reflects the current `package.json`. Where v3 was wrong, the row is marked **[v4]**.

## Core Framework
* React 19 · Vite 8 (Rolldown) · JavaScript · JSX · React Router 7 (`react-router-dom`) · Axios 1
* **[v4] Base path `/emr/`** — set in `vite.config.js` (`base`) and `BrowserRouter basename`.

## State Management
* Redux Toolkit 2 + react-redux 9 — **auth state only** (cookie `X-Auth-Token` is source of truth; Redux mirrors it)
* React Context API — `LayoutContext` (body/side-nav CSS), `NotificationContext` (Toast)
* useState / useEffect / useMemo / useCallback — local state

## Forms & Validation
* react-hook-form 7 · zod 4 · @hookform/resolvers — zod mirrors **every** legacy rule

## UI Component Libraries **[v4]**
* Bootstrap 5 (grid authoritative — loaded last)
* PrimeReact 10 + primeicons + primeflex — Dialog, **DataTable** (the table standard), overlays
* **Removed:** react-bootstrap, @mui/x-data-grid, @emotion/*, @tanstack/react-table. Do not reintroduce.

## Dropdowns & Lookup
* react-select 5 — styled dropdowns + async typeahead (`react-select/async`); `classNamePrefix="react-select"`

## Confirmation Dialogs
* SweetAlert2 11 — via a `Swal.mixin()` `swalTheme`; never raw `Swal.fire()`

## Date & Time **[v4]**
* **dayjs** — the adopted date library (central `src/utils/dayjs.js` with utc/timezone/customParseFormat/advancedFormat/isSameOrBefore/isSameOrAfter). **Moment.js was removed.** For minimal diffs, files `import moment from '../utils/dayjs'` — it is dayjs underneath. **Do not reintroduce Moment or migrate off dayjs.**
* Flatpickr 4 + react-flatpickr — primary date/time picker (`FlatpickrDateTimeInput` wrapper)
* **Removed:** @eonasdan/tempus-dominus, bootstrap-daterangepicker.

## Icons **[v4] — completely changed since v3**
* **No icon fonts ship.** Every legacy FA/MDI glyph renders from its **exact original vector path**:
  * `@mdi/js` — Material Design path constants
  * `@fortawesome/free-solid-svg-icons` + `@fortawesome/free-regular-svg-icons` — FontAwesome path data
  * (path data only, tree-shaken — no webfont/kit)
* `src/components/common/iconPaths.js` maps original class (`mdi-*`/`fa-*`) → exact path; exposes `resolveIcon()` + `legacyIconHtml()`.
* `src/components/common/CustomIcons.jsx` — `<LegacyIcon icon="mdi-…|fa-…"/>` + named aliases.
* PrimeIcons (`pi`) is used **only** for PrimeReact-internal glyphs, never in app markup.
* **Removed:** Font Awesome Pro webfont/kit, `@material-design-icons/font`, `material-design-icons-iconfont`, `@mui/icons-material`, `@fortawesome/react-fontawesome`, `@fortawesome/fontawesome-svg-core`.

## Rich Content
* chart.js 4 · Quill 2 — installed, **not yet wired** into a migrated screen; use when one needs them.

## Auth & Cookies
* js-cookie 3 — read/write `X-Auth-Token`

## Server State **[v4]**
* @tanstack/react-query 5 + @tanstack/react-virtual 3 — **Message Center only** (recent-users + conversation infinite scroll; long-list virtualization). Every other list uses **manual fetch + debounce + `patientCache`**. `src/services/queryClient.js` is in-memory (no PHI persister).

## Observability **[v4]**
* Bugsnag (`@bugsnag/js` + `@bugsnag/plugin-react`) — **production-only**, PHI-scrubbed (`src/services/errorMonitoring.js`). (Replaces the v2 "Sentry or equivalent" note.)

## Type Safety **[v4]**
* JSDoc + `jsconfig.json` (`checkJs` off, editor-only). No PropTypes, no TypeScript.

---

# Important Rule

DO NOT USE TYPESCRIPT. Generate only `.js` / `.jsx`. Never `.ts` / `.tsx` unless explicitly requested.

# Migration Philosophy

NOT a redesign. NOT a modernization. NOT a UI improvement. **ONLY a framework conversion.** Everything behaves exactly like the original JSP.

---

# UI / CSS / Business-Logic / JavaScript Preservation Rules

(Unchanged from v3 — still in force.)

* **UI:** preserve HTML structure, Bootstrap classes, custom classes, IDs, `data-*`, `aria-*`, `role`, `tabindex`, inline styles, layout. Only `class` → `className`. Never simplify/merge/rename/remove.
* **CSS:** never remove custom/utility/Bootstrap classes (even if unused); preserve state classes (`active`/`show`/`collapse`/`disabled`/`hidden`/`selected`).
* **Business logic:** never remove `if`/`switch`/loops/validation/permission checks/feature flags/hidden conditions, even if duplicated.
* **JavaScript:** convert every behavior — click/keyboard/custom events, AJAX, validation, lookup, popup/modal, focus, storage.
  * **[ADDED] PHI storage:** flag any PHI in `localStorage` (HIPAA risk) — prefer `sessionStorage`/in-memory (`patientCache`); add a TODO, don't silently change.
  * **[ADDED] Auto-logout / idle timeout** and **front-end audit events** — treat as "never remove."

# React Rules

* Use hooks + Context. **[v4]** Redux is adopted **for auth only** (via `src/store/`); do not use Redux for feature/screen state.
* Avoid `getElementById`/`querySelector`/jQuery selectors unless wrapping unavoidable legacy plugins (layout DOM writes belong in `LayoutContext`).
* **[ADDED] Error Boundaries:** `ErrorBoundary.jsx` wraps the app/routes; caught errors route to Bugsnag.

# Component Rules **[v4] — reconciled with what exists**

Create reusable components; don't duplicate UI. The **actual** shared set in `src/components/common/`:
`UniversalFileUploader.jsx`, `DiagnosisPicker.jsx`, `ContentLoader.jsx` (`SkeletonTable`/`SkeletonList`/`SkeletonViewDetails`), `FlatpickrDateTimeInput.jsx`, `NoDataAvailable.jsx`, `CustomIcons.jsx` + `iconPaths.js`, plus top-level `ErrorBoundary.jsx`.
(The v2/v3 `CommonInput/Modal/Button/...` names were aspirational — build a shared component when a real second use appears; don't scaffold empty ones.) Document props with JSDoc.

---

# Form Validation Rules  ·  Confirmation Dialog Rules  ·  Lookup Dropdown Rules  ·  PrimeReact Rules  ·  Redux Toolkit Rules

(Unchanged from v3 and still accurate — see below; only the surrounding stack changed.)

* **Forms:** react-hook-form + zod (`.superRefine()` for cross-field), `Controller` for controlled inputs, `mode:'onSubmit'` + `reValidateMode:'onChange'`, `FieldError` component, disable submit while `saving`.
* **Confirms:** one `swalTheme` mixin per module (or shared util); `buttonsStyling:false`; `allowOutsideClick:false`; construct change-log messages programmatically (`An existing {section} "${name}" has been deleted/recovered`); `.pa-swal-*` overrides in module CSS.
* **Lookups:** react-select / `AsyncSelect`; always `classNamePrefix="react-select"`; error styling via `styles.control`; `LOOKUP_MIN_CHARS` in `src/constants/timing.js`; store both label + id for "allow-only-lookup-data" validation.
* **PrimeReact:** selective use; theme internals via the `pt` PassThrough API + module CSS, not global overrides.
* **Redux:** typed `useAppDispatch`/`useAppSelector` from `src/store/hooks.js`; cookie is source of truth; shape `{ user, token }`; logout resets slice + clears cookie + invalidates server session; no PHI in Redux.

---

# Service Layer & Axios Rules

* **Never call Axios from a page.** `Page → service → apiClient helpers → single Axios instance`.
* `src/services/`: `apiClient.js`, `endpoints.js` (**all** endpoint strings), `authService.js`, `<domain>Service.js`, `errorMonitoring.js`, `queryClient.js`. Use named helpers (`apiGet/apiPost/apiPut/apiDelete/apiPostForm/apiPostMultipart`).
* **Axios instance:** base URL, timeout, `X-Auth-Token` inject, **`withCredentials:true`**, **[ADDED] CSRF header**, 401→`/logout`, 403 handling, request/response interceptors.
* **[ADDED] Concurrent-401:** queue in-flight requests, refresh once, replay. **[ADDED] Cancellation:** thread `AbortController` `signal` (helpers already forward axios cfg).

# Cookie Rules
* js-cookie only (never `document.cookie`); read `X-Auth-Token` in the request interceptor; `secure` + `sameSite`; no PHI in cookies.

---

# DataTable / List Rules **[v4] — rewritten**

* **PrimeReact `DataTable` is the table standard** (patient list uses it: `lazy`, `paginator`, sort, filter, `scrollable`).
* **Responsive:** desktop `DataTable`; below `lg` render a **card layout** — switch via `useIsTabletOrBelow()`. Scroll containers use `overflow-x: hidden` (no horizontal page overflow).
* **Long lists:** virtualize with **@tanstack/react-virtual** (used in Message Center). 
* **Loading:** show `ContentLoader` skeletons (`SkeletonTable`/`SkeletonList`) while `records === null`.
* jQuery DataTables and @tanstack/react-table are **gone** — do not wrap or reintroduce them.

# Chart / Rich Text Rules
* chart.js 4 / Quill 2 — init in `useEffect` via ref, **destroy in cleanup**; preserve legacy toolbar/config/data mappings; sanitize Quill HTML. (Both retained but not yet used — wire when a screen needs them.)

# Icon Rules **[v4] — rewritten (supersedes v3 "Icon Library" + "Font Awesome" sections)**

* Render every icon via **`<LegacyIcon icon="<original mdi-/fa- class>" />`** — it draws the exact original vector.
* To add an icon not yet mapped: add its `@mdi/js` constant or `@fortawesome/free-*` def to `iconPaths.js` (named imports only, to keep tree-shaking).
* HTML-string contexts (DataTable body strings, `dangerouslySetInnerHTML`) → `legacyIconHtml('mdi-…','extra')`.
* Icon + child (badge): wrap in a `<span>` with layout classes; `<LegacyIcon/>` + child inside.
* FA **Pro-only** glyphs (this app uses a free FA kit) aren't in the free set → nearest free glyph or a hand-drawn SVG fallback (see `FolderUploadGlyph`).
* **Never** put raw `pi pi-*`, `fa-*`, or `mdi mdi-*` glyph classes in app markup; `pi` is for PrimeReact internals only.

# Flatpickr Rules
* Keep Flatpickr; don't replace. Reusable `FlatpickrDateTimeInput`. Init in `useEffect`, destroy in cleanup.
* **[v4] dates use dayjs** (see Date & Time) — not Moment. Preserve all formatting patterns exactly.

---

# [ADDED] CSRF · Authentication Handoff · Coexistence (Strangler-Fig)

* **CSRF:** send a CSRF token on every state-changing request; centralize in the Axios interceptor (recommended: cookie-to-header `XSRF-TOKEN`→`X-XSRF-TOKEN`). Confirm exact names with backend.
* **Auth handoff:** define where `X-Auth-Token` comes from on first load (cookie via js-cookie is the default); `withCredentials:true` mandatory; JSP + React **must be same-origin** for shared session/cookies; preserve idle auto-logout; centralize `authService.logout()`.
* **Coexistence [RESOLVED default]:** Nginx reverse proxy, same origin, per-route cutover (JSP↔React boundary = full reload; migrate related screens in clusters). Alternative: Tomcat-served React build.
* **[v4] Dev auto-login** (`.env` `VITE_DEV_USERNAME`/`VITE_DEV_PASSWORD`) is gated to `import.meta.env.DEV` — never runs in production builds.

---

# API / Form / State / Performance / Legacy-JS Rules

* **API:** backend fixed — never change URL/body/field/param names.
* **Form:** preserve validation/maxlength/required/readonly/disabled/hidden/duplicate/lookup/business validation.
* **State:** server state (API data) vs client state (UI/drafts). **[v4]** Server-state tooling (TanStack Query) is scoped to Message Center; elsewhere use manual fetch + debounce + `patientCache` (+ AbortController when added).
* **Performance (only after parity):** dedupe imports/API-calls/useEffect, remove dead code, **`React.lazy` + `Suspense` route/section code-splitting** + Vite `manualChunks` (both done). Never remove working business logic.
* **Legacy JS utilities** (`commonUtilityObject`/`lookupUtility`/`notificationUtility`/…) → reusable service methods. Keep `src/js/patient-ehr/api.utility.js` + `src/js/app/utility.js` as **reference only** (do not edit/delete). Change-log messages built programmatically.

---

# [v4] Bootstrap 5 Integration — [RESOLVED]

react-bootstrap was **removed**. Interactive Bootstrap components use **native Bootstrap 5 JS** via `data-bs-*` attributes (dropdowns, tooltips, offcanvas) or refs + cleanup where needed. Do not reintroduce react-bootstrap.

# [ADDED] Vite Build & Deploy
* Dev proxy / `base: '/emr/'` / `.env` + `import.meta.env` (never hardcode). `manualChunks` splits vendors. `@vitejs/plugin-legacy` only if the browser matrix requires it.

# [v4] Testing & Verification — [PARKED]
* **No test runner is configured yet** (Vitest + RTL + Playwright + visual regression is **P7, parked** pending team go-ahead).
* Until then, verification is **manual: drive the running app** (open the screen, exercise the flow, watch console/network), plus `npm run lint` + `npm run build`. When automated testing lands, cover the "never remove" branches (validation, permissions, feature flags) first and add JSP-vs-React visual diffs.

# [ADDED] Migration Sequencing & Rollback
* Low-risk leaf pages first; migrate clusters together; per-screen feature flag + proxy rule = instant, redeploy-free rollback; canary where feasible.

---

# Folder Structure **[v4] — as it actually exists**

```
src/
  components/            Header, Sidebar, QuickAccessNav, AdminMenu, ErrorBoundary, EhrSystemNotificationsBanner, DocumentPreviewModal
  components/common/     UniversalFileUploader, DiagnosisPicker, ContentLoader, FlatpickrDateTimeInput,
                         NoDataAvailable, CustomIcons.jsx, iconPaths.js
  js/                    feature modules: patientlist/, message-center/, patient-ehr/<section>/
                         (allergies, problems, profile, goals, health-insurance, preferences,
                          family-history, immunization, implantable-device, documents,
                          hospitalization, procedure, surgical-history)
  js/patient-ehr/        api.utility.js, app/utility.js  ← REFERENCE ONLY (do not edit/delete)
  services/              apiClient, endpoints, authService, <domain>Service, errorMonitoring, queryClient
  store/                 authSlice, hooks, index   (Redux Toolkit — auth only)
  context/               LayoutContext, NotificationContext
  hooks/                 useMediaQuery (useIsTabletOrBelow), useSystemClock
  utils/                 patientCache (in-memory PHI cache), dayjs (central config), commonUtility
  constants/             timing.js (debounce/lookup)
  config/  types/  assets/
```

---

# Conversion Rules · Existing-Functionality Rules · Output Requirements

* **Per screen:** `JSP → React JSX → Reusable Components → Reusable Services → Optimization`. Never optimize before parity.
* Never remove hidden/inactive features, commented business logic, or config-driven logic — when uncertain, preserve + `TODO`.
* **Every conversion delivers:** 1) Files Modified 2) Files Added 3) Functionality Preserved 4) Shared Components Created 5) Shared Services Created 6) Optimization Performed 7) Remaining TODO 8) Complete Source Code.

---

# Mandatory Verification Checklist **[v4]**

```
✓ UI matches original JSP; HTML/CSS classes/IDs/Bootstrap preserved
✓ aria / role / data-* / tabindex / inline styles preserved
✓ business logic preserved (no removed if/switch/loop/permission/feature-flag)
✓ validation mirrors EVERY legacy rule (react-hook-form + zod)
✓ APIs unchanged (URL, body, field names, params); withCredentials on
✓ X-Auth-Token via js-cookie in the Axios interceptor only; 401→logout; CSRF on state-changing requests
✓ concurrent-401 handled (single refresh, queued replay)  [when auth wiring lands]
✓ plugin lifecycle: Flatpickr / chart.js / Quill init in effect + destroyed in cleanup
✓ no PHI in localStorage (patientCache / sessionStorage only); audit + idle-logout preserved
✓ icons via LegacyIcon (exact original vector) — no raw pi/fa/mdi glyph classes in app markup
✓ dates via src/utils/dayjs (NOT moment)
✓ tables = PrimeReact DataTable; desktop table ↔ mobile cards; long lists virtualized; skeleton loaders
✓ SweetAlert2 uses swalTheme; react-select uses classNamePrefix; notify() only inside handlers
✓ no horizontal overflow on content areas
✓ no duplicate API calls / useEffect; no unused imports; no dead code; no React warnings / infinite loops
✓ npm run lint clean; npm run build succeeds; verified by driving the running app (automated tests = P7, parked)
✓ no functionality removed
```

---

# Migration Principles

1. Functionality > optimization. 2. Preserve business logic before refactor. 3. Never remove unless confirmed unused. 4. Preserve workflows exactly. 5. Uncertain → preserve + TODO. 6. Shared code reduces duplication without changing behavior. 7. Compare each screen to the JSP before "done." 8. Users notice no difference. 9. Incremental, production-safe, maintainable. 10. Quality never costs functionality.

---

# Migration Status **[v4 — NEW]**

### Done (converted to React + verified in the running app)
App shell (routing, QuickAccessNav tabs, Header, Sidebar, AdminMenu, dev auto-login, responsive, ErrorBoundary, notification toasts) · **Patient List** · **Patient Chart sections:** Allergies, Problems, Patient Profile (demographics/contact/care-team/care-givers/deactivation/mobile-access), Goals, Health Insurance, Preferences, Family Health History, Immunization, Implantable Devices, Documents, Hospitalization, Procedure, Surgical History · **Message Center → Chat** (conversation, recent-users, media upload, audio recording, new-chat search) · Cross-cutting: icons (exact-vector `LegacyIcon`), dayjs, code-splitting, skeleton loaders, Bugsnag.

### Remaining / to convert
Message Center **In-App Mail** + header **click-to-call** dropdown · Message Center **Direct Address** — converted (mailbox picker, Inbound/Outbound/Draft/Archived list, conversation reader, composer with patient linking and CDA attachments); the staging test account has no direct address configured, so the surface still needs an end-to-end pass on an account that does, plus the **Add External Provider/Organization** dialogs, which belong to Referrals · **Create New Patient** workflow · patient-chart placeholder sections to confirm-vs-JSP & convert (Summary dashboard, Appointments, Encounters, Vitals, Clinical Test, Imaging Orders, Visits, Health Status Assessment, Nutrition) · **Referrals** (was under legacy development — confirm) · top-level nav routes (Dashboard, Appointment, Orders, Reports, Billing, Administration, Help).

For each: follow the per-screen workflow, reuse the shared components/services, pass the verification checklist.

---

# Open Decisions **[v4 — statuses updated]**

| # | Decision | Status in hum-ehr |
|---|----------|-------------------|
| 1 | Server-state library | **[RESOLVED]** TanStack Query + Virtual — **Message Center only**; manual fetch + patientCache elsewhere |
| 2 | Coexistence routing host | Nginx reverse proxy, same origin (default; not yet cut over) |
| 3 | Bootstrap JS in React | **[RESOLVED]** native Bootstrap JS (data-bs-*/refs); react-bootstrap removed |
| 4 | CSRF mechanism | Cookie-to-header (`XSRF-TOKEN`→`X-XSRF-TOKEN`) — confirm names with backend |
| 5 | `X-Auth-Token` source on first load | Cookie (js-cookie) |
| 6 | Legacy browser support | Evergreen-only unless matrix requires `@vitejs/plugin-legacy` |
| 7 | Date library | **[RESOLVED] dayjs adopted** (Moment removed) — reverses the v3 decision |
| 8 | Icon system | **[RESOLVED]** exact-vector `LegacyIcon` (@mdi/js + FA-free path data); no icon fonts |
| 9 | Automated testing (P7) | **[PARKED]** — manual "drive the app" verification until greenlit |
| 10 | Bootstrap → Tailwind (P10b) | **[PARKED]** — team reviewing |
