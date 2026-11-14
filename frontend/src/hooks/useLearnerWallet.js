import { useFinancial } from '../context/FinancialContext';
export function useLearnerWallet() {
  const state = useFinancial();
  return { ...state, balance: state.wallet?.balance ?? null, earned: state.wallet?.earned ?? null, spent: state.wallet?.spent ?? null,
    transactions: state.transactions.map(x => ({ ...x, points: x.amount, type: x.transactionType })) };
}
