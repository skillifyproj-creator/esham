import http from 'node:http';
import { pathToFileURL } from 'node:url';
import { reviewVideo, ReviewError } from './gemini.mjs';

export const MAX_BYTES = 20 * 1024 * 1024;
export function createReviewServer({ apiKey = process.env.GEMINI_API_KEY, model = process.env.GEMINI_MODEL || 'gemini-3.8-flash',
  allowedOrigins = (process.env.ALLOWED_ORIGINS || 'http://127.0.0.1:5174,http://localhost:5174,http://localhost:5173').split(','), review = reviewVideo } = {}) {
  let active = false;
  const requests = [];
  const server = http.createServer(async (req, res) => {
    const origin = req.headers.origin;
    const reply = (status, value) => { if (!res.destroyed) { res.writeHead(status, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }); res.end(JSON.stringify(value)); } };
    // This development bridge must stay on loopback. CORS alone is not production authentication.
    const host = req.headers.host || '';
    if (!/^(127\.0\.0\.1|localhost):\d+$/.test(host) || !/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin || '') || !allowedOrigins.includes(origin)) return reply(403, { error: 'screening-origin' });
    res.setHeader('Access-Control-Allow-Origin', origin);res.setHeader('Access-Control-Allow-Credentials','true');
    res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Media-Id,X-Video-Duration,X-Review-Consent');
    if (req.method === 'OPTIONS') { res.writeHead(204); res.end(); return; }
    if (req.method === 'GET' && req.url === '/health') return reply(200, { configured: Boolean(apiKey), model, maxBytes: MAX_BYTES, maxDuration: 600, mode: 'local-development' });
    if (req.method !== 'POST' || req.url !== '/video/review') return reply(404, { error: 'not-found' });
    if (req.headers['x-review-consent'] !== 'google-video-upload') return reply(400, { error: 'screening-consent' });
    if (!apiKey) return reply(503, { error: 'screening-key-missing' });
    const duration = Number(req.headers['x-video-duration']);
    let mediaId;
    try { mediaId = decodeURIComponent(req.headers['x-media-id'] || ''); } catch { return reply(400, { error: 'screening-metadata' }); }
    const mimeType = (req.headers['content-type'] || '').split(';')[0].trim().toLowerCase();
    if (!mediaId || mediaId.length > 200 || !Number.isFinite(duration) || duration <= 0 || duration > 600 || !['video/mp4', 'video/webm'].includes(mimeType)) return reply(400, { error: 'screening-cloud-format' });
    if (Number(req.headers['content-length']) > MAX_BYTES) return reply(413, { error: 'screening-cloud-size' });
    while (requests.length && requests[0] < Date.now() - 60000) requests.shift();
    if (active || requests.length >= 5) return reply(429, { error: 'screening-rate-limit' });
    active = true; requests.push(Date.now());
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 120000);
    const disconnect = () => { if (!res.writableEnded) controller.abort(); };
    res.on('close', disconnect);
    try {
      const chunks = []; let size = 0;
      for await (const chunk of req) {
        size += chunk.length;
        if (size > MAX_BYTES) throw new ReviewError('screening-cloud-size', 413);
        chunks.push(chunk);
      }
      const bytes = Buffer.concat(chunks);
      const signature = mimeType === 'video/webm' ? bytes.subarray(0, 4).toString('hex') === '1a45dfa3' : bytes.subarray(4, 8).toString() === 'ftyp';
      if (!bytes.length || !signature) throw new ReviewError('screening-cloud-format', 400);
      const result = await review(bytes, { mediaId, duration, mimeType }, { apiKey, model, signal: controller.signal });
      reply(200, result);
    } catch (error) {
      reply(controller.signal.aborted ? 504 : error.status || 502, { error: controller.signal.aborted ? 'screening-timeout' : error instanceof ReviewError ? error.message : 'screening-service' });
    } finally { clearTimeout(timer); res.off('close', disconnect); active = false; }
  });
  server.requestTimeout = 130000;
  server.headersTimeout = 10000;
  return server;
}
if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT || 8000);
  createReviewServer().listen(port, '127.0.0.1', () => console.log(`Video review: http://127.0.0.1:${port} (${process.env.GEMINI_API_KEY ? 'key configured' : 'key missing'})`));
}
