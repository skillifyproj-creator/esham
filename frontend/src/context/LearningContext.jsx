import { createContext, useContext, useEffect, useState } from 'react';
import { useAccountSession } from './AccountSessionContext';
import { useFinancial } from './FinancialContext';
import { loadLearning } from '../services/learningApi';
const LearningContext = createContext({ summaries: {}, errors: {}, refresh: () => {} });
export const useLearning = () => useContext(LearningContext);
export function LearningProvider({ children }) {
  const session = useAccountSession(), financial = useFinancial();
  const id = session.status === 'authenticated' ? session.session.profile.id : null;
  const key = financial.enrollments.map(e => e.id).join(','), [revision, refresh] = useState(0), [state, setState] = useState(null);
  useEffect(() => {
    const controller = new AbortController(); let active = true;
    setState(null);
    const run = async () => {
      const summaries = {}, errors = {}; const ids = key.split(',').filter(Boolean);
      // Bounded concurrency; summaries cover the server-paginated enrollment page.
      for (let offset = 0; offset < ids.length; offset += 4) await Promise.all(ids.slice(offset, offset + 4).map(async e => {
        try { summaries[e] = await loadLearning(id, e, controller.signal); } catch (error) { errors[e] = error; }
      }));
      if (active) setState({ id, summaries, errors });
    };
    if (id) run();
    return () => { active = false; controller.abort(); };
  }, [id, key, revision]);
  useEffect(() => {
    const update = () => refresh(x => x + 1);
    window.addEventListener('esham-learning-updated', update); window.addEventListener('focus', update);
    return () => { window.removeEventListener('esham-learning-updated', update); window.removeEventListener('focus', update); };
  }, []);
  // Passive summary failures only hide their learning data. AccountSessionProvider
  // owns session refresh: a request during the logout/login gap must not redirect
  // a newly signed-in user to Login. Focus already refreshes that provider.
  return <LearningContext.Provider value={{ summaries: state?.id === id ? state.summaries : {}, errors: state?.id === id ? state.errors : {}, refresh: () => refresh(x => x + 1) }}>{children}</LearningContext.Provider>;
}
