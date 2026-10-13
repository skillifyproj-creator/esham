# Experimental local video screening — 2026-10-13

## Use

Record or upload a video, open its preview, and select **Screen video now**. Saving a video to its lesson also runs the scan when there is no matching result. First use downloads model files (hundreds of MB may be needed) from Hugging Face plus the ONNX runtime assets; subsequent use can reuse browser caches. HTTPS or localhost and a modern browser with WebAssembly/Workers are required. Low-memory devices may fail; failure never counts as approval in the video save workflow.

Library: `@huggingface/transformers` 4.3.1 (Apache-2.0). Model: `Xenova/clip-vit-base-patch32`, ONNX conversion of OpenAI CLIP (MIT). No paid API, key or server inference is used. Downloads make normal network requests to asset/model hosts; sampled video pixels are passed only to a local worker, not uploaded to those hosts. A fresh offline browser cannot run its first scan. Preserve upstream license notices.

## Result and enforcement

- Samples approximately every two seconds for short videos, capped at 60 evenly distributed frames including the beginning and near the end. The UI displays the actual count/spacing; long videos have sparse coverage.
- CLIP compares each sampled image against ordinary/educational scenes, ordinary fires without nearby body parts, non-graphic medical illustrations, graphic injuries, a burning body, a hand dangerously close to flames, assault and explicit sexual content. It is a general zero-shot model, not a validated moderation model.
- Any top harmful label, near harmful result, weak or tied result requires review. Thresholds are provisional heuristics in `videoSafetyPolicy.js`; displayed scores are relative similarity, not calibrated confidence or a probability of violation.
- A complete scan yields `review` or `no-flags`; “no flags” never means safe, approved for publication, or suitable for children. Audio, speech, text, contextual intent, child-specific hazards and unsampled brief scenes are not reliably covered.
- Findings include timestamps and categories; timestamps jump the video preview to the corresponding frame. No graphic thumbnails are generated. Files remain local drafts and are never automatically deleted. Users can trim/replace a video and rescan.
- Screening metadata is bound to media ID, duration and policy version. Trimmed/new files receive a new ID and must be scanned again. A failed/cancelled explicit rescan clears the previous draft result.
- Flagged files cannot finish the workflow's save-to-lesson action. Existing flagged lessons are not ready, and the local administrator approval service rejects flagged course content.
- Older lesson files/external URLs and alternate direct editing paths are not globally required to scan in this prototype. Browser storage can be modified; this is **not server authorization or a production publication barrier**. An administrator cannot override an AI flag through the local preview; authenticated appeals/human review require a backend adapter.

## QA

`npm test` includes sampling boundaries, ordinary-fire distinction in policy handling, ambiguous/malformed outputs, partial-scan rejection, replacement invalidation, and local lesson/publication guards. Those policy tests use fixed scores and do not validate model accuracy.

Development fixture `/tests/video-screening.html` creates a real approximately two-second WebM whiteboard clip and runs the production worker/model. A real browser run on 2026-10-13 completed three sampled-frame inferences and returned `no-flags`. This establishes functioning inference, not measured detection accuracy on violence or sexual content. Representative licensed evaluation clips, false-positive/false-negative metrics, desktop/mobile memory testing, and full server-side enforcement are still needed before release.

## Primary references

- [Transformers.js](https://github.com/huggingface/transformers.js)
- [ONNX model usage](https://huggingface.co/Xenova/clip-vit-base-patch32)
- [CLIP model card and limitations](https://huggingface.co/openai/clip-vit-base-patch32)
- [CLIP source/license](https://github.com/openai/CLIP)

### Follow-up browser verification

- Policy v1 missed a synthetic hand-near-candle diagram. Policy v2 explicitly includes dangerous hand/flame proximity; its three sampled frames required review (relative similarity around 0.47–0.49). This is a narrow synthetic regression, not validation on real human fire footage.
- A separate candle-without-person clip and educational whiteboard clip each completed a real three-frame inference and returned `no-flags` under v2. Never perform a dangerous physical stunt to test this feature.
- The user-facing panel now contains only the scan/cancel button, progress/result and findings. An external tooltip on hover or keyboard focus explains optional screening, its experimental nature and first-use download. Long explanatory paragraphs have been removed from the panel.
- 39 automated tests and production build pass. Runtime smoke checks on 14 public, learner, instructor, account, help and administrator pages found no browser errors, broken images or horizontal overflow, and one shared footer per page. This does not cover every possible path/device.
- Actual recording through LessonVideoWorkflow saved a roughly 42.8-second 1280×720 WebM (~547KB). The media fixture recorded 4.184 seconds, produced a real two-second trimmed file, and persisted it (44,055 bytes). Physical camera/microphone/display permission flows were not repeated.
- `npm audit --omit=dev` returned zero known vulnerabilities. Existing module-directive build warnings remain non-fatal.
