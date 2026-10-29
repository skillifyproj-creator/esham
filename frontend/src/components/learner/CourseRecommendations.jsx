import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { usePreferences } from '../../context/PreferencesContext';
import useAccountProfile from '../../hooks/useAccountProfile';
import { courses } from '../../data/courses';
import { useCategoryCatalog } from '../../context/CategoryCatalogContext';
import { categoryLabel } from '../../services/categorySelections';
import { recommendCourses } from '../../data/courseRecommendations';
import { assistantBase, assistantRequest, publicCatalog } from '../../services/learningAssistant';
export default function CourseRecommendations({ course, review, enrollments = [] }) {
  const {language}=usePreferences();const profile=useAccountProfile();const t=(a,e)=>language==='ar'?a:e;
  const { categories } = useCategoryCatalog();
  const fallback=recommendCourses({catalog:courses,completedCourse:course,review,enrollments});
  const [remote,setRemote]=useState(null),[external,setExternal]=useState([]),[loading,setLoading]=useState(false);
  const interests=(profile.learningCategoryIds||[]).filter(id=>categories.some(item=>item.id===id)).map(id=>categoryLabel(categories,id,language));
  const query=[review?.text?.trim() || course.title?.[language] || '',course.category].join(' ');
  const exclude=[String(course.id),...enrollments.map(e=>String(e.courseId))];
  const signature=JSON.stringify({query,interests,exclude,language,level:course.level});
  useEffect(()=>{
    setRemote(null);setExternal([]);
    if(!assistantBase)return;
    const controller=new AbortController();setLoading(true);
    const shared={query,interests,language,level:course.level||''};
    Promise.allSettled([
      assistantRequest('/recommendations',{...shared,scope:'platform',catalog:publicCatalog(courses),exclude},{signal:controller.signal}),
      assistantRequest('/recommendations',{...shared,scope:'external',exclude:[]},{signal:controller.signal}),
    ]).then(([internal,outside])=>{
      if(controller.signal.aborted)return;
      if(internal.status==='fulfilled')setRemote(internal.value.items.map(item=>({course:courses.find(c=>String(c.id)===item.courseId&&!exclude.includes(String(c.id))),reason:'content'})).filter(x=>x.course));
      if(outside.status==='fulfilled')setExternal(outside.value.items);
    }).finally(()=>{if(!controller.signal.aborted)setLoading(false);});
    return()=>controller.abort();
  },[signature]);
  const recommendations=remote||fallback;
  const reasons={content:t('يتوافق محتواها مع اهتماماتك وملاحظاتك','Content matches your interests and feedback'),feedback:t('يتوافق مع كلمات في ملاحظاتك','Matches keywords in your feedback'),basics:t('يركّز على الأساسيات حسب ملاحظاتك','Focuses on basics based on your feedback'),alternative:t('خيار من مدرّب آخر في المجال نفسه','An alternative instructor in the same field'),category:t('في مجال الدورة التي أكملتها','In the same field as your completed course')};
  return <section className="learner-panel" style={{marginBlock:20}}>
    <h3>{t('خطوتك التالية بعد الدورة','Your next step after this course')}</h3>
    {loading&&<p role="status">{t('جارٍ تجهيز المقترحات…','Preparing recommendations…')}</p>}
    {!loading&&remote===null&&<p>{t('مقترحات من كتالوج إسهام حسب المجال والملاحظات.','Suggestions from the Esham catalog based on category and feedback.')}</p>}
    {recommendations.length ? <div style={{display:'grid',gridTemplateColumns:'repeat(auto-fit,minmax(200px,1fr))',gap:16}}>{recommendations.map(({course:next,reason})=><article key={next.id}><h4><Link to={`/courses/${next.id}`}>{next.title[language]}</Link></h4><p>{reasons[reason]}</p><Link className="button button-outline button-small" to={`/courses/${next.id}`}>{t('عرض الدورة','View course')}</Link></article>)}</div> : <p>{t('لا تتوفر حاليًا دورة مشابهة جديدة خارج دوراتك المسجّلة.','There are currently no new similar courses outside your enrollments.')}</p>}
    <Link to={`/courses?category=${course.category}`}>{t('استكشاف دورات المجال','Explore this field')}</Link>
    {external.length>0&&<><h3>{t('مراجع خارجية لمواصلة التعلّم','External resources to keep learning')}</h3><p>{t('هذه موارد Coursera خارج إسهام؛ تحقّق من تفاصيلها الحالية في المصدر، ولا تُسجّل بنقاط إسهام.','These Coursera resources are outside Esham. Check current details at the source; Esham points do not apply.')}</p><ul>{external.map(item=><li key={item.id}><a href={item.url} target="_blank" rel="noopener noreferrer">{item.title}</a></li>)}</ul></>}
  </section>;
}
