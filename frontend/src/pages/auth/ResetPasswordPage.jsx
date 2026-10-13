import { accountRequest, accountError, AccountApiError } from '../../services/accountApi';
import { useRef, useState } from 'react';
import { usePreferences } from '../../context/PreferencesContext';
import { recoveryCopy } from '../../i18n/recoveryCopy';
import Icon from '../../components/Icon';
import RecoveryLayout from './RecoveryLayout';
import { passwordRequirements, passwordStrength } from './passwordValidation';

export default function ResetPasswordPage() {
  const { language } = usePreferences();
  const t = recoveryCopy[language];
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState('');
  const [values, setValues] = useState({ password: '', confirm: '' });
  const [visible, setVisible] = useState({ password: false, confirm: false });
  const [errors, setErrors] = useState({});
  const [ready, setReady] = useState(false);
  const inputs = useRef({});
  const requirements = passwordRequirements(values.password);
  const strength = passwordStrength(values.password);
  function change(event) {
    const { name, value } = event.target;
    setValues(current => ({ ...current, [name]: value }));
    setErrors(current => ({ ...current, [name]: undefined, ...(name === 'password' ? { confirm: undefined } : {}) }));
    setReady(false);
  }
  async function submit(event) {
    event.preventDefault();
    const next = {};
    if (!Object.values(requirements).every(Boolean)) next.password = 'passwordError';
    if (!values.confirm) next.confirm = 'confirmRequired';
    else if (values.password !== values.confirm) next.confirm = 'confirmError';
    setErrors(next);
    setReady(false);
    inputs.current[Object.keys(next)[0]]?.focus();
    if (Object.keys(next).length || busy) return;
    setBusy(true); setRequestError('');
    try { const token = new URLSearchParams(window.location.search).get('token'); if (!token) throw new AccountApiError('token'); await accountRequest('/auth/reset-password', { token, password: values.password }); setValues({ password: '', confirm: '' }); setReady(true); }
    catch (error) { setRequestError(accountError(error, language)); } finally { setBusy(false); }
  }
  return <RecoveryLayout title={t.resetTitle} intro={t.resetIntro}>
    <form onSubmit={submit} noValidate>
      {['password', 'confirm'].map(name => <div className="auth-field" key={name}>
        <label htmlFor={`reset-${name}`}>{t[name]}</label>
        <div className={`auth-input-wrap${errors[name] ? ' has-error' : ''}`}>
          <input id={`reset-${name}`} name={name} value={values[name]} onChange={change} ref={node => { inputs.current[name] = node; }} type={visible[name] ? 'text' : 'password'} autoComplete="new-password" placeholder={t[`${name}Placeholder`]} required aria-invalid={Boolean(errors[name])} aria-describedby={[name === 'password' ? 'password-requirements' : '', errors[name] ? `reset-${name}-error` : ''].filter(Boolean).join(' ') || undefined} />
          <button type="button" className="auth-password-toggle" aria-label={visible[name] ? t.hide : t.show} aria-pressed={visible[name]} aria-controls={`reset-${name}`} onClick={() => setVisible(current => ({ ...current, [name]: !current[name] }))}><Icon name={visible[name] ? "eye-off" : "eye"} size={21} /></button>
        </div>
        {errors[name] && <p className="auth-error" id={`reset-${name}-error`}>{t[errors[name]]}</p>}
        {name === 'password' && <div className="recovery-password-guide" id="password-requirements">
          {values.password && <div className={`recovery-strength strength-${strength}`}><div className="recovery-strength-heading"><span>{t.strength}</span><strong>{t[['weak', 'medium', 'strong'][strength - 1]]}</strong></div><div className="recovery-strength-bars" aria-hidden="true">{[1, 2, 3].map(level => <span className={level <= strength ? 'filled' : ''} key={level} />)}</div></div>}
          <ul className="recovery-requirements">{Object.entries(requirements).map(([rule, valid]) => <li key={rule} className={valid ? 'met' : ''}><span aria-hidden="true">{valid ? '✓' : '○'}</span>{t[rule]}</li>)}</ul>
          <small>{t.optional}</small>
        </div>}
      </div>)}
      <button type="submit" className="auth-submit" disabled={busy} aria-busy={busy}>{t.resetSubmit}<span aria-hidden="true">{language === 'ar' ? '←' : '→'}</span></button>
      {requestError && <p className="auth-error" role="alert">{requestError}</p>}
      {ready && <p className="auth-status" role="status">{t.resetReady}</p>}
    </form>
  </RecoveryLayout>;
}
