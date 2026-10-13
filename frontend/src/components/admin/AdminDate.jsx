import { usePreferences } from '../../context/PreferencesContext';

export default function AdminDate({ value, format = 'date' }) {
  const { language } = usePreferences();
  if (!value) return '—';

  const options =
    format === 'datetime'
      ? { dateStyle: 'medium', timeStyle: 'short' }
      : { year: 'numeric', month: 'short', day: 'numeric' };

  return new Intl.DateTimeFormat(language, options).format(new Date(value));
}
