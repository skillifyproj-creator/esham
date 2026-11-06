import { apiBase } from './accountApi.js';
import { courseRequest } from './curriculumApi.js';
export function mapPublicCourse(x) {
  const title = { ar: x.titleAr || x.titleEn || '', en: x.titleEn || x.titleAr || '' };
  return { id: x.courseId, publishedVersionId: x.publishedVersionId, categoryId: x.categoryId, category: x.categoryId,
    categoryTitle: { ar: x.categoryNameAr, en: x.categoryNameEn }, title,
    description: { ar: x.descriptionAr || x.descriptionEn || '', en: x.descriptionEn || x.descriptionAr || '' },
    instructorId: x.instructor.id, instructor: { ar: x.instructor.name || x.instructor.nameEn || '', en: x.instructor.nameEn || x.instructor.name || '' },
    language: x.language, level: x.level, createdAt: x.createdAt, approvedAt: x.approvedAt,
    objectives: x.objectives || [], tags: [], image: x.coverMedia ? `${apiBase}/api/courses/public/${x.courseId}/cover?version=${x.publishedVersionId}` : null, icon: 'book', rating: x.averageRating ?? null, ratingCount: x.ratingCount || 0, lessons: x.sections?.reduce((sum, section) => sum + section.lessons.length, 0) ?? null, taskCount: x.taskCount || 0, points: null,
    status: 'published', source: 'backend', curriculum: (x.sections || []).map(section => ({ id: section.id, title: { ar: section.titleAr || section.titleEn || '', en: section.titleEn || section.titleAr || '' }, lessons: section.lessons.map(lesson => ({ id: lesson.id, title: { ar: lesson.titleAr || lesson.titleEn || '', en: lesson.titleEn || lesson.titleAr || '' }, contentType: lesson.contentType, durationSeconds: lesson.durationSeconds })) })) };
}
export const loadPublicCatalog = signal => courseRequest('/courses/public', undefined, 'GET', signal).then(items => items.map(mapPublicCourse));
export const loadPublicCourse = (id, signal) => courseRequest(`/courses/public/${id}`, undefined, 'GET', signal).then(mapPublicCourse);
