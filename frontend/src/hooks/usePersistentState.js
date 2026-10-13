import { useRef, useState } from 'react';
export default function usePersistentState(key, fallback) {
  const [state, setState] = useState(() => {
    try { const saved = JSON.parse(localStorage.getItem(key)); return saved && Array.isArray(saved) === Array.isArray(fallback) && typeof saved === typeof fallback ? saved : fallback; }
    catch { return fallback; }
  });
  const current = useRef(state);
  function update(value) {
    const next = typeof value === 'function' ? value(current.current) : value;
    try { localStorage.setItem(key, JSON.stringify(next)); current.current = next; setState(next); }
    catch { if (typeof window !== 'undefined') window.dispatchEvent(new Event('esham-storage-error')); }
  }
  return [state, update];
}
