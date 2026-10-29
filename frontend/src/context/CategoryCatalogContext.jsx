import { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { loadCategoryCatalog } from '../services/categorySelections';

export const CategoryCatalogContext = createContext({ categories: [], loading: true, error: null, reload: async () => {} });
const Context = CategoryCatalogContext;
export const useCategoryCatalog = () => useContext(Context);
export function CategoryCatalogProvider({ children }) {
  const [state, setState] = useState({ categories: [], loading: true, error: null });
  const reload = useCallback(async () => {
    setState(previous => ({ ...previous, loading: true, error: null }));
    try { setState({ categories: await loadCategoryCatalog(), loading: false, error: null }); }
    catch (error) { setState({ categories: [], loading: false, error }); }
  }, []);
  useEffect(() => { reload(); }, [reload]);
  return <Context.Provider value={{ ...state, reload }}>{children}</Context.Provider>;
}
