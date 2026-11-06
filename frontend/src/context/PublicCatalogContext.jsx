import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { loadPublicCatalog } from '../services/publicCatalog';
export const PublicCatalogContext = createContext({ courses: [], loading: true, error: null, reload: async () => {} });
export const usePublicCatalog = () => useContext(PublicCatalogContext);
export function PublicCatalogProvider({ children }) {
  const generation = useRef(0);
  const [state, setState] = useState({ courses: [], loading: true, error: null });
  const reload = useCallback(async signal => {
    const request = ++generation.current;
    setState(previous => ({ ...previous, loading: true, error: null }));
    try { const courses = await loadPublicCatalog(signal); if (!signal?.aborted && request === generation.current) setState({ courses, loading: false, error: null }); }
    catch (error) { if (!signal?.aborted && request === generation.current) setState({ courses: [], loading: false, error }); }
  }, []);
  useEffect(() => { const controller = new AbortController(); reload(controller.signal); return () => controller.abort(); }, [reload]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== 'hidden') reload(); };
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    window.addEventListener('esham:catalog-updated', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); window.removeEventListener('esham:catalog-updated', refresh); };
  }, [reload]);
  return <PublicCatalogContext.Provider value={{ ...state, reload }}>{children}</PublicCatalogContext.Provider>;
}
