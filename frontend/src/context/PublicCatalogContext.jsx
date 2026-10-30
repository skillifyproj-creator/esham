import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { loadPublicCatalog } from '../services/publicCatalog';
export const PublicCatalogContext = createContext({ courses: [], loading: true, error: null, reload: async () => {} });
export const usePublicCatalog = () => useContext(PublicCatalogContext);
export function PublicCatalogProvider({ children }) {
  const [state, setState] = useState({ courses: [], loading: true, error: null });
  const reload = useCallback(async signal => {
    setState(previous => ({ ...previous, loading: true, error: null }));
    try { const courses = await loadPublicCatalog(signal); if (!signal?.aborted) setState({ courses, loading: false, error: null }); }
    catch (error) { if (!signal?.aborted) setState({ courses: [], loading: false, error }); }
  }, []);
  useEffect(() => { const controller = new AbortController(); reload(controller.signal); return () => controller.abort(); }, [reload]);
  return <PublicCatalogContext.Provider value={{ ...state, reload }}>{children}</PublicCatalogContext.Provider>;
}
