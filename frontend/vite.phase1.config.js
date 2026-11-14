import { defineConfig, mergeConfig } from 'vite';
import base from './vite.config.js';

// Separate process, origin and optimizer cache; VITE_API_BASE_URL is supplied only
// to this process. The shared .env.local and server on 5174 remain unchanged.
export default defineConfig(mergeConfig(base, {
  cacheDir: 'node_modules/.vite-phase1-isolated',
  server: { host: 'localhost', port: 5175, strictPort: true },
}));
