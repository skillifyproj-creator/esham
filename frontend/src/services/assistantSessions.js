import { safeAssistantSource } from './learningAssistant.js';

export function sessionKey(identity) {
  return `esham-assistant-sessions-v1:${encodeURIComponent(identity || 'guest')}`;
}
export function cleanSessions(value) {
  if (!Array.isArray(value)) return [];
  return value.slice(0, 20).filter(s => s && typeof s.id === 'string' && Array.isArray(s.messages)).map(s => ({
    id: s.id.slice(0, 100),
    updated: Number.isFinite(s.updated) ? s.updated : 0,
    messages: s.messages.filter(m => m && ['user', 'assistant'].includes(m.role) && m.kind !== 'error' && typeof m.text === 'string').slice(-100).map(m => ({
      id: String(m.id || '').slice(0, 100), role: m.role, text: m.text.slice(0, 12000),
      kind: m.kind === 'attachment' ? 'attachment' : 'answer', time: String(m.time || '').slice(0, 40),
      sources: Array.isArray(m.sources) ? m.sources.filter(safeAssistantSource).slice(0, 12) : [],
    })),
  })).filter(s => s.messages.length);
}
export function loadSessions(storage, key) {
  try { return cleanSessions(JSON.parse(storage.getItem(key) || '[]')); } catch { return []; }
}
export function saveSessions(storage, key, sessions) {
  try { storage.setItem(key, JSON.stringify(cleanSessions(sessions))); return true; } catch { return false; }
}
