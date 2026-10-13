import { Link } from 'react-router';
import { usePreferences } from '../../context/PreferencesContext';
import { recoveryCopy } from '../../i18n/recoveryCopy';
import Icon from '../../components/Icon';
import logo from '../../assets/esham-logo.png';
import '../../styles/auth.css';
import '../../styles/auth-recovery.css';

export default function RecoveryLayout({ title, intro, children }) {
  const { language, theme, toggleLanguage, toggleTheme } = usePreferences();
  const t = recoveryCopy[language];
  const direction = language === 'ar' ? 'rtl' : 'ltr';
  return (
    <main className="auth-page auth-recovery" dir={direction}>
      <section className="auth-form-panel" aria-labelledby="recovery-title" dir={direction}>
        <header className="auth-topbar">
          <Link to="/" aria-label={t.home}><img src={logo} alt={language === 'ar' ? 'إسهام' : 'Esham'} /></Link>
          <div className="auth-tools">
            <button type="button" onClick={toggleLanguage} aria-label={language === 'ar' ? 'Switch to English' : 'التبديل للعربية'}>{language === 'ar' ? 'English' : 'العربية'}</button>
            <button type="button" onClick={toggleTheme} aria-label={theme === 'dark' ? t.light : t.dark}><Icon name={theme === 'dark' ? 'sun' : 'moon'} size={20} /></button>
          </div>
        </header>
        <div className="auth-form-content">
          <span className="recovery-eyebrow"><span aria-hidden="true" />{t.eyebrow}</span>
          <h1 id="recovery-title">{title}</h1>
          <p className="auth-intro">{intro}</p>
          {children}
          <p className="auth-existing">{t.remembered} <Link to="/login">{t.login}</Link></p>
          <Link className="auth-back" to="/">{t.home}</Link>
        </div>
        <p className="recovery-footer">© {new Date().getFullYear()} {language === 'ar' ? 'إسهام · تعلّم وشارك' : 'Esham · Learn & Share'}</p>
      </section>
      <aside className="auth-visual recovery-visual" dir={direction} aria-labelledby="recovery-hero-title">
        <img src="/images/auth-learning.jpg" alt="" />
        <div className="recovery-security-note">
          <span className="recovery-lock" aria-hidden="true"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="5" y="10" width="14" height="11" rx="3" /><path d="M8 10V7a4 4 0 0 1 8 0v3M12 14v3" /></svg></span>
          <div><strong>{t.secure}</strong><span>{t.secureText}</span></div>
        </div>
        <div className="auth-visual-copy"><span className="recovery-visual-kicker">{language === 'ar' ? 'تعلّم. شارك. اترك أثرًا.' : 'Learn. Share. Make a difference.'}</span><h2 id="recovery-hero-title">{t.heroTitle}</h2><p>{t.heroText}</p></div>
      </aside>
    </main>
  );
}
