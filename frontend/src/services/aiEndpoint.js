// Only public endpoint addresses belong in Vite configuration, never API keys.
export function aiEndpoint(configured, development, localPort) {
  if (!configured) return development ? `http://127.0.0.1:${localPort}` : '';
  if (/^\/(?!\/)[a-zA-Z0-9/_-]*$/.test(configured)) return configured.replace(/\/$/, '');
  try {
    const url = new URL(configured);
    const local = development && url.protocol === 'http:' && ['localhost','127.0.0.1'].includes(url.hostname);
    if ((!local && url.protocol !== 'https:') || url.username || url.password || url.search || url.hash) return '';
    return url.href.replace(/\/$/, '');
  } catch { return ''; }
}
