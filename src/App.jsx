import HomePage from "./pages/HomePage";
import { PreferencesProvider } from "./context/PreferencesContext";
export default function App() {
  return (
    <PreferencesProvider>
      <HomePage />
    </PreferencesProvider>
  );
}
