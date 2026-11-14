import { createContext, useContext, useEffect, useState, useSyncExternalStore } from 'react';
import { useAccountSession } from './AccountSessionContext';
import { createFinancialStore, emptyFinancialState, visibleFinancialState } from '../services/financialStore';

export const FinancialContext = createContext({ ...emptyFinancialState(), refresh: async () => {}, setEnrollmentPage: () => {}, setHistoryPage: () => {} });
export const useFinancial = () => useContext(FinancialContext);
export function FinancialProvider({ children }) {
  const session = useAccountSession(), [store] = useState(createFinancialStore);
  const id = session.status === 'authenticated' ? session.session.profile.id : null;
  const roles = session.status === 'authenticated' ? session.session.profile.roles || [] : [];
  const rolesKey = JSON.stringify(roles);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const state = visibleFinancialState(snapshot, id);
  useEffect(() => { store.setAccount(id, JSON.parse(rolesKey)); store.refresh(); }, [store, id, rolesKey]);
  useEffect(() => {
    const refresh = () => { if (document.visibilityState !== 'hidden' && !store.getSnapshot().mutating) store.refresh(); };
    window.addEventListener('focus', refresh); window.addEventListener('esham-financial-updated', refresh); window.addEventListener('esham-profile-updated', refresh);
    return () => { window.removeEventListener('focus', refresh); window.removeEventListener('esham-financial-updated', refresh); window.removeEventListener('esham-profile-updated', refresh); };
  }, [store]);
  useEffect(() => { if (state.error?.status === 401) session.refresh().catch(() => {}); }, [state.error, session.refresh]);
  return <FinancialContext.Provider value={{ ...state, refresh: store.refresh, purchase: store.purchase,
    setEnrollmentPage: store.setEnrollmentPage, setHistoryPage: store.setHistoryPage }}>{children}</FinancialContext.Provider>;
}
