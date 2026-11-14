import { FinancialError, financialRequest } from './financialApi.js';
import { loadEnrollments, purchaseEnrollment } from './enrollments.js';
import { loadWallet, loadWalletHistory, loadTeachingTotals } from './wallet.js';

export const emptyFinancialState = () => ({ accountId: null, wallet: null, enrollments: [], enrollmentTotal: 0, enrollmentPage: 1,
  transactions: [], historyTotal: 0, historyPage: 1, teaching: [], loading: false, mutating: false, error: null });
export const visibleFinancialState = (state, id) => state.accountId === id ? state : emptyFinancialState();
export function createFinancialStore(request = financialRequest) {
  let state = emptyFinancialState(), roles = [], generation = 0, read = 0;
  const listeners = new Set(), emit = patch => { state = { ...state, ...patch }; listeners.forEach(f => f()); };
  async function refresh() {
    const id = state.accountId, gen = generation, sequence = ++read;
    if (!id || !roles.some(x => x === 'Learner' || x === 'Instructor')) return;
    emit({ loading: true, error: null });
    try {
      const [wallet, history, enrollments, teaching] = await Promise.all([
        loadWallet(id, request), loadWalletHistory(id, state.historyPage, request),
        roles.includes('Learner') ? loadEnrollments(id, state.enrollmentPage, request) : null,
        roles.includes('Instructor') ? loadTeachingTotals(id, request) : null,
      ]);
      if (gen !== generation || sequence !== read || state.accountId !== id) return;
      emit({ wallet, transactions: history.items, historyTotal: history.totalCount,
        enrollments: enrollments?.items || [], enrollmentTotal: enrollments?.totalCount || 0, teaching: teaching?.items || [], loading: false });
    } catch (error) {
      if (gen === generation && sequence === read) emit({ wallet: null, transactions: [], enrollments: [], teaching: [], enrollmentTotal: 0, historyTotal: 0, loading: false, error });
    }
  }
  return {
    subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); }, getSnapshot: () => state,
    setAccount(id, actualRoles = []) {
      if (id === state.accountId && JSON.stringify(roles) === JSON.stringify(actualRoles)) return;
      generation++; read++; roles = [...actualRoles]; state = { ...emptyFinancialState(), accountId: id }; listeners.forEach(f => f());
    }, refresh,
    setEnrollmentPage(page) { if (!state.mutating && Number.isInteger(page) && page > 0) { emit({ enrollmentPage: page }); return refresh(); } },
    setHistoryPage(page) { if (!state.mutating && Number.isInteger(page) && page > 0) { emit({ historyPage: page }); return refresh(); } },
    async purchase(id, intent) {
      if (id !== state.accountId || !roles.includes('Learner')) throw new FinancialError('account_changed', 409);
      if (state.mutating) throw new FinancialError('busy');
      const gen = generation; emit({ mutating: true });
      try {
        const result = await purchaseEnrollment(id, intent, request);
        if (gen !== generation || id !== state.accountId) throw new FinancialError('account_changed', 409);
        await refresh(); return result;
      } finally { if (gen === generation) emit({ mutating: false }); }
    },
  };
}
