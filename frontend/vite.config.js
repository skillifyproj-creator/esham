import { defineConfig } from 'vite';

function aiProxy(port, prefix) {
  return {
    target: `http://127.0.0.1:${port}`,
    changeOrigin: true,
    rewrite: path => path.slice(prefix.length) || '/',
    configure(proxy) {
      // Requests stay on the website origin in the browser. Only Vite talks to local AI services.
      proxy.on('proxyReq', request => request.setHeader('Origin', 'http://127.0.0.1:5174'));
    },
  };
}

export default defineConfig({
  server: {
    port: 5174,
    strictPort: true,
    proxy: {
      '^/ai/assistant(?:/|$)': aiProxy(8001, '/ai/assistant'),
      '^/ai(?:/|$)': aiProxy(8000, '/ai'),
    },
  },
});
