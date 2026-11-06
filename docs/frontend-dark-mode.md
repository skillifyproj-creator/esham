# Esham platform theme refinement

Completed November 6, 2026. Continued from the existing working tree after the usage interruption; no earlier implementation was discarded or restarted.

## Previously completed before resuming

- Audited the existing palette, theme mechanism and shared layouts.
- Added a semantic non-chatbot theme layer and color-only overrides for existing pages. Main dark background is `--primary-00` (#2C151A), cards/sidebar use `--primary-300`, raised/interactive surfaces use `--primary-200`; cream text uses the existing white tokens.
- Retained green/purple accents with their original secondary/tertiary palette tokens. Error and warning roles use the existing template error/warning tokens.
- Added automatic logo switching in public navigation, authentication/onboarding, shared Learner/Instructor navigation, Admin desktop/mobile navigation and certificate screen previews.
- Completed the broad read-only visual matrix and most dialog/preference checks. Initial contrast findings were fixed; one repeated Light Mode ratings-distribution issue remained at the interruption.

## Newly completed after resuming

- Re-inspected all modified/untracked paths and existing verification artifacts before editing.
- Fixed remaining Light Mode distribution stars with `--primary-200`.
- Improved actual chart-series contrast using original burgundy/green colors against a deeper burgundy chart surface; chart data, geometry and API calls are unchanged.
- Explicitly excluded the floating assistant shortcut from generated colors and new focus styles. Verified its original white icon, green background/hover and 3px green keyboard outline in both themes.
- Completed contrast rechecks, dialog/error/preference checks, chatbot appearance/behavior checks, final frontend tests and production build.

## Palette and implementation

`frontend/src/styles/global.css` remains the source of the original palette and was not edited by this task. Existing legacy chatbot/global styles were retained so the assistant does not acquire the platform's new theme.

`platform-theme.css` owns non-chatbot semantic roles. `theme-surfaces.css` supplies color-only corrections for existing component selectors, including conflicting hardcoded light/dark surfaces. It contains no layout, typography sizing, direction, navigation, upload or business-record changes. It is reproducibly generated from existing CSS with:

```powershell
cd frontend
node scripts/build-theme-surfaces.cjs
```

The generator preserves media conditions, ignores chatbot/video stylesheet internals, SVG fills/strokes, image URLs, keyframes and print rules, and maps color declarations to existing tokens. No new dependency was installed. Source page styles remain intact for Light Mode; narrow Light Mode fixes address contrast in muted text, rating stars, badges and form/control borders.

The route shell activates the layer only for non-assistant pages. Every new theme rule also excludes documents containing `.esham-chatbot`. Generated targets exclude `.esham-assistant-launcher` and its descendants; generic keyboard focus rules explicitly exclude that shortcut.

No chatbot component, stylesheet, logo, service, AI integration or behavior was edited. New platform theme changes do not activate on assistant routes, including their loading state. Existing shared logo navigation on assistant routes retains its original image/treatment.

## Logo assets

- Light: `frontend/src/assets/esham-logo.png`
- Dark: `frontend/src/assets/logo2.png`

Both assets already existed locally. Neither was recolored, filtered, resized on disk or otherwise modified. The existing image elements retain their dimensions/object-fit behavior; ThemeLogo adds no layout wrapper. `logo2` renders with computed `filter: none`. Original logo remains used for certificate PDF generation and print output.

`logo2.png` is a **pre-existing untracked asset**. It must be included in a future reviewed feature commit for another checkout to build correctly. Nothing was staged, committed or pushed here.

## Verification results

| Check | Result |
|---|---|
| Existing page routes | 73 distinct URLs, 600 route/theme/language/viewport combinations |
| Themes / languages / sizes | Light + Dark, Arabic RTL + English LTR, desktop 1440px + mobile 390px |
| Page errors / horizontal overflow | 0 / 0 |
| Measured rendered text | 41,188 checks in the final route results; 0 remaining measured contrast failures after targeted rechecks |
| Dialogs / error states | 34 additional states; 0 measured contrast failures |
| Preferences | Actual theme toggle persists after reload; logo switches to the corresponding asset |
| Navigation | Desktop collapse/expand and mobile drawer/Escape checked |
| Keyboard focus | Visible palette-based rings on platform controls; original assistant shortcut focus retained |
| Frontend regression | 114 passed, 0 failed |
| Production build | Passed |
| Working-tree whitespace | `git diff --check` passed |

The 600 checks include 104 public/auth/help/error views, 88 GeneralAdmin views, 48 CategoryAdmin views, 192 Instructor views, 112 Learner views, 16 Hybrid views and 40 onboarding views. The final results contain no unexpected redirects. Existing isolated account sessions were used for real admin/instructor reads. Learner, Hybrid and complete-onboarding presentation used explicit browser-only session/category fixtures to avoid creating/updating accounts or relying on unfinished learner workflows. These fixtures do not establish backend authorization or learner business completion.

Dialog checks cover Add Administrator, category creation, announcement editing and account details in both themes/languages/sizes. Business submissions are blocked; only presentation interactions, filter reads, keyboard navigation and preference changes execute. Authentication error appearance uses a mocked 401, not a real invalid-password attempt.

Contrast calculations use AA thresholds of 4.5:1 for ordinary text and 3:1 for large text, plus 3:1 palette checks for controls/chart graphics. Examples: cream text against burgundy background/card/raised surface measures approximately 15.43:1 / 10.58:1 / 6.89:1. Green and burgundy chart fills against the main dark background measure approximately 5.07:1 and 4.19:1. Required fields/errors, control boundaries, muted text, rating stars, green badges and progress surfaces were corrected.

The automated text checker skips disabled controls, SVG/canvas artwork and text over image/gradient backgrounds. Representative rendered pages were also inspected visually. This is not an independent full WCAG certification, screen-reader audit or cross-browser certification. Actual recording, trimming, media export and AI request execution were not exercised or changed. Existing incomplete/demo learner business workflows remain outside this styling task.

### Chatbot exclusion evidence

- Eight pre-change computed-style snapshots (both themes, both languages, desktop/mobile) match after implementation.
- No difference in chatbot component/CSS/AI source files from this task.
- Local History/Sources/Chat tabs and text entry work in both languages/themes, without sending AI requests.
- Floating assistant shortcut default, hover and focus colors/geometry retain existing CSS values in Light and Dark Mode.
- Screenshot comparison was used for visual inspection, not claimed as byte-identical: initial textarea auto-focus scrolling and caret timing can differ between captures.

Browser artifacts remain local in `%TEMP%`: `esham-platform-theme-results.json`, `esham-theme-interactions.json`, `esham-theme-final-checks.json`, `esham-chat-theme-baseline.json` and `esham-theme-*.png`. These contain isolated test fixture labels and should not be staged as project artifacts.

## Changed files for this task

Application integration:
- `frontend/src/App.jsx` — presentation-only theme activation marker; earlier route changes preserved.
- `frontend/src/main.jsx` — import the semantic theme layer.
- `frontend/src/components/ThemeLogo.jsx` — original asset switch and assistant exclusion.
- `frontend/src/components/Header.jsx`
- `frontend/src/components/shared/WorkspaceNavigation.jsx`
- `frontend/src/components/admin/AdminWorkspace.jsx`
- `frontend/src/pages/auth/LoginPage.jsx`
- `frontend/src/pages/auth/SignupPage.jsx`
- `frontend/src/pages/auth/RecoveryLayout.jsx`
- `frontend/src/pages/auth/OnboardingPage.jsx`
- `frontend/src/pages/learner/LearnerCertificatesPage.jsx` — screen logo only; PDF generation keeps original asset.

Styles / tooling / tests:
- `frontend/src/styles/platform-theme.css`
- `frontend/src/styles/theme-surfaces.css`
- `frontend/scripts/build-theme-surfaces.cjs`
- `frontend/scripts/theme-browser-helpers.cjs`
- `frontend/scripts/verify-platform-theme.cjs`
- `frontend/scripts/verify-theme-interactions.cjs`
- `frontend/scripts/recheck-theme-contrast.cjs`
- `frontend/tests/theme.test.mjs`
- `frontend/package.json` — add theme regression to existing test command; preserve earlier additions.
- `docs/frontend-dark-mode.md`

No backend, database, migration, account, API, chatbot, AI service or video-functionality changes were made by this task. The working tree includes substantial changes from earlier tasks; those remain preserved and should be reviewed separately. The existing frontend/backend development servers were left running.

## Remaining limitations

- Existing third-party `use client` build warnings and occupied test HMR-port notices remain non-fatal; tests/build pass.
- Media/canvas artwork, actual recording/editing/export, external provider sign-in and live AI behavior were intentionally not invoked.
- Browser coverage is Chromium/Edge. Manual screen-reader and additional browser/device coverage remain advisable before release.
- Regenerate the color-only compatibility sheet when introducing new component styles. Keep assistant exclusions intact.
