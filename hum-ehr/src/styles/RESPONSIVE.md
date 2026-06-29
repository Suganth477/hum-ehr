# Responsive design conventions

This app is **mobile-first responsive down to ~360px phones**. Use this as the
standard when building or migrating any screen.

## Breakpoints (Bootstrap 5 — do not invent new ones)

| Token | Min width | Typical device |
| --- | --- | --- |
| (base) | 0 | phones (design here first) |
| `sm` | 576px | large phones |
| `md` | 768px | tablets |
| `lg` | 992px | small laptops / desktop |
| `xl` | 1200px | desktop |
| `xxl` | 1400px | large desktop |

JS and CSS must agree on these. In CSS use Bootstrap utilities/grid or
`@media`; in JS use the hooks in `src/hooks/useMediaQuery.js`
(`useIsMobile` = `< md`, `useIsTabletOrBelow` = `< lg`).

## Where responsive code lives

- **Shell / global layout** → `src/styles/responsive.css` (all breakpoint rules
  for the header, side-nav drawer, tab bar, offcanvas live here — keep them in
  one place).
- **Per-screen** → prefer Bootstrap grid classes (`col-12 col-md-6 col-lg-4`)
  and utilities (`d-none d-md-block`, `flex-column flex-md-row`, `gap-*`) right
  in the JSX. Only reach for `useMediaQuery` when the **markup itself** must
  differ (e.g. table vs. cards).

## Core patterns (with references)

1. **No fixed pixel widths for layout.** Use the grid / `%` / `vw` / `flex`.
   Fixed px is fine only for things that shouldn't scale (icons, borders).
2. **Dense tables → cards on phones.** Render a card list under `useIsMobile()`,
   the table otherwise. Reference: `ActivePatientsList.jsx` (PrimeReact
   `DataTable` + `Paginator`) and `PatientAllergiesList.jsx` (custom table).
3. **Modals.** PrimeReact `Dialog` must set
   `breakpoints={{ '768px': '95vw' }}` alongside its desktop `style.width`.
   Reference: the reaction dialog in `PatientAllergiesAddEdit.jsx`.
4. **Off-canvas panels** (PrimeReact `Sidebar`, Bootstrap `.offcanvas-end`) get
   a usable width on phones via the `.offcanvas-end` rule in `responsive.css`.
5. **Side navigation** becomes a slide-in drawer below `lg`, driven by
   `LayoutProvider` (`mobileNavOpen` / `toggleMobileNav` / `closeMobileNav`).
   The Header hamburger calls `toggleMobileNav` on mobile and `toggleSideMenu`
   on desktop; `Sidebar` renders the drawer + backdrop.
6. **Touch targets**: keep tappable controls ≥ ~40px on phones; prefer
   icon-buttons with padding over tiny inline icons.

## Gotcha — legacy stylesheet cascade

`index.html` loads legacy stylesheets (`patient-chart-style.css`,
`ion.rangeSlider.css`) that can out-rank app rules in ways the inspector
doesn't always surface. The mobile drawer needed a `body.mobile-nav-open …
!important` rule to win. If a responsive override "doesn't apply" despite
correct specificity, scope it under a `body.<state>` class and/or add
`!important` rather than chasing the phantom rule.

## Recurring fixes (the ones that actually bit us)

1. **Flexbox `min-width: 0` — the #1 page-overflow cause.** Flex items default to
   `min-width: auto` and refuse to shrink below their content, so a wide child
   (a dense table, an icon cluster) widens the whole page instead of scrolling.
   Add `min-width: 0` to the flex item (e.g. `#application_body_container > *`).
   This fixed both the quick-access tab row and the patient DataTable.
2. **Dense tables → cards at `< lg` (992px)**, not just phones — fixed-width
   columns overflow tablets too. Drive with `useIsTabletOrBelow()`. For the
   desktop table, wrap it in a `max-width:100%; overflow-x:auto` container so it
   scrolls in-place instead of widening the page (see `.active-patient-table-scroll`).
3. **Legacy fixed widths / margin hacks** (e.g. the patient-search box's
   `width: 940px; margin-left: 470px`) overflow narrow screens. Override them —
   usually globally and with `!important` to beat the legacy stylesheet — to a
   fluid width + zero stray margin.
4. **Off-canvas / drawer transforms** pinned by the legacy stylesheet: scope the
   override with an **id + `!important`** (and an explicit `translateX(0px)`, not
   `none`). NOTE: the in-app preview misrenders `transform` on these
   legacy-interop elements — **verify drawers/offcanvas in a real browser.**
5. **PrimeFlex vs Bootstrap grid collision — keep `import 'primeflex/primeflex.css'`
   BEFORE Bootstrap in `App.jsx`.** Both libs define non-responsive `.col-1..12`;
   we use Bootstrap's grid (`.row` + responsive `.col-{bp}-*`). When PrimeFlex
   loaded last, its plain `.col-12` (no media query, equal specificity) won the
   cascade over `.col-md-3`, so a `col-12 col-sm-6 col-md-3` form row silently
   collapsed to one stacked column on desktop. Symptom: classes look right in the
   inspector but `col-md-*` never takes effect ≥768px. Fix = Bootstrap loads last
   so its grid is authoritative. (Allergy's `col-md-4` was unaffected because it
   has no plain `col-12`.)

## Checklist for a new / migrated screen

- [ ] Test at 360px, 768px, 1280px.
- [ ] No horizontal page scroll at 360px (only intentional inner scroll).
- [ ] Dense tables render as cards on phones.
- [ ] Forms use `col-12 col-md-*` so fields stack on phones.
- [ ] Modals/offcanvas use the breakpoint props/rules above.
- [ ] Tap targets are comfortable; nothing is clipped by the drawer/header.
