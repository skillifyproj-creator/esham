import { defineConfig } from 'vite';

function aiProxy(port, prefix) {
  const gatewayPort = process.env.ESHAM_AI_GATEWAY_PORT;
  if (gatewayPort && !/^\d{1,5}$/.test(gatewayPort)) throw new Error('Invalid local AI gateway port');
  return {
    target: `http://127.0.0.1:${gatewayPort || port}`,
    changeOrigin: true,
    rewrite: path => gatewayPort ? path.slice('/ai'.length) : path.slice(prefix.length) || '/',
    configure(proxy) {
      // Requests stay on the website origin in the browser. Only Vite talks to local AI services.
      // Gateway mode preserves the browser Origin for its actual website-origin validation.
      if (!gatewayPort) proxy.on('proxyReq', request => request.setHeader('Origin', 'http://127.0.0.1:5174'));
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
