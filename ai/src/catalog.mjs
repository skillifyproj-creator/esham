const guid = value => typeof value === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value) && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value);
const text = (value, limit) => typeof value === 'string' ? value.slice(0, limit) : '';

// Only the backend public-course projection is accepted, never browser catalog/ownership claims.
export function catalogProjection(rows) {
  if (!Array.isArray(rows) || rows.length > 200) throw Error('catalog-limit');
  const seen = new Set();
  return rows.map(row => {
    if (!row || !guid(row.courseId) || !guid(row.publishedVersionId) || !guid(row.categoryId)
      || seen.has(row.courseId.toLowerCase()) || !(row.titleAr?.trim() || row.titleEn?.trim())) throw Error('catalog-input');
    seen.add(row.courseId.toLowerCase());
    return { id: row.courseId.toLowerCase(), title: { ar: text(row.titleAr || row.titleEn, 200), en: text(row.titleEn || row.titleAr, 200) },
      description: { ar: text(row.descriptionAr || row.descriptionEn, 4000), en: text(row.descriptionEn || row.descriptionAr, 4000) },
      category: row.categoryId.toLowerCase(), tags: [], level: ['beginner', 'intermediate', 'advanced'].includes(row.level) ? row.level : '', status: 'published' };
  });
}

// The existing public API returns an array, not a paginated contract. Read a bounded
// prefix without buffering the entire catalog or assuming unsupported query parameters.
async function publicPrefix(response) {
  const reader=response.body.getReader(),decoder=new TextDecoder(),rows=[];
  let bytes=0,started=false,closed=false,item='',depth=0,quoted=false,escaped=false,separator=false;
  try {
    for (;;) {
      const {value,done}=await reader.read();if(done){if(!closed)throw Error('catalog-input');return rows;}
      bytes+=value.byteLength;if(bytes>2*1024*1024)throw Error('catalog-limit');
      for(const char of decoder.decode(value,{stream:true})) {
        if(closed){if(!/\s/.test(char))throw Error('catalog-input');continue;}
        if(!started){if(/\s/.test(char))continue;if(char!=='[')throw Error('catalog-input');started=true;continue;}
        if(!depth){
          if(/\s/.test(char))continue;
          if(separator){if(char===']'){closed=true;continue;}if(char!==',')throw Error('catalog-input');separator=false;continue;}
          if(char===']'&&!rows.length){closed=true;continue;}
          if(char!=='{')throw Error('catalog-input');item='{';depth=1;continue;
        }
        item+=char;
        if(quoted){if(escaped)escaped=false;else if(char==='\\')escaped=true;else if(char==='"')quoted=false;continue;}
        if(char==='"')quoted=true;else if(char==='{'||char==='[')depth++;else if(char==='}'||char===']')depth--;
        if(!depth){rows.push(JSON.parse(item));item='';separator=true;if(rows.length===200){await reader.cancel();return rows;}}
      }
    }
  } finally { await reader.cancel().catch(()=>{});reader.releaseLock(); }
}

export function backendCatalog(sessionUrl, { fetcher = fetch, now = Date.now, ttl = 30000 } = {}) {
  const url = new URL(sessionUrl); url.pathname = '/api/courses/public'; url.search = ''; url.hash = '';
  let cached = [], until = 0, pending;
  return async () => {
    if (now() < until) return cached;
    if (pending) return pending;
    pending = (async () => {
      try {
        const response = await fetcher(url.href, { headers: { Accept: 'application/json' }, credentials: 'omit', redirect: 'error', signal: AbortSignal.timeout(5000) });
        if (!response.ok || !/^application\/json(?:;|$)/i.test(response.headers.get('content-type') || '')) throw Error('catalog-unavailable');
        cached = catalogProjection(await publicPrefix(response));
        until = now() + Math.max(1000, Math.min(ttl, 60000));
      } catch { cached = []; until = now() + 5000; }
      return cached;
    })();
    try { return await pending; } finally { pending = null; }
  };
}
