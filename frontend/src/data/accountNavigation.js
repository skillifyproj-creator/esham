const keyFor = profile => `esham-active-workspace:${profile.id || profile.username || 'demo'}`;

export function accountWorkspace(profile) {
  if (profile?.role === 'learner' || profile?.role === 'instructor') return profile.role;
  if (profile?.role !== 'both') return null;
  try {
    const saved = sessionStorage.getItem(keyFor(profile));
    if (saved === 'learner' || saved === 'instructor') return saved;
  } catch { /* Browsing still works without session storage. */ }
  return 'learner';
}

export function rememberAccountWorkspace(profile, role) {
  if (!profile?.role || !['learner', 'instructor'].includes(role) || (profile.role !== 'both' && profile.role !== role)) return;
  try { sessionStorage.setItem(keyFor(profile), role); } catch { /* Keep the active interface usable. */ }
}
