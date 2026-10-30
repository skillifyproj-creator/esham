# Video environment audit and backend integration

Update: the later [one-video rule](submission-eligibility-and-one-video.md) supersedes the original multiple-attachment/source examples below. A lesson now keeps at most one video relationship; source MediaAssets and files are retained independently.

## Existing environment: audit

No video-creation UI redesign or tool refactor was performed. The five existing route pages, recording/upload controls, layouts, whiteboard, annotation tools, timeline, and their CSS remain in use. A data-loading wrapper is the limited structural change needed to resolve real lessons before rendering the environment.

| Area | Existing implementation | Persistence before this change |
| --- | --- | --- |
| Routing | `InstructorVideoSourcePage`, `InstructorVideoRecordingSetupPage`, `InstructorVideoRecordingPage`, `InstructorVideoPreviewPage`, `InstructorVideoEditorPage` delegate to `LessonVideoWorkflow` | Lesson lookup used `getInstructorCourseWorkspace`, which was the old local/demo workspace rather than the backend draft |
| Upload | Existing file picker/drop zone; MP4/WebM/MOV, nonempty and at most 2GB; `inspectVideo` validates browser playback/duration/dimensions | Actual Blob in IndexedDB `esham-media-v1`, object store `files`; no server upload |
| Recording | `MediaRecorder`, `getUserMedia`, `getDisplayMedia`, `enumerateDevices`, `MediaStream`, canvas `captureStream`, animation frames and track cleanup; Web Audio mixes screen/microphone audio and meters levels | Actual recorded video Blob in IndexedDB |
| Composition | Existing 1280×720 canvas composites camera, screen, side-by-side, whiteboard/file, camera inset and annotations; pause/resume and device controls | Final composed recording local only |
| Preview | Native HTML video with controls; `useStoredMedia` and `StoredVideo` create/revoke Blob object URLs | Local indexed Blob; unrelated older previews can also supply an HTTP URL |
| Trimming/editing | `mediabunny` ^1.61.3 conversion and WebCodecs (`VideoEncoder`); MediaRecorder/canvas/Web Audio fallback; optional dynamics compressor/audio leveling | Exports a real new WebM Blob instead of overwriting the input; still local only |
| Timeline | `wavesurfer.js` ^8.0.2, regions and timeline plugins; large/silent-file waveform fallback | Selection state in component memory |
| Whiteboard | `@excalidraw/excalidraw` ^0.18.1; tools and exported canvas frames, bundled fonts/assets | Scene JSON and images in IndexedDB; not a server-backed collaborative scene |
| Screen annotations | `ScreenAnnotations` Canvas 2D overlay with pen/highlighter/text/eraser, undo/redo and pointer interactions | In-memory actions baked into recorded frames; not independently server-persisted |
| Presentations | `pdfjs-dist` ^6.4.299 worker renders PDF pages; `createImageBitmap` for images; Office documents require screen-sharing or a PDF export | Chosen source file in IndexedDB, reference in localStorage; no Office conversion backend |
| Local CLIP | `@huggingface/transformers` ^4.3.1 worker, `Xenova/clip-vit-base-patch32`, quantized WASM inference, 224×224 sampled frames; `videoSafetyPolicy` validates advisory findings | Browser result associated with local media identity; not trusted server moderation |
| Cloud screening | `cloudVideoReview` calls configured `VITE_VIDEO_REVIEW_API_URL`, default development port 8000, `/health` and `/video/review`; Gemini-backed advisory review, 20MB/10-minute MP4/WebM limits | Optional external service with configuration/key/availability requirements; findings cached in video metadata |

The recording, upload, decoding, composition, preview and export pieces already produce usable real files in compatible desktop browsers. Their original persistence was **device-local**, not production platform storage. Office conversion, legacy demo-workspace writes and local approval claims were incomplete platform integration. Camera/screen recording still requires browser permission and HTTPS or localhost. No video bytes were previously stored in SQL or backend file/object storage. Excalidraw font assets under frontend public are application assets, not Instructor uploads. No sessionStorage authority was used by this video pipeline.

