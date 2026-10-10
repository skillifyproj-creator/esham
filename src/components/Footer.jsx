import { Link } from "react-router";
import { usePreferences } from "../context/PreferencesContext";
import "../styles/site-footer.css";
export default function Footer() {
  const { copy: c, language } = usePreferences();
  return (
    <footer className="esham-site-footer" dir={language === "ar" ? "rtl" : "ltr"}>
      <div className="esham-site-footer-inner">
      <Link to="/" className="esham-site-footer-brand">
        {c.brand}
      </Link>
      <p>{c.footerText}</p>
      <nav aria-label={c.footerLinks}>
        <Link to="/">{c.home}</Link>
        <Link to="/courses">{c.courses}</Link>
        <Link to="/#how">{c.how}</Link>
        <Link to="/#why">{c.why}</Link>
        <Link to="/help/guidelines">{language === "ar" ? "إرشادات التعليم" : "Teaching guidelines"}</Link>
        <Link to="/help/support">{language === "ar" ? "المساعدة" : "Help"}</Link>
        <Link to="/help/privacy">{language === "ar" ? "الخصوصية" : "Privacy"}</Link>
        <Link to="/help/terms">{language === "ar" ? "الشروط" : "Terms"}</Link>
      </nav>
      <small>
        © {new Date().getFullYear()} {c.brand}. {c.rights}
      </small>
      </div>
    </footer>
  );
}
