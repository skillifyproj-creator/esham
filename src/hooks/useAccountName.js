import { useEffect, useState } from 'react';
export default function useAccountName() {
  const read = () => { try { const value = JSON.parse(localStorage.getItem('esham-account-profile-v1') || sessionStorage.getItem('esham-onboarding-draft-v1') || '{}'); return typeof value.name === 'string' ? value.name : ''; } catch { return ''; } };
  const [name, setName] = useState(read);
  useEffect(() => { const refresh = () => setName(read()); window.addEventListener('esham-profile-updated', refresh); window.addEventListener('storage', refresh); return () => { window.removeEventListener('esham-profile-updated', refresh); window.removeEventListener('storage', refresh); }; }, []);
  return name;
}
