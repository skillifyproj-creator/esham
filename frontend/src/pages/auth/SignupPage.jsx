import AuthAlert from '../../components/AuthAlert';
import GoogleSignIn from '../../components/GoogleSignIn';
import { useAccountSession } from '../../context/AccountSessionContext';
import { accountRequest, accountError } from '../../services/accountApi';
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import { usePreferences } from "../../context/PreferencesContext";
import { signupCopy } from "../../i18n/signupCopy";
import Icon from "../../components/Icon";
import logo from "../../assets/esham-logo.png";

import "../../styles/auth.css";

export default function SignupPage() {
  const navigate = useNavigate();
  const sessionState = useAccountSession();
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState('');
  const {
    language,
    theme,
    toggleLanguage,
    toggleTheme,
  } = usePreferences();

  const t = signupCopy[language];

  const [values, setValues] = useState({
    name: "",
    email: "",
    password: "",
    confirm: "",
  });

  const [errors, setErrors] = useState({});
  const [visible, setVisible] = useState({
    password: false,
    confirm: false,
  });

  const [ready, setReady] = useState(false);
  const inputs = useRef({});

  function change(event) {
    const { name, value } = event.target;

    setValues((current) => ({
      ...current,
      [name]: value,
    }));

    setErrors((current) => ({
      ...current,
      [name]: undefined,
    }));

    setReady(false);
  }

  async function submit(event) {
    event.preventDefault();

    const next = {};

    if (values.name.trim().length < 2) {
      next.name = "nameError";
    }

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      next.email = "emailError";
    }

    if (values.password.length < 8) {
      next.password = "passwordError";
    }

    if (!values.confirm || values.password !== values.confirm) {
      next.confirm = "confirmError";
    }

    setErrors(next);
    setReady(Object.keys(next).length === 0);

    const firstError = Object.keys(next)[0];
    inputs.current[firstError]?.focus();

    if (Object.keys(next).length === 0 && !busy) {
      setBusy(true); setRequestError('');
      let registered;
      try { registered = await accountRequest('/auth/register', { name: values.name.trim(), email: values.email.trim(), password: values.password }); if (!registered?.profile?.id) throw { code: 'response' }; await sessionState.refresh(); }
      catch (error) { setRequestError(accountError(error, language)); setBusy(false); return; }
      setBusy(false); navigate('/onboarding/role');
    }
    // Passwords are never persisted in browser storage.
  }

  return (
    <main
      className="auth-page"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <section
        className="auth-form-panel"
        aria-labelledby="signup-title"
      >
        <header className="auth-topbar">
          <Link to="/" aria-label={t.back}>
            <img
              src={logo}
              alt={language === "ar" ? "إسهام" : "Esham"}
            />
          </Link>

          <div className="auth-tools">
            <button
              type="button"
              onClick={toggleLanguage}
              aria-label={
                language === "ar"
                  ? "Switch to English"
                  : "التبديل للعربية"
              }
            >
              {language === "ar" ? "English" : "العربية"}
            </button>

            <button
              type="button"
              onClick={toggleTheme}
              aria-label={
                theme === "dark"
                  ? t.themeLight
                  : t.themeDark
              }
            >
              <Icon
                name={theme === "dark" ? "sun" : "moon"}
                size={20}
              />
            </button>
          </div>
        </header>

        <div className="auth-form-content">
          <h1 id="signup-title">{t.title}</h1>
          <p className="auth-intro">{t.intro}</p>

          <GoogleSignIn language={language} disabled={busy}/>
          <form onSubmit={submit} noValidate>
            {["name", "email", "password", "confirm"].map((name) => {
              const secret = name === "password" || name === "confirm";

              const error = errors[name];

              return (
                <div className="auth-field" key={name}>
                  <label htmlFor={`signup-${name}`}>{t[name]}</label>

                  <div
                    className={`auth-input-wrap${error ? " has-error" : ""}`}
                  >
                    <input
                      id={`signup-${name}`}
                      name={name}
                      value={values[name]}
                      onChange={change}
                      ref={(node) => {
                        inputs.current[name] = node;
                      }}
                      type={
                        secret
                          ? visible[name]
                            ? "text"
                            : "password"
                          : name === "email"
                            ? "email"
                            : "text"
                      }
                      autoComplete={
                        secret
                          ? "new-password"
                          : name === "name"
                            ? "name"
                            : "email"
                      }
                      dir={name === "email" ? "ltr" : undefined}
                      placeholder={
                        name === "name"
                          ? t.namePlaceholder
                          : name === "email"
                            ? t.emailPlaceholder
                            : undefined
                      }
                      required
                      minLength={secret ? 8 : undefined}
                      aria-invalid={Boolean(error)}
                      aria-describedby={
                        error
                          ? `signup-${name}-error`
                          : name === "password"
                            ? "signup-password-hint"
                            : undefined
                      }
                    />

                    {secret && (
                      <button
                        type="button"
                        className="auth-password-toggle"
                        aria-controls={`signup-${name}`}
                        aria-label={visible[name] ? t.hide : t.show}
                        aria-pressed={visible[name]}
                        onClick={() =>
                          setVisible((current) => ({
                            ...current,
                            [name]: !current[name],
                          }))
                        }
                      >
                        <Icon name={visible[name] ? "eye-off" : "eye"} size={20} />
                      </button>
                    )}
                  </div>

                  {name === "password" && !error && (
                    <small id="signup-password-hint">{t.passwordHint}</small>
                  )}

                  {error && (
                    <p className="auth-error" id={`signup-${name}-error`}>
                      {t[error]}
                    </p>
                  )}
                </div>
              );
            })}

            {requestError && <AuthAlert>{requestError}</AuthAlert>}
            <button className="auth-submit" type="submit" disabled={busy} aria-busy={busy}>
              {t.submit}
            </button>

            
            {ready && !requestError && (
              <p className="auth-status" role="status">
                {t.ready}
<br /><Link to="/onboarding/role">{language === "ar" ? "متابعة إعداد التجربة" : "Continue experience setup"}</Link>
              </p>
            )}
          </form>

          <div className="auth-form-footer">
            <p className="auth-existing">
              {t.existing}{" "}
              <Link to="/login">{t.login}</Link>
            </p>

            <Link className="auth-back" to="/">
              {t.back}
            </Link>
          </div>
        </div>
      </section>

      <aside
        className="auth-visual"
        aria-labelledby="auth-hero-title"
      >
        <img
          src="/images/auth-learning.jpg"
          alt=""
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />

        <div className="auth-visual-copy">
          <h2 id="auth-hero-title">{t.heroTitle}</h2>
          <p>{t.heroText}</p>
        </div>
      </aside>
    </main>
  );
}
