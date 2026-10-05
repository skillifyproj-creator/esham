import useAccountProfile from '../../hooks/useAccountProfile';
import { useRef, useState } from "react";
import { Link } from "react-router";

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

  function submit(event) {
    event.preventDefault();

    const next = {};

    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(values.email.trim())) {
      next.email = "emailError";
    }

    if (!values.password) {
      next.password = "passwordError";
    }

    setErrors(next);
    setReady(Object.keys(next).length === 0);

    const firstError = Object.keys(next)[0];
    inputs.current[firstError]?.focus();

    // ربط API تسجيل الدخول يتم هنا لاحقًا.
    // لا نحفظ كلمة المرور في localStorage.
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

            <button className="auth-submit" type="submit">
              {t.submit}
            </button>

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
