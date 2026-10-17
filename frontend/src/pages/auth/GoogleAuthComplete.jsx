import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router';
import { restoreGoogleSession } from '../../services/googleAuth';
import { accountError } from '../../services/accountApi';
import { usePreferences } from '../../context/PreferencesContext';
import '../../styles/auth.css';

export default function GoogleAuthComplete() {
  const { language } = usePreferences();
  const navigate = useNavigate();
  const [error, setError] = useState('');
  useEffect(() => {
    let cancelled = false;
    // The backend redirects with an error marker after denial; never display raw URL text.
    if (new URLSearchParams(window.location.search).has('error')) {
      setError(language === 'ar' ? 'لم يكتمل الدخول باستخدام Google. حاول مجددًا أو استخدم بريدك الإلكتروني.' : 'Google sign-in did not complete. Retry or use your email.');
      return;
    }
    restoreGoogleSession().then(path => { if (!cancelled) navigate(path, { replace: true }); }).catch(cause => { if (!cancelled) setError(accountError(cause, language)); });
    return () => { cancelled = true; };
  }, [language, navigate]);
  return <main className="container section" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <h1>{language === 'ar' ? 'الدخول باستخدام Google' : 'Sign in with Google'}</h1>
    {error ? <><p role="alert">{error}</p><Link className="button" to="/login">{language === 'ar' ? 'العودة لتسجيل الدخول' : 'Back to sign in'}</Link></> : <p role="status">{language === 'ar' ? 'جاري التحقق من حسابك…' : 'Verifying your account…'}</p>}
  </main>;
}
