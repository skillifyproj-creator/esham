import { usePreferences } from '../context/PreferencesContext';
export default function CatalogStatus({ loading, error, empty, reload }) {
  const { language } = usePreferences(); const ar = language === 'ar';
  if (error) return <p role="alert">{ar ? 'تعذّر تحميل الكتالوج. حاول مجددًا.' : 'Unable to load the catalog. Please retry.'} {reload && <button type="button" className="text-button" onClick={() => reload()}>{ar ? 'إعادة المحاولة' : 'Retry'}</button>}</p>;
  if (loading) return <p role="status">{ar ? 'جارٍ تحميل الكتالوج…' : 'Loading catalog…'}</p>;
  return empty ? <p role="status">{ar ? 'لا توجد دورات منشورة حاليًا.' : 'No published courses are currently available.'}</p> : null;
}
