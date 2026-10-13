import { env, pipeline, RawImage } from '@huggingface/transformers';
import { SCREENING_LABELS, SCREENING_MODEL } from './videoSafetyPolicy';
env.allowLocalModels = false;
env.backends.onnx.wasm.numThreads = 1;
let classifier;
self.onmessage = async ({ data }) => {
  try {
    if (!classifier) classifier = await pipeline('zero-shot-image-classification', SCREENING_MODEL, {
      device: 'wasm', dtype: 'q8',
      progress_callback: event => self.postMessage({ type: 'loading', file: event.file, progress: event.progress }),
    });
    if (data.type === 'load') { self.postMessage({ type: 'ready' }); return; }
    const image = new RawImage(new Uint8ClampedArray(data.pixels), data.width, data.height, 4);
    const scores = await classifier(image, SCREENING_LABELS.map(label => label.text), { hypothesis_template: '{}' });
    self.postMessage({ type: 'result', scores });
  } catch (error) { self.postMessage({ type: 'error', message: error.message }); }
};