## Integration points and preserved UI

- `EditLessonPage.jsx` now loads real lesson attachments and removes the manual MediaAsset GUID form. Video lessons show Add Video. Clicking it saves current basic fields/objectives/type first, obtains a real lesson ID for new lessons, and opens the existing source route. Article lessons show no video action. Saved video uses the authenticated backend stream. Detach removes the selected relationship after confirmation.
- `LessonVideoWorkflow.jsx` adds a data-loading wrapper around the existing environment. It reads the real owned draft, section, lesson and attached primary video. Existing route parameters supply all context, and the server resolves the current CourseVersion instead of trusting a client version ID. Return navigation is constructed from those same IDs, not an arbitrary incoming URL.
- The environment's final existing **Save video to lesson** action uploads actual bytes and returns to that lesson editor. Local IndexedDB still holds editing drafts and disposable cached server files. Draft metadata/whiteboard/presentation keys now include owner + course + section + lesson to avoid mixing accounts.
- `lessonMediaApi.js` reuses `VITE_API_BASE_URL`, credentials and application headers. It hydrates saved bytes into the existing IndexedDB/player implementation, preserving all existing editor components. Pending local drafts are distinguished from saved backend attachments. A cache clear or a different browser does not remove the server attachment.
- Derived exports persist their source chain first when necessary, then register a new immutable media identity with `SourceMediaAssetId`. Stable local media IDs are upload retry IDs. Repeating the same upload does not duplicate assets, attachments or screening placeholders, and cannot move that identity to another lesson.
- The optional AI scan action remains in the same place. Draft persistence no longer automatically sends files to Gemini or depends on AI availability. One existing screening status sentence was corrected to say that saving a draft does not approve a flagged video. This is the only presentation copy changed inside a video component; no layouts, controls, styles or navigation were redesigned.

## Backend and storage

The existing schema already supports `MediaAsset`, `LessonAttachment`, `SourceMediaAssetId`, `Lesson.PrimaryVideoMediaAssetId`, and hash-bound `ScreeningResult`. No migration, schema alteration, or parallel media model was added. `TaskAttachment` remains unchanged; task/document uploads are outside this lesson-video slice.

`IMediaStorage` abstracts bytes from metadata. `LocalMediaStorage` streams up to 2GB to a temporary file, calculates SHA-256 while streaming, checks the MP4/MOV `ftyp` or WebM EBML signature against the declared MIME, then atomically renames it to an opaque generated key. Partial/invalid files are removed. Bytes never enter SQL. Filename/path traversal is rejected and storage keys cannot be client filesystem paths.

Development default: `backend/storage/media/`, already gitignored, outside the web root. Set `Media__StorageRoot` to configure a durable private directory. Outside Development there is no implicit local directory: configure storage or replace `IMediaStorage` with an object-store provider. The directory is not served through static-file middleware. Authenticated, authorized lesson endpoints return private/no-store, nosniff streams with HTTP range support.

Each new asset creates a hash-bound **pending, untrusted** ScreeningResult with zero samples. Browser CLIP/Gemini findings are not accepted as server approval. No Submit for Review/publication or AI moderation policy was implemented or weakened.

Uploads check authorization before reading bytes, then recheck the current editable draft in the existing serializable course-lock transaction before committing asset/attachment/primary relationships. Owners alone can manage their current editable draft. Cross-section, cross-course, historical-version and foreign-media references are rejected. Source assets must already be attached to that same owned draft lesson. Approved/published content remains immutable.

Detaching removes only LessonAttachment and clears a matching primary pointer. It never deletes files, MediaAsset, source assets, shared content or screening history. The existing lesson metadata API was also tightened so assigning a different primary video requires an attachment to the same lesson, closing a cross-lesson metadata shortcut.

## Endpoints

