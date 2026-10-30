# Auth layout update

Login, Signup, password recovery/reset and onboarding now share a tighter vertical rhythm.
The existing illustration, logo, theme colours, fonts, desktop columns and RTL reading order
are retained. Inputs/buttons retain at least 44px height, input text remains 16px, and focus
outlines and field error associations remain intact.

Changes:

- Centre short forms in the available viewport using flexible margins; let longer content
  grow naturally instead of clipping it or putting the form inside a nested scroll area.
- Reduce heading/subtitle, Google/separator, field, link and submit spacing. Apply additional
  compact spacing on shorter laptops, and keep account/home actions together in a wrapping
  form footer.
- Add an accessible compact AuthAlert with an icon, theme-aware error border/background and
  role=alert. Request errors render immediately above submit on Login/Signup/recovery/reset;
  Google sign-in/callback errors use the same alert. If an alert falls outside a short/mobile
  viewport, it brings itself into view without stealing keyboard focus.
- Keep individual field messages beside their controls. Suppress Signup's ready-status
  display while a request error is present; authentication state/requests remain unchanged.
- Exclude the full public site footer from auth routes only. It previously added roughly
  260px of unnecessary scrolling below full-height auth panels. Non-auth footers are unchanged.
- Tighten onboarding headings, step/navigation gaps, cards, profile fields and completion
  summary spacing. These overrides are scoped to onboarding and do not change the shared
  account profile editor's styles. Existing step validation stays visible near its action.

Files changed for this update:

- `frontend/src/styles/auth.css`
- `frontend/src/styles/auth-recovery.css`
- `frontend/src/styles/onboarding.css`
- `frontend/src/styles/auth-alert.css` (new)
- `frontend/src/components/AuthAlert.jsx` (new)
- `frontend/src/components/GoogleSignIn.jsx`
- `frontend/src/pages/auth/LoginPage.jsx`
- `frontend/src/pages/auth/SignupPage.jsx`
- `frontend/src/pages/auth/ForgotPasswordPage.jsx`
- `frontend/src/pages/auth/ResetPasswordPage.jsx`
- `frontend/src/pages/auth/RecoveryLayout.jsx`
- `frontend/src/pages/auth/GoogleAuthComplete.jsx`
- `frontend/src/App.jsx` (auth-only public-footer condition)
- `frontend/scripts/verify-auth-layout.cjs` (browser verification)
- `docs/auth-layout.md`

Verification uses installed Edge through Playwright. All auth API calls are intercepted for
layout/error testing: no real sign-ins, new users, profile updates or database writes occur.
The matrix covers Login, Signup, forgot/reset password at 1440x900, 1366x768, 1280x720,
390x844 and 375x667 in English and Arabic, plus four onboarding steps in both languages and
Arabic dark-mode Login (49 cases). Checks include no horizontal overflow, accessible control
heights, visible errors, invalid-field focus, laptop Login/account action visibility and
preserved desktop/mobile image behavior. Signup and long onboarding/mobile content can
scroll naturally; important feedback never requires manual scrolling.

Run with PLAYWRIGHT_MODULE pointing to an installed Playwright package and optionally
ESHAM_LAYOUT_ARTIFACTS pointing to a temporary screenshot/measurement directory.
Frontend validation: `npm --prefix frontend run build` and `npm --prefix frontend test`.
Final results: build passed, all 87 frontend tests passed, and all 49 browser layout cases
passed. Screenshots and measurements were reviewed; `git diff --check` is clean.

Authentication handlers, endpoints, session/onboarding rules and backend behavior were not
changed. No migrations, schema changes or account data repairs were performed for this update.
