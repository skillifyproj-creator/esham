import { loadEnrollments } from './enrollments.js';
import { isGuid } from './financialApi.js';

// Include the full trusted public projection: ranking, display, ownership and version changes.
// Canonical ordering avoids refetch loops for identical reconstructed response objects.
export function recommendationCatalogRevision(courses) {
  const canonical=value=>Array.isArray(value)?value.map(canonical):value&&typeof value==='object'
    ?Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])])):value;
  return JSON.stringify([...courses].sort((a,b)=>a.id.localeCompare(b.id)).map(canonical));
}

// Bounded discovery; incomplete exclusions must never produce platform suggestions.
export async function ownedRecommendationExclusions(accountId, current, load = loadEnrollments, authored = []) {
  if (!isGuid(current) || !Array.isArray(authored) || !authored.every(isGuid)) throw new Error('assistant-input');
  const selected = new Set([current.toLowerCase(), ...authored.map(id=>id.toLowerCase())]);
  if (selected.size > 200) throw new Error('assistant-exclusion-limit');
  for (let page = 1; page <= 10; page++) {
    const data = await load(accountId, page);
    for (const item of data.items) selected.add(item.courseId.toLowerCase());
    if (selected.size > 200) throw new Error('assistant-exclusion-limit');
    if (page * data.pageSize >= data.totalCount) return [...selected];
  }
  throw new Error('assistant-exclusion-limit');
}
