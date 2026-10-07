import { Link } from "react-router";
import { usePreferences } from "../context/PreferencesContext";
export default function Footer() {
  const { copy: c, language } = usePreferences();
  return (
    <footer className="footer">
      <Link to="/" className="footer-brand">
        {c.brand}
      </Link>
      <p>{c.footerText}</p>
      <nav aria-label={c.footerLinks}><Link to="/help/support">{language === "ar" ? "المساعدة" : "Help"}</Link><Link to="/help/privacy">{language === "ar" ? "الخصوصية" : "Privacy"}</Link><Link to="/help/terms">{language === "ar" ? "الشروط" : "Terms"}</Link>
        <Link to="/">{c.home}</Link>
        <Link to="/courses">{c.courses}</Link>
        <Link to="/#how">{c.how}</Link>
        <Link to="/#why">{c.why}</Link>
      </nav>
      <div className="footer-line" />
      <small>
        © {new Date().getFullYear()} {c.brand}. {c.rights}
      </small>
    </footer>
  );
}
