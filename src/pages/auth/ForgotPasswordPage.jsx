import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { usePreferences } from '../../context/PreferencesContext';
import { recoveryCopy } from '../../i18n/recoveryCopy';
import RecoveryLayout from './RecoveryLayout';

export default function ForgotPasswordPage() {
  const { language } = usePreferences();
  const t = recoveryCopy[language];
  const [email, setEmail] = useState('');
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const input = useRef(null);
  function submit(event) {
    event.preventDefault();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    setError(!valid);
    setReady(valid);
    if (!valid) input.current?.focus();
    // Connect the recovery request endpoint here; no account-existence disclosure.
  }
  return <RecoveryLayout title={t.forgotTitle} intro={t.forgotIntro}>
    <form onSubmit={submit} noValidate>
      <div className="auth-field"><label htmlFor="recovery-email">{t.email}</label><div className={`auth-input-wrap${error ? ' has-error' : ''}`}><input ref={input} id="recovery-email" name="email" type="email" dir="ltr" autoComplete="email" placeholder="name@example.com" value={email} onChange={event => { setEmail(event.target.value); setError(false); setReady(false); }} required aria-invalid={error} aria-describedby={error ? 'recovery-email-error' : undefined} /></div>{error && <p className="auth-error" id="recovery-email-error">{t.emailError}</p>}</div>
      <button className="auth-submit" type="submit">{t.forgotSubmit}<span aria-hidden="true">{language === 'ar' ? '←' : '→'}</span></button>
      {ready && <div className="recovery-request-status"><p className="auth-status" role="status">{t.forgotReady}</p><Link className="recovery-preview-link" to="/reset-password">{t.preview}</Link></div>}
    </form>
  </RecoveryLayout>;
}
