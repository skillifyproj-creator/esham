import { courseRequest } from './curriculumApi.js';
export function mapPublicCourse(x) {
  const title = { ar: x.titleAr || x.titleEn || '', en: x.titleEn || x.titleAr || '' };
  return { id: x.courseId, publishedVersionId: x.publishedVersionId, categoryId: x.categoryId, category: x.categoryId,
    categoryTitle: { ar: x.categoryNameAr, en: x.categoryNameEn }, title,
    description: { ar: x.descriptionAr || x.descriptionEn || '', en: x.descriptionEn || x.descriptionAr || '' },
    instructorId: x.instructor.id, instructor: { ar: x.instructor.name || x.instructor.nameEn || '', en: x.instructor.nameEn || x.instructor.name || '' },
    language: x.language, level: x.level, createdAt: x.createdAt, approvedAt: x.approvedAt,
    objectives: x.objectives || [], tags: [], image: null, icon: 'book', rating: null, lessons: null, points: null,
    status: 'published', source: 'backend', curriculum: [] };
}
export const loadPublicCatalog = signal => courseRequest('/courses/public', undefined, 'GET', signal).then(items => items.map(mapPublicCourse));
export const loadPublicCourse = (id, signal) => courseRequest(`/courses/public/${id}`, undefined, 'GET', signal).then(mapPublicCourse);
