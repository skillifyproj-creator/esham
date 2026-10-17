# Frontend handoff

Source code and test fixtures live under `frontend/`. Root npm commands delegate to that directory; browser routes such as `/tests/...` are unchanged.
The site supports a local browser preview. Course publishing, task assessment, files, points and progress currently use browser storage; they are not a shared, authoritative platform. Do not deploy the demo as an authenticated production service.

## Account API already connected in the forms

Set `VITE_API_BASE_URL` to the API root and restart Vite. Requests use cookie sessions (`credentials: include`), a 15-second timeout, JSON, and `X-Requested-With: XMLHttpRequest`. Passwords are never written to storage. Loading, error, retry and success states are present.

| Method | Endpoint | JSON body | Success |
|---|---|---|---|
| POST | `/auth/login` | `email, password` | `{profile}` |
| POST | `/auth/register` | `name, email, password` | `{profile:{id}}`; establish session for onboarding |
| POST | `/auth/logout` | omitted | 204 |
| POST | `/auth/forgot-password` | `email` | 204; identical response whether account exists |
| POST | `/auth/reset-password` | `token, password` | 204; validate expiry and single use on server |
| PATCH | `/me` | profile fields | 204 or JSON; server owns immutable identity |
| PATCH | `/me/role` | `role: learner/instructor/both` | 204 or JSON; preserve account ID and histories |
| POST | `/me/password` | `currentPassword, password` | 204 |
| DELETE | `/me` | omitted | 204; UI requires confirming deletion in a modal |

`profile` requires a stable string `id` and `role`. Optional fields include `name`, `nameEn`, `username`, `avatar`, `bio`, `interests`, `teachingAreas`, `customSkills`, `goal`. The server must validate and whitelist fields; disregard client IDs and balance claims. Errors: 401 for unauthenticated/invalid credentials, 429 for throttling, other non-2xx for failed operations. All successful responses other than 204 must be JSON.

Use Secure HttpOnly cookies, explicit CORS origins when cross-origin, CSRF protection including Origin/Fetch-Metadata checks, session invalidation and role authorization on the server. Client route visibility and development admin links are not access control. Production authorization/session restoration and business-data adapters require the actual backend contract before release.

## Business service boundaries to replace with server adapters

### Google sign-in

The login and signup screens share a Google entry point and retain email/password. Enable `VITE_GOOGLE_AUTH_ENABLED=true` only with `VITE_API_BASE_URL` and these implemented endpoints. Otherwise the Google button clearly states it is unavailable.

- `GET /auth/google/start?returnTo=<frontend-origin>/auth/google/complete`: allowlist the exact frontend callback URL. Create server-bound, single-use state and nonce, then redirect to Google for `openid email profile` using the authorization code flow. Configure the Google client and its exact backend redirect URI in Google Cloud; keep the client secret on the server.
- `GET /auth/google/callback`: validate state/nonce, exchange the code server-side, validate issuer/audience/expiry and verified identity, and use Google's subject ID as the provider identifier. Never automatically link an existing account solely by a matching email. Establish the same HttpOnly cookie session as password login, then redirect to the allowlisted frontend completion page. On denial/failure redirect there with `?error=cancelled`; no tokens or profile data in URLs.
- `GET /auth/session`: return `{profile, onboardingRequired:false}` for an existing complete account or `{profile:{id,name}, onboardingRequired:true}` for an authenticated new account. Return 401 without a valid session. The frontend restores identity from this endpoint, routes complete accounts to their workspace, and sends new users through role/profile/interests/goals setup. `/me` must permit authenticated onboarding while validating the submitted fields.

Use Google's [OpenID Connect server flow](https://developers.google.com/identity/openid-connect/openid-connect). Backend implementation and Google project credentials are still required; the repository currently contains no running account server.

- `pointsLedger.js`: grant **20 once per account**; registration costs **20**; credit course owner **20 per distinct registration**. Enforce atomically and idempotently on the server. No points for lesson/task completion. Preserve ledger on role changes; reject self-enrollment and insufficient balance.
- `coursePublishing.js`: validate, submit, scoped admin review, publish approved snapshot. Draft edits do not mutate an already approved public snapshot until approval. Replace local queue with API; reviewers must be authenticated and category scope validated server-side.
- `taskSubmissions.js`: enrolled learner draft/submit, owner-only assessment, revisions, approved completion. No completion reward. Persist files in shared object storage and return authorized URLs.
- `mediaStore.js`: local IndexedDB blob preview. Replace with authenticated upload/download endpoints and server storage; retain user-facing format/size validation. Video recording and trimming are client features; long recordings/encoding need device testing and preferably server processing for scale.
- Learner progress, reviews, replies, notifications, administrator records, reporting and moderation remain local preview adapters. Wire shared persistence and delivery to the server.
- Certificates: Arabic/English preview and one-page landscape A4 PDF work in browser. Issue date, approval, verification ID, English course/instructor translations and authoritative eligibility come from the server. Names are supplied by the learner; English spelling can be set separately.

The administrator shortcut and category admin selector are available in development or when VITE_ADMIN_PREVIEW=true. The current .env.production enables them for the public project demonstration. They are demo navigation, not authorization; disable for a non-demo deployment and enforce server permissions. Email delivery, AI assistance, authoritative moderation and cross-device data need backend services. Experimental local CLIP visual screening is implemented; its scores are not authoritative, it samples at most 60 frames, omits audio, and can be bypassed. See local-video-screening.md.

## Local QA

`npm test`, `npm run build`; open `/tests/media-preview.html` on **localhost in development only** for a real generated video/trim/persistence test and three certificate samples. `/tests/points-preview.html` isolates demo enrollment testing from the canonical 127.0.0.1 preview. Test pages are not production build inputs.
