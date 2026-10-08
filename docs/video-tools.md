# Video tools

- Excalidraw: drawing, text, shapes, images, eraser, undo/redo. Scenes are stored in IndexedDB per lesson. Rendered frames enter the recording canvas. Font assets are copied locally by predev/prebuild.
- WaveSurfer: playback timeline and draggable trim selection. Files above 50MB or without decodable audio retain a time-only timeline.
- Mediabunny: precise browser video trimming with WebCodecs. Unsupported codec conversions fall back to the existing canvas/MediaRecorder path. Audio leveling uses the browser dynamics compressor.
- PDF.js: render PDF pages into the recording; PNG/JPEG/WebP are also supported. PowerPoint and Word files can be saved locally, but direct rendering awaits a document conversion service. Screen sharing works as an alternative.

Screen/camera/microphone capture uses native browser APIs and requires the user's permission. Screen, camera, presentation and whiteboard are composited into one 1280×720 recording. Videos and scenes currently persist on the same browser/device; remote storage and synchronization await backend integration.

Verification: 34 frontend tests; production build; real 4.171-second canvas recording trimmed to 2 seconds and persisted; Excalidraw rectangle exported into a 1280×720 frame; PDF page rendered in the presentation frame. Physical camera/microphone and OS screen-picker flows require manual device testing.

Temporary development admin menu exposes `/admin` and `/category-admin` and is omitted from production builds. This is a preview, not production authorization.
