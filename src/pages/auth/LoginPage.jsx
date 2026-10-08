import { accountRequest, accountError, acceptAccountSession } from '../../services/accountApi';
import useAccountProfile from '../../hooks/useAccountProfile';
import { useRef, useState } from "react";
import { Link, useNavigate } from "react-router";

import { usePreferences } from "../../context/PreferencesContext";
import { loginCopy } from "../../i18n/loginCopy";
import Icon from "../../components/Icon";
import logo from "../../assets/esham-logo.png";

import "../../styles/auth.css";
import "../../styles/auth-recovery.css";

export default function LoginPage() {
  const {
    language,
    theme,
    toggleLanguage,
    toggleTheme,
  } = usePreferences();

  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [requestError, setRequestError] = useState('');
  const t = loginCopy[language];
  const profile = useAccountProfile();

  const [values, setValues] = useState({
    email: "",
    password: "",
  });

  const [errors, setErrors] = useState({});
  const [visible, setVisible] = useState(false);
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

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      next.email = "emailError";
    }

    if (!values.password) {
      next.password = "passwordError";
    }

    setErrors(next);
    setReady(false);

    const firstError = Object.keys(next)[0];
    inputs.current[firstError]?.focus();

    if (firstError || busy) return;
    setBusy(true); setRequestError('');
    try { const account = acceptAccountSession(await accountRequest('/auth/login', { email: values.email.trim(), password: values.password })); setValues({ email: '', password: '' }); navigate(account.role === 'instructor' ? '/instructor' : '/learner'); }
    catch (error) { setRequestError(accountError(error, language)); } finally { setBusy(false); }
  }

  return (
    <main
      className="auth-page"
      dir={language === "ar" ? "rtl" : "ltr"}
    >
      <section
        className="auth-form-panel"
        aria-labelledby="login-title"
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
          <h1 id="login-title">{t.title}</h1>
          <p className="auth-intro">{t.intro}</p>

          <form onSubmit={submit} noValidate>
            {["email", "password"].map((name) => {
              const secret = name === "password";
              const error = errors[name];

              return (
                <div className="auth-field" key={name}>
                  <label htmlFor={`login-${name}`}>{t[name]}</label>

                  <div
                    className={`auth-input-wrap${error ? " has-error" : ""}`}
                  >
                    <input
                      id={`login-${name}`}
                      name={name}
                      value={values[name]}
                      onChange={change}
                      ref={(node) => {
                        inputs.current[name] = node;
                      }}
                      type={
                        secret
                          ? visible
                            ? "text"
                            : "password"
                          : "email"
                      }
                      autoComplete={
                        secret ? "current-password" : "username"
                      }
                      dir={secret ? undefined : "ltr"}
                      placeholder={
                        secret ? undefined : "name@example.com"
                      }
                      required
                      aria-invalid={Boolean(error)}
                      aria-describedby={
                        error ? `login-${name}-error` : undefined
                      }
                    />

                    {secret && (
                      <button
                        type="button"
                        className="auth-password-toggle"
                        aria-controls="login-password"
                        aria-label={visible ? t.hide : t.show}
                        aria-pressed={visible}
                        onClick={() => setVisible((current) => !current)}
                      >
                        <Icon name={visible ? "eye-off" : "eye"} size={20} />
                      </button>
                    )}
                  </div>

                  {error && (
                    <p className="auth-error" id={`login-${name}-error`}>
                      {t[error]}
                    </p>
                  )}
                </div>
              );
            })}

            <Link className="auth-forgot" to="/forgot-password">{t.forgot}</Link>

            <button className="auth-submit" type="submit" disabled={busy} aria-busy={busy}>
              {busy ? (language === 'ar' ? 'جاري تسجيل الدخول…' : 'Signing in…') : t.submit}
            </button>
            {requestError && <p className="auth-error" role="alert">{requestError}</p>}

            {ready && (
              <p className="auth-status" role="status">
                {t.ready}
              </p>
            )}
          </form>

          <p className="auth-existing"><Link to={profile.role === "instructor" ? "/instructor" : "/learner"}>{language === "ar" ? "معاينة المنصة بحساب تجريبي" : "Preview with a demo account"}</Link></p>
          <p className="auth-existing">
            {t.noAccount}{" "}
            <Link to="/signup">{t.signup}</Link>
          </p>

          <Link className="auth-back" to="/">
            {t.back}
          </Link>
        </div>
      </section>

      <aside
        className="auth-visual"
        aria-labelledby="login-hero-title"
      >
        <img
          src="/images/auth-learning.jpg"
          alt=""
          onError={(event) => {
            event.currentTarget.hidden = true;
          }}
        />

        <div className="auth-visual-copy">
          <h2 id="login-hero-title">{t.heroTitle}</h2>
          <p>{t.heroText}</p>
        </div>
      </aside>
    </main>
  );
}
