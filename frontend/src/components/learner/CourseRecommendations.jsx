import { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router';
import { usePreferences } from '../../context/PreferencesContext';
import { useAccountSession } from '../../context/AccountSessionContext';
import { assistantScope } from '../../services/assistantScope';
import { ownedRecommendationExclusions, recommendationCatalogRevision } from '../../services/recommendationSelections';
import { usePublicCatalog } from '../../context/PublicCatalogContext';
import { useCategoryCatalog } from '../../context/CategoryCatalogContext';
import { categoryLabel } from '../../services/categorySelections';
import { recommendCourses } from '../../data/courseRecommendations';
import { assistantBase, assistantRequest, publicCatalog } from '../../services/learningAssistant';
export default function CourseRecommendations({ course, review, enrollments = [] }) {
  const {language}=usePreferences();const account=useAccountSession(), profile=account.session?.profile || {};const t=(a,e)=>language==='ar'?a:e;
  const { categories } = useCategoryCatalog();
  const { courses } = usePublicCatalog();
  const [state,setState]=useState(null);
  const interests=(profile.learningCategoryIds||[]).filter(id=>categories.some(item=>item.id===id)).map(id=>categoryLabel(categories,id,language));
  const query=[review?.text?.trim() || course.title?.[language] || '',course.category].join(' ');
  const exclude=[String(course.id),...enrollments.map(e=>String(e.courseId))];
  const catalogRevision=useMemo(()=>recommendationCatalogRevision(courses),[courses]);
  const signature=JSON.stringify({account:profile.id,generation:account.sessionGeneration,roles:profile.roles,query,interests,exclude,language,course,catalog:catalogRevision});
  const currentSignature=useRef(signature);currentSignature.current=signature;
  useEffect(()=>{
    const controller=new AbortController(), scope=assistantScope(account);
    const valid=()=>!controller.signal.aborted&&scope.current()&&currentSignature.current===signature;
    setState({signature,loading:true,recommendations:[],external:[],remote:null});
    if(!profile.roles?.includes('Learner')){setState({signature,loading:false,recommendations:[],external:[],remote:null});return()=>controller.abort();}
    (async()=>{
      try {
        const exclusions=await ownedRecommendationExclusions(profile.id,course.id,undefined,courses.filter(item=>item.instructorId===profile.id).map(item=>item.id));
        if(!valid())return;
        const fallback=recommendCourses({catalog:courses,completedCourse:course,review:review||{text:'',rating:5},enrollments:exclusions.map(courseId=>({courseId}))});
        let recommendations=fallback,external=[],remote=null;
        if(assistantBase){
          const shared={query,interests,language,level:course.level||''},options={signal:controller.signal,accountId:profile.id};
          const [internal,outside]=await Promise.allSettled([
            assistantRequest('/recommendations',{...shared,scope:'platform',catalog:publicCatalog(courses),exclude:exclusions},options),
            assistantRequest('/recommendations',{...shared,scope:'external',exclude:[]},options),
          ]);
          if(!valid())return;
          if(internal.status==='fulfilled')remote=internal.value.items.map(item=>({course:courses.find(c=>c.id.toLowerCase()===item.courseId?.toLowerCase()&&!exclusions.includes(c.id.toLowerCase())),reason:'content'})).filter(x=>x.course);
          recommendations=remote?.length?remote:fallback;
          if(!remote?.length)remote=null;
          if(outside.status==='fulfilled')external=outside.value.items;
        }
        if(valid())setState({signature,loading:false,recommendations:recommendations.map(item=>({courseId:item.course.id,reason:item.reason})),external,remote});
      } catch { if(valid())setState({signature,loading:false,recommendations:[],external:[],remote:null}); }
    })();
    return()=>controller.abort();
  },[signature]);
  const visible=state?.signature===signature?state:null;
  const {recommendations:identifiers=[],external=[],remote=null,loading=true}=visible||{};
  // Never retain course objects from an earlier response, even between render and effect cleanup.
  const recommendations=identifiers.map(item=>({course:courses.find(course=>course.id===item.courseId),reason:item.reason}))
    .filter(item=>item.course&&item.course.instructorId!==profile.id&&!['archived','suspended','rejected','draft','pending'].includes(item.course.status));
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
