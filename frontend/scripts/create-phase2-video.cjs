// Generates synthetic media locally; no API or database is contacted.
const fs = require('node:fs'), path = require('node:path');
const { chromium } = require(process.env.PLAYWRIGHT_MODULE || 'playwright');
(async () => {
  const root = path.resolve(__dirname, '../../artifacts/phase2-isolated'); fs.mkdirSync(root, { recursive: true });
  const browser = await chromium.launch({ channel: 'msedge', headless: true });
  try {
    const page = await browser.newPage();
    const bytes = await page.evaluate(async () => {
      const canvas = document.createElement('canvas'); canvas.width = 160; canvas.height = 90;
      const context = canvas.getContext('2d'); let frame = 0;
      const interval = setInterval(() => { context.fillStyle = frame++ % 2 ? '#680f24' : '#e8dac6'; context.fillRect(0, 0, 160, 90); }, 50);
      const stream = canvas.captureStream(20), recorder = new MediaRecorder(stream, { mimeType: 'video/webm;codecs=vp8' }), chunks = [];
      recorder.ondataavailable = e => chunks.push(e.data);
      const done = new Promise(resolve => { recorder.onstop = resolve; }); recorder.start(); await new Promise(r => setTimeout(r, 2000)); recorder.stop(); await done;
      clearInterval(interval); stream.getTracks().forEach(t => t.stop()); return [...new Uint8Array(await new Blob(chunks).arrayBuffer())];
    });
    fs.writeFileSync(path.join(root, 'synthetic.webm'), Buffer.from(bytes)); console.log('Synthetic isolated video created.');
  } finally { await browser.close(); }
})().catch(() => { console.error('Synthetic video generation failed.'); process.exitCode = 1; });
