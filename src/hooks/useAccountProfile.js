import { useEffect, useState } from 'react';
export function readAccountProfile() {
 for (const [storage, key] of [[localStorage, 'esham-account-profile-v1'], [sessionStorage, 'esham-onboarding-draft-v1']]) {
  try { const value = JSON.parse(storage.getItem(key) || 'null'); if (value && ['learner', 'instructor', 'both'].includes(value.role)) return value; } catch { /* Use the next available source. */ }
 }
 return { role: '', interests: [] };
}
export default function useAccountProfile() {
 const [profile, setProfile] = useState(readAccountProfile);
 useEffect(() => { const refresh = () => setProfile(readAccountProfile()); window.addEventListener('esham-profile-updated', refresh); window.addEventListener('storage', refresh); return () => { window.removeEventListener('esham-profile-updated', refresh); window.removeEventListener('storage', refresh); }; }, []);
 return profile;
}
