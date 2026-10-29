import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useSyncExternalStore } from 'react';
import { useAccountSession } from './AccountSessionContext';
import { AccountApiError } from '../services/accountApi';
import { createNotificationStore, emptyNotificationState, visibleNotificationState } from '../services/notifications';

const unavailable = async () => { throw new AccountApiError('unauthorized', 401); };
export const NotificationsContext = createContext({ ...emptyNotificationState(null), status: 'anonymous',
  refresh: unavailable, markRead: unavailable, markAll: unavailable, setPage: unavailable, setFilter: unavailable });

export function NotificationsProvider({ children }) {
  const session = useAccountSession();
  const accountId = session.status === 'authenticated' ? session.session?.profile?.id || null : null;
  const currentAccount = useRef(accountId); currentAccount.current = accountId;
  const store = useMemo(() => createNotificationStore(), []);
  const snapshot = useSyncExternalStore(store.subscribe, store.getSnapshot, store.getSnapshot);
  const run = useCallback(async action => {
    try {
      if (!currentAccount.current || currentAccount.current !== store.getSnapshot().accountId) throw new AccountApiError('unauthorized', 401);
      return await action();
    } catch (error) {
      if (error.status === 401) session.refresh().catch(() => {});
      throw error;
    }
  }, [store, session.refresh]);
  useEffect(() => {
    store.setAccount(accountId);
    if (!accountId) return;
    run(() => store.refresh()).catch(() => {});
    const update = () => {
      const state = store.getSnapshot();
      if (!state.loading && !state.mutating && document.visibilityState !== 'hidden') run(() => store.refresh()).catch(() => {});
    };
    window.addEventListener('focus', update);
    window.addEventListener('esham-profile-updated', update);
    const timer = setInterval(update, 60000);
    return () => { clearInterval(timer); window.removeEventListener('focus', update); window.removeEventListener('esham-profile-updated', update); store.setAccount(null); };
  }, [accountId, run, store]);
  // Effects run after rendering: never expose A's inbox for one render as B.
  const visible = visibleNotificationState(snapshot, accountId);
  const error = visible.error || (session.status === 'unconfigured' ? new AccountApiError('unconfigured') : session.status === 'error' ? session.error : null);
  const value = { ...visible, accountId, status: session.status, error, loading: session.status === 'loading' || visible.loading,
    refresh: () => accountId ? run(() => store.refresh()) : session.refresh(),
    markRead: id => run(() => store.markRead(id)), markAll: () => run(() => store.markAll()),
    setPage: page => run(() => store.refresh({ page })),
    setFilter: filter => run(() => store.refresh({ page: 1, isRead: filter === 'unread' ? false : filter === 'read' ? true : null })),
  };
  return <NotificationsContext.Provider value={value}>{children}</NotificationsContext.Provider>;
}

// One recipient-owned inbox across all personas; role is only presentation.
export function useNotifications(_role = 'learner') { return useContext(NotificationsContext); }
