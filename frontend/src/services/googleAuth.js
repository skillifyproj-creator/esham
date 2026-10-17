import { accountRequest, AccountApiError, acceptAccountSession, apiBase } from './accountApi';

export const googleAuthEnabled = Boolean(apiBase && import.meta.env.VITE_GOOGLE_AUTH_ENABLED === 'true');

export function googleSignInUrl(base = apiBase, origin = window.location.origin) {
  if (!base) throw new AccountApiError('unconfigured');
  const url = new URL(`${base}/auth/google/start`, origin);
  if (url.protocol !== 'https:' && !(url.protocol === 'http:' && ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname))) throw new AccountApiError('unconfigured');
  url.searchParams.set('returnTo', `${origin}/auth/google/complete`);
  return url.href;
}

// Identity comes from the server's HttpOnly session, never from URL/profile claims.
export function acceptGoogleSession(result) {
  if (result?.onboardingRequired === true) {
    const profile = result.profile;
    if (typeof profile?.id !== 'string' || !profile.id) throw new AccountApiError('response');
    const draft = { id: profile.id, name: typeof profile.name === 'string' ? profile.name.slice(0, 80) : '', username: '', bio: '', role: '', interests: [], teachingAreas: [], customSkills: [], goal: null };
    localStorage.removeItem('esham-account-profile-v1');
    sessionStorage.setItem('esham-onboarding-draft-v1', JSON.stringify(draft));
    window.dispatchEvent(new Event('esham-profile-updated'));
    return '/onboarding/role';
  }
  const profile = acceptAccountSession(result);
  return profile.role === 'instructor' ? '/instructor' : '/learner';
}

export async function restoreGoogleSession() {
  return acceptGoogleSession(await accountRequest('/auth/session', undefined, { method: 'GET' }));
}
