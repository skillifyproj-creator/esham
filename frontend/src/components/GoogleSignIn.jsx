import { useState } from 'react';
import AuthAlert from './AuthAlert';
import { googleAuthEnabled, googleSignInUrl } from '../services/googleAuth';
import { accountError } from '../services/accountApi';

export default function GoogleSignIn({ language, disabled }) {
  const [error, setError] = useState('');
  const ar = language === 'ar';
  return <div className="auth-google">
    <button className="auth-google-button" type="button" disabled={disabled || !googleAuthEnabled} aria-describedby={!googleAuthEnabled ? 'google-auth-note' : undefined} onClick={() => {
      try { window.location.assign(googleSignInUrl()); } catch (cause) { setError(accountError(cause, language)); }
    }}><svg aria-hidden="true" width="20" height="20" viewBox="0 0 24 24"><path fill="#4285F4" d="M21.6 12.23c0-.71-.06-1.39-.18-2.05H12v3.88h5.38a4.6 4.6 0 0 1-2 3.01v2.5h3.24c1.9-1.75 2.98-4.32 2.98-7.34Z"/><path fill="#34A853" d="M12 22c2.7 0 4.96-.9 6.62-2.43l-3.24-2.5c-.9.6-2.05.96-3.38.96-2.6 0-4.81-1.76-5.6-4.12H3.06v2.58A10 10 0 0 0 12 22Z"/><path fill="#FBBC05" d="M6.4 13.91a6 6 0 0 1 0-3.82V7.51H3.06a10 10 0 0 0 0 8.98l3.34-2.58Z"/><path fill="#EA4335" d="M12 5.97c1.47 0 2.79.5 3.82 1.5l2.86-2.87A9.6 9.6 0 0 0 12 2a10 10 0 0 0-8.94 5.51l3.34 2.58C7.19 7.73 9.4 5.97 12 5.97Z"/></svg>{ar ? 'المتابعة باستخدام Google' : 'Continue with Google'}</button>
    {!googleAuthEnabled && <small id="google-auth-note">{ar ? 'الدخول باستخدام Google غير متاح حاليًا. يمكنك المتابعة بالبريد الإلكتروني.' : 'Google sign-in is currently unavailable. Continue with email.'}</small>}
    {error && <AuthAlert>{error}</AuthAlert>}
    <p className="auth-divider">{ar ? 'أو باستخدام البريد الإلكتروني' : 'Or continue with email'}</p>
  </div>;
}
