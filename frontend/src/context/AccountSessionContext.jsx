import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { apiBase } from '../services/accountApi';
import { loadServerSession, reconcileCategoryProfile } from '../services/categorySelections';

export const AccountSessionContext = createContext({ status: 'unconfigured', session: null, refresh: async () => null });
const Context = AccountSessionContext;
export const useAccountSession = () => useContext(Context);

export function onboardingDraft(session, previous = {}) {
  const profile = session.profile;
  const sameAccount = previous.id === profile.id;
  // Retain unfinished form fields only for this account. Stored category GUIDs
  // are an unsaved draft, revalidated against the catalog and server on submit.
  const draft = { ...(sameAccount ? previous : {}), ...profile };
  const pendingPersona = sameAccount && ['learner', 'instructor', 'both'].includes(previous.pendingPersona);
  if ((session.onboardingRequired || pendingPersona) && sameAccount) {
    for (const field of ['role', 'name', 'nameEn', 'username', 'bio', 'avatar', 'customSkills', 'goal', 'learningCategoryIds', 'teachingCategoryIds'])
      if (previous[field] !== undefined) draft[field] = previous[field];
  }
  if (pendingPersona) draft.role = previous.pendingPersona;
  const result = reconcileCategoryProfile({ role: '', name: '', username: '', bio: '', customSkills: [], goal: null, ...draft });
  for (const field of ['role', 'name', 'username', 'bio']) if (typeof result[field] !== 'string') result[field] = '';
  if (!Array.isArray(result.customSkills)) result.customSkills = [];
  if (!Number.isInteger(result.goal) || result.goal < 0 || result.goal > 3) result.goal = null;
  return result;
}

export function AccountSessionProvider({ children }) {
  const [state, setState] = useState({ status: apiBase ? 'loading' : 'unconfigured', session: null, error: null });
  const generation = useRef(0);
  const invalidate = useCallback(() => { generation.current++; setState({ status: 'anonymous', session: null, error: null }); }, []);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    try {
      const session = await loadServerSession();
      if (current !== generation.current) return session;
      let previous = {};
      try { previous = JSON.parse(sessionStorage.getItem('esham-onboarding-draft-v1') || '{}'); } catch { /* No cached draft. */ }
      try {
        localStorage.setItem('esham-account-profile-v1', JSON.stringify(session.profile));
        if (session.onboardingRequired) sessionStorage.setItem('esham-onboarding-draft-v1', JSON.stringify(onboardingDraft(session, previous)));
      } catch { /* Persistence does not depend on browser storage. */ }
      setState({ status: 'authenticated', session, error: null });
      window.dispatchEvent(new Event('esham-profile-updated'));
      return session;
    } catch (error) {
      if (current === generation.current) {
        setState(previous => error.status === 401
          ? { status: 'anonymous', session: null, error }
          : previous.session ? { ...previous, error } : { status: 'error', session: null, error });
        // Cached values never authorize edits; keep unrelated cached fields available
        // for explicit reconciliation rather than deleting the user's profile data.
      }
      throw error;
    }
  }, []);
  useEffect(() => {
    if (!apiBase) return;
    refresh().catch(() => {});
    const focus = () => refresh().catch(() => {});
    window.addEventListener('focus', focus);
    return () => { generation.current++; window.removeEventListener('focus', focus); };
  }, [refresh]);
  return <Context.Provider value={{ ...state, refresh, invalidate }}>{children}</Context.Provider>;
}
