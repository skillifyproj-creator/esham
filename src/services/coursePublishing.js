import { getCategory } from '../data/categories';
import { pointsPolicy } from '../data/pointsPolicy';
import { lessonIsReady, taskIsReady, localized } from '../data/courseReadiness';
import { instructorPublicCourseIds } from '../data/instructorCourseLinks';
const KEY = 'esham-course-submissions-v1';
export const COURSE_EVENT = 'esham-courses-updated';
export function readSubmissions() {
  try { const list = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(list) ? list.filter(item=>item?.id && item?.course && item?.ownerId) : []; }
  catch { return []; }
}
function write(list) {
  localStorage.setItem(KEY, JSON.stringify(list));
  if (typeof window?.dispatchEvent === 'function') window.dispatchEvent(new Event(COURSE_EVENT));
}
export function submitCourse(course, sections, owner) {
  const language = course.language || 'ar', tasks = sections.filter(section=>section.task);
  if (!owner?.id || !getCategory(course.categoryKey) || !course.image || !course.level || localized(course.title,language).trim().length < 2 || localized(course.description,language).trim().length < 20 || !course.objectives?.length || !sections.length || !sections.every(section=>localized(section.title,language) && section.lessons.length && section.lessons.every(lesson=>lessonIsReady(lesson,language))) || tasks.length < 1 || tasks.length > 3 || !tasks.every(section=>taskIsReady(section.task,language))) throw new Error('incomplete-course');
  const list = readSubmissions(), id = course.id && course.id !== 'new' ? String(course.id) : `local-${crypto.randomUUID()}`;
  const prior = list.find(item=>item.id===id);
  if (prior && prior.ownerId !== owner.id) throw new Error('owner');
  if (prior?.status === 'pending') throw new Error('pending');
  const record = { ...prior, id, publicId: instructorPublicCourseIds[id] || id, ownerId: owner.id, ownerName: owner.name, status: 'pending', submittedAt: new Date().toISOString(), course: { ...course, id, curriculum: sections }, reviewComment: '' };
  write([...list.filter(item=>item.id!==id),record]); return record;
}
export function updateSubmittedCourse(id, patch) {
  const list = readSubmissions();
  if (!list.some(item=>item.id===String(id))) return false;
  write(list.map(item=>item.id===String(id) ? {...item,course:{...item.course,...patch,id:item.id}} : item)); return true;
}
export function reviewSubmission(id, decision, comment, reviewer) {
  const list = readSubmissions(), record = list.find(item=>item.id===String(id));
  if (!record || record.status !== 'pending' || !reviewer?.categoryIds?.includes(record.course.categoryKey)) throw new Error('scope');
  if (!['approve','reject','request_changes'].includes(decision) || (decision !== 'approve' && !comment?.trim())) throw new Error('decision');
  const next = {...record,status:{approve:'approved',reject:'rejected',request_changes:'changes_requested'}[decision],reviewComment:comment?.trim()||'',reviewedAt:new Date().toISOString(),reviewerId:reviewer.id};
  if (decision === 'approve') next.publicCourse = structuredClone(record.course);
  write(list.map(item=>item.id===record.id ? next : item)); return next;
}
const bilingual = value => typeof value === 'string' ? { ar: value, en: value } : { ar: value?.ar || value?.en || '', en: value?.en || value?.ar || '' };
export function asInstructorCourse(record) {
  const c = record.course, status = { pending:'pending', approved:'published', rejected:'rejected', changes_requested:'rejected' }[record.status] || 'draft';
  return {...c,id:record.id,ownerId:record.ownerId,title:bilingual(c.title),description:bilingual(c.description),category:bilingual(getCategory(c.categoryKey)?.title || c.category),courseStatus:status,statusLabel:bilingual(status==='published'?'منشورة':status==='pending'?'بانتظار المراجعة':'تحتاج تعديلات'),reviewStatus:bilingual(record.reviewComment || 'بانتظار المراجعة'),reviewNote:bilingual(record.reviewComment),learners:0,rating:0,ratingCount:0,points:0,coursePoints:pointsPolicy.enrollmentCost,progress:100};
}
export function asPublicCourse(record) {
  if (!record.publicCourse) return null;
  const c = record.publicCourse;
  return { ...c,id:record.publicId || record.id,category:c.categoryKey,title:bilingual(c.title),description:bilingual(c.description),instructor:bilingual(record.ownerName),instructorId:record.ownerId,points:pointsPolicy.enrollmentCost,rating:0,reviews:0,tags:c.tags||[],createdAt:record.submittedAt,level:typeof c.level==='string'?c.level:'beginner',outcomes:{ ar:(c.objectives||[]).map(item=>bilingual(item).ar),en:(c.objectives||[]).map(item=>bilingual(item).en) },curriculum:c.curriculum.map(section=>({...section,title:bilingual(section.title),lessons:section.lessons.map(lesson=>({...lesson,title:bilingual(lesson.title),description:bilingual(lesson.description),preview:false}))})) };
}
export function asAdminCourse(record) {
  const c = record.course;
  return {id:record.id,title:bilingual(c.title).ar,instructor:record.ownerName,instructorId:record.ownerId,categoryId:c.categoryKey,status:record.status,points:pointsPolicy.enrollmentCost,submittedAt:record.submittedAt,createdAt:record.submittedAt,updatedAt:record.reviewedAt||record.submittedAt,reviewerId:record.reviewerId,reviewComment:record.reviewComment,reviewedAt:record.reviewedAt,description:bilingual(c.description).ar,objectives:(c.objectives||[]).map(item=>bilingual(item).ar),learningOutcomes:(c.objectives||[]).map(item=>bilingual(item).ar),estimatedDuration:`${c.curriculum.flatMap(s=>s.lessons).reduce((sum,l)=>sum+Number(l.minutes),0)} min`,curriculum:c.curriculum.map(section=>({...section,title:bilingual(section.title).ar,duration:`${section.lessons.reduce((sum,l)=>sum+Number(l.minutes),0)} min`,lessons:section.lessons.map(lesson=>({...lesson,title:bilingual(lesson.title).ar,type:lesson.contentType==='video'?'video':'reading',duration:`${lesson.minutes} min`,task:section.task ? bilingual(section.task.title).ar : null}))}))};
}
