const normalize = value => String(value || '').normalize('NFKC').toLocaleLowerCase().replace(/[ًٌٍَُِّْـ]/g,'');
// Local fallback only. An AI service must return catalog IDs, not invent courses.
export function recommendCourses({ catalog, completedCourse, review, enrollments = [], limit = 3 }) {
  if (!completedCourse || !review) return [];
  const enrolled = new Set(enrollments.map(item => String(item.courseId)));
  const feedback = normalize(review.text);
  const easier = /صعب|معقد|اساسيات|أساسيات|مبتدئ|difficult|hard|beginner|basic/.test(feedback);
  const advanced = /متقدم|تعمق|تعمّق|advanced|deeper/.test(feedback) && !easier;
  return catalog.filter(course => String(course.id) !== String(completedCourse.id) && !enrolled.has(String(course.id)) && course.category === completedCourse.category && !['archived','suspended','rejected','draft'].includes(course.status))
    .map(course => {
      const matches = (course.tags || []).filter(tag => { const word=normalize(tag);return word.length >= 3 && feedback.includes(word); }).length;
      const levelMatch = easier ? course.level === 'beginner' : advanced ? course.level === 'advanced' : course.level === completedCourse.level;
      const differentInstructor = review.rating <= 2 && JSON.stringify(course.instructor) !== JSON.stringify(completedCourse.instructor);
      return {course,score:matches*4 + (levelMatch ? 3 : 0) + (differentInstructor ? 2 : 0),reason:matches ? 'feedback' : levelMatch && easier ? 'basics' : differentInstructor ? 'alternative' : 'category'};
    }).sort((a,b)=>b.score-a.score || Number(b.course.rating)-Number(a.course.rating) || String(a.course.id).localeCompare(String(b.course.id))).slice(0,limit);
}
