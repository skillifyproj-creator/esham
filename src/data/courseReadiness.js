export function localized(value, language) {
  return typeof value === 'string' ? value : value?.[language] || value?.ar || value?.en || '';
}
export function lessonIsReady(lesson, language) {
  const reading = ['article', 'reading'].includes(lesson.contentType);
  return lesson.status !== 'draft' && localized(lesson.title, language).trim().length >= 2
    && (reading ? localized(lesson.description, language).trim().length >= 20 : Boolean(lesson.video?.mediaId || /^https?:\/\//i.test(lesson.videoUrl || '')))
    && Array.isArray(lesson.objectives) && lesson.objectives.length > 0
    && Number(lesson.minutes) >= 1 && Number(lesson.minutes) <= 600;
}
export function taskIsReady(task, language) {
  return task?.status === 'ready' && localized(task.title, language).trim().length >= 2
    && localized(task.description, language).trim().length >= 20
    && localized(task.instructions, language).trim().length >= 20
    && Array.isArray(task.requirements) && task.requirements.length > 0;
}
