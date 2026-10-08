# Frontend handoff

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

- `pointsLedger.js`: grant **20 once per account**; registration costs **20**; credit course owner **20 per distinct registration**. Enforce atomically and idempotently on the server. No points for lesson/task completion. Preserve ledger on role changes; reject self-enrollment and insufficient balance.
- `coursePublishing.js`: validate, submit, scoped admin review, publish approved snapshot. Draft edits do not mutate an already approved public snapshot until approval. Replace local queue with API; reviewers must be authenticated and category scope validated server-side.
- `taskSubmissions.js`: enrolled learner draft/submit, owner-only assessment, revisions, approved completion. No completion reward. Persist files in shared object storage and return authorized URLs.
- `mediaStore.js`: local IndexedDB blob preview. Replace with authenticated upload/download endpoints and server storage; retain user-facing format/size validation. Video recording and trimming are client features; long recordings/encoding need device testing and preferably server processing for scale.
- Learner progress, reviews, replies, notifications, administrator records, reporting and moderation remain local preview adapters. Wire shared persistence and delivery to the server.
- Certificates: Arabic/English preview and one-page landscape A4 PDF work in browser. Issue date, approval, verification ID, English course/instructor translations and authoritative eligibility come from the server. Names are supplied by the learner; English spelling can be set separately.

Development admin shortcut and category admin preview selector are excluded from production builds. They help test UI only. Email delivery, AI assistance/moderation and cross-device data need backend services.

## Local QA

`npm test`, `npm run build`; open `/tests/media-preview.html` on **localhost in development only** for a real generated video/trim/persistence test and three certificate samples. `/tests/points-preview.html` isolates demo enrollment testing from the canonical 127.0.0.1 preview. Test pages are not production build inputs.
