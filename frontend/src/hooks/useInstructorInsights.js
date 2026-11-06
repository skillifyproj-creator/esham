import { useEffect, useState } from 'react';
import { useAccountSession } from '../context/AccountSessionContext';
import { loadInstructorInsights } from '../services/instructorInsights.js';
export default function useInstructorInsights(path, values = {}) {
  const account = useAccountSession();
  const identity = account.status === 'authenticated' ? account.session?.profile?.id : '';
  const query = JSON.stringify(values);
  const key = `${identity}:${path}:${query}`;
  const [state, setState] = useState({ data: null, loading: true, error: '' });
  useEffect(() => {
    if (!identity || !path) return;
    const controller = new AbortController();
    setState({ key, data: null, loading: true, error: '' });
    loadInstructorInsights(path, JSON.parse(query), controller.signal).then(data => {
      if (!controller.signal.aborted) setState({ key, data, loading: false, error: '' });
    }).catch(error => { if (!controller.signal.aborted) setState({ key, data: null, loading: false, error: error.message }); });
    return () => controller.abort();
  }, [path, query, identity, key]);
  return state.key === key ? state : { data: null, loading: Boolean(identity && path) || account.status === 'loading', error: '' };
}
