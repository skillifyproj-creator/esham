import { interestAreas } from './interestAreas';
const titles = {
  programming: { ar: 'البرمجة', en: 'Programming' },
  design: { ar: 'التصميم', en: 'Design' },
  photography: { ar: 'التصوير', en: 'Photography' },
  marketing: { ar: 'التسويق', en: 'Marketing' },
  crafts: { ar: 'الحِرف والفنون', en: 'Crafts and arts' },
  business: { ar: 'الأعمال وتطوير الذات', en: 'Business and personal development' },
};
// Keep this order stable: existing profile selections store these six indices.
export const categories = interestAreas.map(area => ({ ...area, id: area.category, title: titles[area.category] }));
export const subcategories = [
  { id: 'data', parentId: 'programming', title: { ar: 'علوم البيانات', en: 'Data science' } },
];
const aliases = {
  'graphic-design': 'design', 'user-interface': 'design', 'ui-design': 'design',
  'digital-marketing': 'marketing', 'video-editing': 'photography', 'digital-content': 'marketing', data: 'programming',
  'التصميم الجرافيكي': 'design', 'تصميم واجهات المستخدم': 'design', 'التسويق الرقمي': 'marketing',
  'تحرير الفيديو': 'photography', 'صناعة المحتوى الرقمي': 'marketing', 'التصوير وصناعة الصور': 'photography',
};
export function getCategory(id) { return categories.find(category => category.id === id) || subcategories.find(category => category.id === id); }
export function resolveCategoryId(value) {
  if (value && typeof value === 'object') return resolveCategoryId(value.ar) || resolveCategoryId(value.en);
  if (typeof value !== 'string') return '';
  if (aliases[value]) return aliases[value];
  const category = categories.find(item => item.id === value || item.title.ar === value || item.title.en.toLowerCase() === value.toLowerCase());
  if (category) return category.id;
  const text = value.toLowerCase();
  if (/تصوير|فوتوغرافي|photograph|video edit/.test(text)) return 'photography';
  if (/تصميم|design|interface/.test(text)) return 'design';
  if (/تسويق|محتوى|marketing|content/.test(text)) return 'marketing';
  return '';
}
export function categoryLabel(id, language) { return getCategory(id)?.title?.[language] || id; }
