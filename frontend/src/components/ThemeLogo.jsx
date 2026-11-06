import { useLocation } from 'react-router';
import { usePreferences } from '../context/PreferencesContext';
import logo from '../assets/esham-logo.png';
import logo2 from '../assets/logo2.png';

// Chatbot routes retain their existing surrounding navigation and logo treatment.
export default function ThemeLogo(props) {
  const { theme } = usePreferences();
  const { pathname } = useLocation();
  const excluded = pathname.replace(/\/+$/, '').endsWith('/assistant');
  return <img {...props} src={!excluded && theme === 'dark' ? logo2 : logo}
    {...(!excluded ? { 'data-esham-logo': theme } : {})}/>;
}
