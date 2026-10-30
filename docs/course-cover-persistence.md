# Course cover persistence

## Root cause traced

The existing cover picker in `CreateCoursePage.jsx` validated the client MIME/size and used `FileReader.readAsDataURL` to preview the selection. It never uploaded the bytes or created a MediaAsset. New-course local drafts also saved that base64 image to browser storage. The course create/PATCH payload omitted `coverMediaAssetId`, and loading an existing draft did not restore the saved cover.

The backend already supported `CourseVersion.CoverMediaAssetId` in `UpdateCourseDraftRequest`, reference validation and PATCH field-presence handling. That field was not broken or missing from the schema. The missing pieces were actual image upload/storage and frontend integration. Reopening the course therefore lost the image and eligibility correctly reported a null cover.

## Persistence flow

1. Selecting a supported JPEG/PNG/WebP validates size (nonempty, at most 2MB) and browser decoding. The temporary preview uses a revocable Blob URL, not base64/localStorage.
2. Save creates a real draft first if needed. Its ID is retained across a failed upload retry, avoiding duplicate course creation.
3. `PUT /api/courses/{courseId}/draft/cover` streams actual bytes with credentials, application header, stable upload identity and encoded original filename.
4. `CourseCoverService` checks Instructor ownership/current editable draft before streaming and rechecks the same version inside the existing serializable course transaction afterward.
5. Shared `IMediaStorage`/`LocalMediaStorage` persists bytes in the existing private `backend/storage/media/` directory (or configured `Media__StorageRoot`). Image signatures and the 2MB limit are enforced; SHA-256 and size are computed while streaming. PNG/JPEG/WebP are supported; SVG and mismatched bytes are rejected. Existing video storage behavior remains supported.
6. The transaction creates a `MediaAsset` with `MediaType=image` and sets the current `CourseVersion.CoverMediaAssetId`. Retried identical upload IDs reuse the same asset; an unrelated/conflicting identity is rejected. Replacing a cover does not delete historical media/files.
7. The normal course PATCH includes the saved cover ID and **only intentionally changed metadata**. A cover-only save sends only `coverMediaAssetId`, preserving objectives, localization and other fields.
8. Course loading restores the image URL from the persisted cover ID. Private authenticated content is served by `GET /api/courses/{courseId}/draft/cover/{assetId}/content`. Editor preview, curriculum card and review preview use that saved image.

Additional metadata endpoint: `GET /api/courses/{courseId}/draft/cover`; an absent cover has an empty successful response, handled as null by the shared request helper. File responses use private/no-store and nosniff headers. Ownership and current-draft checks prevent reading another course's cover through a supplied asset ID. Approved/published content is not editable through these endpoints.

No new entity, migration or schema change. Image bytes are not stored in SQL. The existing course save endpoint's cover contract remains intact. No chatbot or video-creation UI files were changed.

## Real course verification

Course: **أساسيات cpp**, `d95a3d7a-7a6d-407a-8b29-d68684bb349e`.

Current version: `7f74d574-b1fc-4cd8-a665-0d54c2bf53be`.

The user authorized a clearly marked C++ verification cover because the earlier local selection was unavailable to the test session. The uploaded image is intentionally labeled **VERIFICATION COVER**, named `cpp-verification-cover.png`, 1280×720, 50,180 bytes. It is left on this real draft as authorized and can be replaced through the same picker.

Persisted `CoverMediaAssetId`: **`a8422c51-70d6-4fa7-83a5-9e8bea916dfb`**.

Verification confirmed:

- Real PNG bytes uploaded; a real Instructor-owned image MediaAsset exists.
- The current CourseVersion points to that asset.
- The normal course PATCH contained **only** the cover field.
- Refresh/reopen restored a decoded 1280px image from the backend URL, including after clearing localStorage.
- Review preview displayed the saved image and the eligibility `cover` check passed after refresh.
- Repeating the upload with its stable identity returned the same asset.
- SQL pointer/metadata, on-disk bytes and SHA-256 all match the uploaded PNG; exactly one matching asset identity exists.
- Other course metadata matched the original pre-upload snapshot, excluding expected cover/timestamp changes. The course objectives were already populated at verification time; they were not added or changed by this fix.
- The course was not submitted, approved or published. Submission workflow availability remains a separate concern.

Evidence in the OS temporary directory: `esham-cover-verification.json` (metadata baseline, asset identity, hash), `cpp-verification-cover.png`, and `esham-cover-persisted.png`. No credentials are written to these artifacts.

## Files changed

- `backend/esham.BLL/DTOs/Courses/CourseCoverDtos.cs`
- `backend/esham.BLL/Interfaces/ICourseCoverService.cs`
- `backend/esham.BLL/Services/CourseCoverService.cs`
- `backend/esham.PL/Endpoints/CourseCoverEndpoints.cs`
- `backend/esham.PL/Storage/LocalMediaStorage.cs` — supported image types/limits in the shared storage adapter
- `backend/esham.PL/Program.cs` — service registration and endpoint mapping
- `backend/esham.Tests/CourseCoverServiceTests.cs`
- `frontend/src/services/courseCoverApi.js`
- `frontend/src/services/curriculumApi.js` — persisted private cover URL in course mapping
- `frontend/src/pages/instructor/CreateCoursePage.jsx`
- `frontend/src/pages/instructor/CourseReviewPage.jsx` — preserve the mapped real cover instead of forcing an empty placeholder
- `frontend/tests/curriculum.test.mjs`
- `frontend/scripts/verify-course-cover.cjs`
- This report.

## Test results and limits

- Backend build: passed, zero warnings/errors.
- Full backend suite: **268 passed, 16 existing opt-in skips**. Fourteen added cases cover persistence/reload/streaming, metadata preservation, retry/replacement history, ownership, immutable drafts, changed-version races, invalid identity/MIME/path/size, cross-course reads and all three image signatures.
- Frontend suite: **96 passed**, including byte uploads, rejected uploads, stable identities and cover-only PATCH preservation. Production build passed with existing dependency bundling warnings.
- Real Edge browser workflow passed on the current course: select → save → refresh → reopen → eligibility complete; private anonymous content requests return 401.

Storage remains the existing swappable development disk implementation. Production durable/object storage, lifecycle cleanup and public/learner delivery policy remain separate work. Server checks are size/container-signature validation, not a full image moderation/transcoding pipeline. These limits do not replace the existing authorization or course-review requirements.
