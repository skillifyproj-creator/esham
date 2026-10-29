import { Navigate } from 'react-router';
import useAccountProfile from '../../hooks/useAccountProfile';
import { useAccountSession } from '../../context/AccountSessionContext';
import { usePreferences } from '../../context/PreferencesContext';
import { apiBase, accountError } from '../../services/accountApi';
// Restore the server session before workspace routing; APIs still enforce authorization.
export default function RoleArea({ role, children }) {
 const profile = useAccountProfile();
 const session = useAccountSession();
 const { language } = usePreferences();
 if (apiBase) {
  if (session.status === 'anonymous') return <Navigate to="/login" replace />;
  if (session.status === 'authenticated' && session.session.onboardingRequired) return <Navigate to="/onboarding/role" replace />;
  if (session.status !== 'authenticated') return <main className="container section"><p role="status">{session.error ? accountError(session.error, language) : language === 'ar' ? 'جارٍ تحميل الحساب…' : 'Loading account…'}</p>{session.error && <button type="button" onClick={() => session.refresh().catch(() => {})}>{language === 'ar' ? 'إعادة المحاولة' : 'Retry'}</button>}</main>;
 }
 if (profile.role && profile.role !== 'both' && profile.role !== role) return <Navigate to={profile.role === 'instructor' ? '/instructor' : '/learner'} replace />;
 return children;
}
