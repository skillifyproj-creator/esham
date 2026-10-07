import { Link } from 'react-router';
import { usePreferences } from '../../context/PreferencesContext';
import { courses } from '../../data/courses';
import { recommendCourses } from '../../data/courseRecommendations';
export default function CourseRecommendations({ course, review, enrollments }) {
  const {language}=usePreferences();const t=(a,e)=>language==='ar'?a:e;
  const recommendations=recommendCourses({catalog:courses,completedCourse:course,review,enrollments});
  const reasons={feedback:t('يتوافق مع كلمات في ملاحظاتك','Matches keywords in your feedback'),basics:t('يركّز على الأساسيات حسب ملاحظاتك','Focuses on basics based on your feedback'),alternative:t('خيار من مدرّب آخر في المجال نفسه','An alternative instructor in the same field'),category:t('في مجال الدورة التي أكملتها','In the same field as your completed course')};
  return <section className="learner-panel" style={{marginBlock:20}}>
    <h3>{t('خطوتك التالية بعد الدورة','Your next step after this course')}</h3>
    <p>{t('اقتراحات تجريبية بناءً على تقييمك وملاحظاتك. التخصيص بالـAI سيتاح بعد ربط الخدمة.','Preview suggestions based on your rating and feedback. AI personalization requires a connected service.')}</p>
    {recommendations.length ? <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:16}}>{recommendations.map(({course:next,reason})=><article key={next.id}><h4><Link to={`/courses/${next.id}`}>{next.title[language]}</Link></h4><p>{reasons[reason]}</p><Link className="button button-outline button-small" to={`/courses/${next.id}`}>{t('عرض الدورة','View course')}</Link></article>)}</div> : <p>{t('لا تتوفر حاليًا دورة مشابهة جديدة خارج دوراتك المسجّلة.','There are currently no new similar courses outside your enrollments.')}</p>}
    <Link to={`/courses?category=${course.category}`}>{t('استكشاف دورات المجال','Explore this field')}</Link>
  </section>;
}
