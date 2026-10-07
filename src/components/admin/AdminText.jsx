import { usePreferences } from '../../context/PreferencesContext';
import { translateAdminText } from '../../i18n/adminCopy';

export default function AdminText({ text, children }) {
  const { language } = usePreferences();
  return translateAdminText(text ?? children, language);
}
