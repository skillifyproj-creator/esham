import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { loadCategoryCatalog } from '../services/categorySelections';

export const CategoryCatalogContext = createContext({ categories: [], loading: true, error: null, reload: async () => {} });
const Context = CategoryCatalogContext;
export const useCategoryCatalog = () => useContext(Context);
export function CategoryCatalogProvider({ children }) {
  const generation = useRef(0);
  const [state, setState] = useState({ categories: [], loading: true, error: null });
  const reload = useCallback(async () => {
    const request = ++generation.current;
    setState(previous => ({ ...previous, loading: true, error: null }));
    try { const categories = await loadCategoryCatalog(); if (request === generation.current) setState({ categories, loading: false, error: null }); }
    catch (error) { if (request === generation.current) setState({ categories: [], loading: false, error }); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== 'hidden') reload(); };
    window.addEventListener('focus', refresh); document.addEventListener('visibilitychange', refresh);
    return () => { window.removeEventListener('focus', refresh); document.removeEventListener('visibilitychange', refresh); };
  }, [reload]);
  return <Context.Provider value={{ ...state, reload }}>{children}</Context.Provider>;
}