Base: `/api/courses/{courseId}/draft/sections/{sectionId}/lessons/{lessonId}/media`

| Method | Suffix | Purpose |
| --- | --- | --- |
| GET | none | List owned draft video attachments, primary indicator, internal IDs and content route |
| POST | none | Stream video bytes; create/reuse MediaAsset, attach to lesson and select primary |
| DELETE | `/{attachmentId}` | Detach without deleting underlying media |
| GET | `/{attachmentId}/content` | Authorized stream with byte ranges |

POST sends the raw Blob, a supported video Content-Type, `X-Upload-Id`, URI-encoded `X-File-Name`, `X-Video-Duration`, and optional `X-Source-Media-Id`. Mutations require the application request header. IDs are integration details, never manually entered by users.

## Files changed for this task

- Backend: `DTOs/Courses/LessonMediaDtos.cs`, `Interfaces/IMediaStorage.cs`, `Interfaces/ILessonMediaService.cs`, `Services/LessonMediaService.cs`, `Services/CurriculumService.cs`, `Storage/LocalMediaStorage.cs`, `Endpoints/LessonMediaEndpoints.cs`, `Program.cs`.
- Backend tests: `LessonMediaServiceTests.cs`, `CurriculumServiceTests.cs`.
- Frontend: `services/lessonMediaApi.js`, `pages/instructor/EditLessonPage.jsx`, `pages/instructor/LessonVideoWorkflow.jsx`, the one status sentence in `components/video/VideoScreeningPanel.jsx`.
- Frontend tests/config: `tests/lesson-media.test.mjs`, `tests/frontend.test.mjs` (server-loading assertion replaces the obsolete demo SSR expectation), `package.json`.
- Verification: `scripts/verify-lesson-media.cjs`, `scripts/cleanup-lesson-media.ps1`, this report.

## Verification

- Backend build passed, zero warnings/errors.
- Complete backend tests: **230 passed, 16 existing opt-in SQL tests skipped**. The new media suite covers 16 cases: ownership, immutable/missing drafts, historical/foreign lessons, asset/attachment creation, duplicate retry, source derivation, streaming, safe detach, cross-lesson source/identity rejection, metadata-API bypass prevention, editability recheck after streaming, invalid metadata/article uploads, and storage signatures/hash/size/path safety.
- Frontend tests: **92 passed**. Production build passed; existing third-party bundling warnings remain.
- Real Edge browser with authorized Fatima Instructor: create temporary draft; create lesson through Add Video; existing upload/record source UI; upload actual playable WebM; actual trim/export; persist original and derived MediaAssets plus LessonAttachments; retry without duplicates; return to exact lesson; refresh after clearing IndexedDB/localStorage; server playback; reopen source/preview and refresh; authorized 206 range response; anonymous 401; detach primary; source remains readable and detached endpoint becomes 404.
- Recording controls and composition code were left unchanged. Browser verification exercised upload and trim; physical camera/microphone/screen-sharing permission paths were not exercised.
- Temporary test course, metadata, attachments, pending screenings and tracked media files are removed by guarded cleanup. Existing real courses and other account/enrollment/wallet/notification/admin logic are untouched.

## Remaining production limitations

Local disk is development persistence, not replicated object storage. Production needs a durable provider, deployment body-size/timeouts, quotas, backups and lifecycle/orphan collection. An interrupted database transaction with an uncertain commit can leave an orphan file; it is retained rather than risking deletion of committed/shared content. Detach deliberately retains assets for safe history/lifecycle handling.

Container signatures are basic validation, not full server decoding, malware scanning or trusted moderation. Duration/dimensions originate in browser inspection. Trusted server processing, transcoding, hash-bound moderation jobs, review enforcement and public/learner media delivery remain separate work. Browser AI results are advisory. Whiteboard scene/PDF/presentation source files remain local editing sources; only their composed video output is uploaded here. Large-video editing/rehydration still depends on browser memory/storage and supported codecs, as in the preserved environment.
