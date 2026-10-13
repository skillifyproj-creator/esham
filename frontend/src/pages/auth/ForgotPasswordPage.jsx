import { accountRequest, accountError, AccountApiError } from '../../services/accountApi';
import { useRef, useState } from 'react';
import { Link } from 'react-router';
import { usePreferences } from '../../context/PreferencesContext';
import { recoveryCopy } from '../../i18n/recoveryCopy';
import RecoveryLayout from './RecoveryLayout';

export default function ForgotPasswordPage() {
  const { language } = usePreferences();
  const t = recoveryCopy[language];
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [email, setEmail] = useState('');
  const [error, setError] = useState(false);
  const [ready, setReady] = useState(false);
  const input = useRef(null);
  async function submit(event) {
    event.preventDefault();
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    setError(!valid);
    setReady(false);
    if (!valid) input.current?.focus();
    if (!valid || busy) return;
    setBusy(true); setRequestError('');
    try { await accountRequest('/auth/forgot-password', { email: email.trim() }); setReady(true); }
    catch (error) { setRequestError(accountError(error, language)); } finally { setBusy(false); }
  }
  return <RecoveryLayout title={t.forgotTitle} intro={t.forgotIntro}>
    <form onSubmit={submit} noValidate>
      <div className="auth-field"><label htmlFor="recovery-email">{t.email}</label><div className={`auth-input-wrap${error ? ' has-error' : ''}`}><input ref={input} id="recovery-email" name="email" type="email" dir="ltr" autoComplete="email" placeholder="name@example.com" value={email} onChange={event => { setEmail(event.target.value); setError(false); setReady(false); }} required aria-invalid={error} aria-describedby={error ? 'recovery-email-error' : undefined} /></div>{error && <p className="auth-error" id="recovery-email-error">{t.emailError}</p>}</div>
      <button className="auth-submit" type="submit" disabled={busy} aria-busy={busy}>{t.forgotSubmit}<span aria-hidden="true">{language === 'ar' ? '←' : '→'}</span></button>
      {requestError && <p className="auth-error" role="alert">{requestError}</p>}
      {ready && <div className="recovery-request-status"><p className="auth-status" role="status">{t.forgotReady}</p></div>}
    </form>
  </RecoveryLayout>;
}
