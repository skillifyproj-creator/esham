import { useEffect, useState } from 'react';
import useAccountProfile from './useAccountProfile';
import { getAccountWallet, initializeWallet, POINTS_EVENT } from '../data/pointsLedger';

export function useLearnerWallet() {
  const profile = useAccountProfile();
  const [, refresh] = useState(0);
  useEffect(() => {
    const update = () => refresh(value => value + 1);
    window.addEventListener(POINTS_EVENT, update);
    window.addEventListener('storage', update);
    try { initializeWallet(profile); } catch { update(); }
    return () => { window.removeEventListener(POINTS_EVENT, update); window.removeEventListener('storage', update); };
  }, [profile.id, profile.username]);
  try { return { ...getAccountWallet(profile), error: false }; }
  catch { return { balance: 0, earned: 0, spent: 0, transactions: [], enrollments: [], error: true }; }
}
