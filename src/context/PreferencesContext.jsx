import { createContext, useContext, useEffect, useState } from "react";
import { translations } from "../i18n/translations";
const PreferencesContext = createContext(null);
function stored(key, allowed, fallback) {
  try {
    const value = localStorage.getItem(key);
    return allowed.includes(value) ? value : fallback;
  } catch {
    return fallback;
  }
}
export function PreferencesProvider({ children }) {
  const [language, setLanguage] = useState(() =>
    stored("esham-language", ["ar", "en"], "ar"),
  );
  const [theme, setTheme] = useState(() =>
    stored("esham-theme", ["light", "dark"], "light"),
  );
  useEffect(() => {
    document.documentElement.lang = language;
    document.documentElement.dir = language === "ar" ? "rtl" : "ltr";
    document.documentElement.dataset.theme = theme;
    document.title =
      language === "ar" ? "إسهام | تعلّم وشارك" : "Esham | Learn & Share";
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute("content", theme === "dark" ? "#211a1d" : "#faf9f7");
    try {
      localStorage.setItem("esham-language", language);
      localStorage.setItem("esham-theme", theme);
    } catch {
      /* Works without storage as well. */
    }
  }, [language, theme]);
  return (
    <PreferencesContext.Provider
      value={{
        language,
        theme,
        copy: translations[language],
        toggleLanguage: () =>
          setLanguage((value) => (value === "ar" ? "en" : "ar")),
        toggleTheme: () =>
          setTheme((value) => (value === "light" ? "dark" : "light")),
      }}
    >
      {children}
    </PreferencesContext.Provider>
  );
}
export function usePreferences() {
  return useContext(PreferencesContext);
}
