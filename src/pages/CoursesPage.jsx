import { Link, useSearchParams } from 'react-router';
import { usePreferences } from '../context/PreferencesContext';
import { coursePagesCopy } from '../i18n/coursePagesCopy';
import { courses, categoryKeys } from '../data/courses';
import { getCourseText } from '../data/courseHelpers';
import CourseCard from '../components/CourseCard';

const PAGE_SIZE=8;
function normalize(text){return text.toLowerCase().normalize('NFKD').replace(/[\u064B-\u065F\u0670]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي');}
export default function CoursesPage(){
 const {copy:c,language}=usePreferences();const p=coursePagesCopy[language];
 const [params,setParams]=useSearchParams();
 const query=params.get('q')||'';const category=categoryKeys.includes(params.get('category'))?params.get('category'):'all';
 const level=['beginner','intermediate','advanced'].includes(params.get('level'))?params.get('level'):'';
 const sort=params.get('sort')==='newest'?'newest':'recommended';
 const update=(key,value)=>setParams(previous=>{const next=new URLSearchParams(previous);if(value)next.set(key,value);else next.delete(key);next.delete('points');if(next.get('sort')==='cheapest')next.delete('sort');next.delete('page');return next;},{replace:true});
 const results=courses.filter(course=>{
  const [title,description]=getCourseText(course,language);
  const searchable=normalize([title,description,...course.tags,c.categories[categoryKeys.indexOf(course.category)],course.instructor.ar,course.instructor.en].join(' '));
  return (category==='all'||course.category===category)&&(!level||course.level===level)&&normalize(query).trim().split(/\s+/).every(word=>searchable.includes(word));
 }).sort((a,b)=>sort==='newest'?b.createdAt.localeCompare(a.createdAt):Number(b.rating)-Number(a.rating));
 const pages=Math.max(1,Math.ceil(results.length/PAGE_SIZE));const page=Math.min(pages,Math.max(1,Number.parseInt(params.get('page')||'1',10)||1));
 const shown=results.slice((page-1)*PAGE_SIZE,page*PAGE_SIZE);
 const changePage=value=>{setParams(previous=>{const next=new URLSearchParams(previous);next.set('page',String(value));return next;});document.getElementById('catalog-results').scrollIntoView({behavior:'smooth'});};
 return <main className="catalog-page"><section className="container catalog-intro"><span className="section-kicker">✦ {p.kicker} ✦</span><h1>{p.explore}</h1><p>{p.intro}</p><form className="catalog-search" role="search" onSubmit={e=>{e.preventDefault();document.getElementById('catalog-results').scrollIntoView({behavior:'smooth'});}}><span aria-hidden="true">⌕</span><input type="search" aria-label={p.searchLabel} placeholder={p.search} value={query} onChange={e=>update('q',e.target.value)}/><button className="button button-small" type="submit">{p.searchButton}</button></form><div className="popular-search"><span>{p.popular}</span>{['Figma',language==='ar'?'تصوير':'Photography',language==='ar'?'تطريز':'Embroidery'].map(term=><button key={term} onClick={()=>update('q',term)}>{term}</button>)}</div></section>
 <section className="container catalog-body"><div className="category-panel"><div className="category-title"><h2>{p.category}</h2><small>{courses.length} {p.count}</small></div><div className="filters catalog-categories" aria-label={p.category}>{categoryKeys.map((key,i)=><button className={category===key?'filter active':'filter'} aria-pressed={category===key} key={key} onClick={()=>update('category',key==='all'?'':key)}>{c.categories[i]}</button>)}</div></div>
 <div className="catalog-toolbar"><div className="toolbar-fields"><label>{p.level}<select value={level} onChange={e=>update('level',e.target.value)}><option value="">{p.allLevels}</option>{['beginner','intermediate','advanced'].map(key=><option value={key} key={key}>{p[key]}</option>)}</select></label><label>{p.sort}<select value={sort} onChange={e=>update('sort',e.target.value)}>{['recommended','newest'].map(key=><option key={key} value={key}>{p[key]}</option>)}</select></label></div><button className="text-button" onClick={()=>setParams({})}>{p.clear}</button></div>
 <div id="catalog-results" className="results-heading" aria-live="polite"><h2>{p.results}</h2><span>{results.length} {p.count}</span></div><div className="catalog-grid">{shown.map(course=><CourseCard key={course.id} course={course} compact/>)}</div>
 {!results.length&&<div className="empty-state"><span className="empty-symbol" aria-hidden="true">⌕</span><h3>{p.empty}</h3><p>{p.emptyHint}</p><button className="button button-outline" onClick={()=>setParams({})}>{p.clear}</button></div>}
 {pages>1&&<nav className="pagination" aria-label={p.pagination}><button disabled={page===1} onClick={()=>changePage(page-1)}>{p.previous}</button>{Array.from({length:pages},(_,i)=><button key={i} aria-label={`${p.page} ${i+1}`} aria-current={page===i+1?'page':undefined} className={page===i+1?'current':''} onClick={()=>changePage(i+1)}>{i+1}</button>)}<button disabled={page===pages} onClick={()=>changePage(page+1)}>{p.next}</button></nav>}
 <aside className="teach-banner"><div><span className="section-kicker">{c.tagline}</span><h2>{p.skillCta}</h2><p>{p.skillText}</p></div><Link className="button teach-button" to="/signup">{p.teach}</Link></aside><p className="catalog-demo">{p.demo}</p></section>

 </main>;
}
