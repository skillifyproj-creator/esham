# Video tools

## Licenses and browser compatibility (verified 2026-10-08)

| Installed library | License | Browser use |
| --- | --- | --- |
| Excalidraw 0.18.1 | MIT | React whiteboard in modern browsers |
| WaveSurfer 8.0.2 | BSD-3-Clause | Web Audio timeline, with time-only fallback for undecodable audio |
| Mediabunny 1.61.3 | MPL-2.0 | Modern browsers; codec support depends on WebCodecs; MediaRecorder fallback is used |
| PDF.js 6.4.299 | Apache-2.0 | Modern browser PDF rendering; support varies by version |

These installed open-source packages require no paid subscription or license key for the implemented features. Preserve license/copyright notices when distributing the app. Mediabunny's MPL conditions apply to distributing its covered source files or modifications, not automatically to all application source. No paid codec extensions or Excalidraw Plus APIs are used.

This is not a claim of universal browser support. Native screen capture requires a secure context (HTTPS or localhost), user consent, and a browser/platform that implements getDisplayMedia. Browser/system audio capture and supported recording codecs vary. Verify desktop Chrome/Edge, Firefox, Safari and mobile targets separately before release; mobile screen capture cannot be assumed.

Official sources:
- https://github.com/excalidraw/excalidraw/blob/master/LICENSE
- https://github.com/katspaugh/wavesurfer.js
- https://github.com/Vanilagy/mediabunny
- https://mediabunny.dev/guide/installation
- https://github.com/mozilla/pdf.js/wiki/Frequently-Asked-Questions
- https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getDisplayMedia

- Excalidraw: drawing, text, shapes, images, eraser, undo/redo. Scenes are stored in IndexedDB per lesson. Rendered frames enter the recording canvas. Font assets are copied locally by predev/prebuild.
- WaveSurfer: playback timeline and draggable trim selection. Files above 50MB or without decodable audio retain a time-only timeline.
- Mediabunny: precise browser video trimming with WebCodecs. Unsupported codec conversions fall back to the existing canvas/MediaRecorder path. Audio leveling uses the browser dynamics compressor.
- PDF.js: render PDF pages into the recording; PNG/JPEG/WebP are also supported. PowerPoint and Word files can be saved locally, but direct rendering awaits a document conversion service. Screen sharing works as an alternative.

Screen/camera/microphone capture uses native browser APIs and requires the user's permission. Screen, camera, presentation and whiteboard are composited into one 1280×720 recording. Videos and scenes currently persist on the same browser/device; remote storage and synchronization await backend integration.

Verification: 34 frontend tests; production build; real 4.171-second canvas recording trimmed to 2 seconds and persisted; Excalidraw rectangle exported into a 1280×720 frame; PDF page rendered in the presentation frame. Physical camera/microphone and OS screen-picker flows require manual device testing.

Temporary development admin menu exposes `/admin` and `/category-admin` and is omitted from production builds. This is a preview, not production authorization.

The recording workspace now places the whiteboard beside a sticky live preview. Screen sharing stays active when opening the board, annotation exports have a transparent background, and changing layouts preserves the active drawing session. Below 700px, the preview remains visible above the board while scrolling.

Recording correction: requestFrame is called explicitly for the recording canvas, including the first frame, to prevent empty recordings of static content. AudioContext is only created when live audio exists. Sharing starts as screen-only unless a camera is already active, and failed startup retains the shared stream for retry. Deleted Excalidraw elements are excluded from exported frames and board changes immediately repaint the preview. Browser verification through the actual LessonVideoWorkflow: 7.7-second 1280x720 WebM, 91KB, saved and reached preview; a rectangle was drawn then deleted and disappeared from both board and preview. Physical display-picker permission was not automated.
