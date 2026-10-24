import { readFile } from 'node:fs/promises';
import { platformKnowledge } from './knowledge.mjs';

const stop = new Set('the a an of to and in for with on is are this that your my i course courses learn learning هل ما كيف من في على عن انا ان لي بدي اريد تعلم اتعلم دوره دورات الدوره'.split(' '));
export const normalize = value => String(value || '').normalize('NFKC').toLowerCase().replace(/[ًٌٍَُِّْـ]/g,'').replace(/[أإآ]/g,'ا').replace(/ى/g,'ي').replace(/ة/g,'ه');
const dictionary = [
 ['بايثون','python'],['برمج','programming software coding'],['ويب','web development html css javascript'],['تحليل','analysis'],['بيانات','data'],['احصا','statistics'],['ذكاء اصطناعي','artificial intelligence machine learning'],['تعلم ال','machine learning'],['تصميم','design'],['واجه','user interface ux ui'],['تصوير','photography camera'],['فوتوغراف','photography'],['تسويق','marketing'],['اعمال','business'],['اداره','management'],['مشاريع','project management'],['مشروع','project'],['حرف','crafts arts'],['تطريز','embroidery textile'],['رسم','drawing art'],['مبتد','beginner introduction basics'],['متقدم','advanced'],['متوسط','intermediate'],['اكسل','excel'],['جافا','java javascript'],['امن','security'],['انجليزي','english'],['صحه','health'],['طب','medical'],['وقت','time management'],['مهارات','skills'],['نقاط','points enrollment'],['شهاده','certificate tasks'],['سجل','enrollment'],['فيديو','video recording'],['حساب','account roles'],['درّب','instructor'],['مدرب','instructor'],['متعلم','learner'],['هايبرد','hybrid']
];
export function tokens(value, expand=false) {
  let normalized=normalize(value);
  if(expand){const original=normalized;normalized+=' '+dictionary.filter(([key])=>original.includes(normalize(key))).map(([,v])=>v).join(' ');}
  return normalized.match(/[\p{L}\p{N}][\p{L}\p{N}+#.-]*/gu)?.filter(t=>t.length>1&&!stop.has(t))||[];
}
export function createIndex(documents, {enforceSkills=true}={}) {
  const frequencies = new Map(), rows=[];
  for(const doc of documents){const tf=new Map();for(const t of tokens(`${doc.title} ${doc.title} ${doc.text}`))tf.set(t,(tf.get(t)||0)+1);for(const t of tf.keys())frequencies.set(t,(frequencies.get(t)||0)+1);rows.push({doc,tf});}
  const idf=t=>Math.log(1+(documents.length+1)/((frequencies.get(t)||0)+1));
  for(const row of rows){row.weights=new Map([...row.tf].map(([t,n])=>[t,(1+Math.log(n))*idf(t)]));row.norm=Math.hypot(...row.weights.values())||1;}
  return { search(query,{limit=6,exclude=[]}={}) {
    const tf=new Map();for(const t of tokens(query,true))tf.set(t,(tf.get(t)||0)+1);
    const weights=new Map([...tf].map(([t,n])=>[t,(1+Math.log(n))*idf(t)])),norm=Math.hypot(...weights.values())||1,removed=new Set(exclude.map(String));
    const core=[...weights.keys()].filter(t=>['python','javascript','java','excel','sql','react','photoshop','figma','html','css'].includes(t));
    return rows.filter(r=>!removed.has(String(r.doc.id))&&(!enforceSkills||!core.length||core.some(t=>r.tf.has(t)))).map(row=>{let dot=0;for(const[t,w]of weights)dot+=w*(row.weights.get(t)||0);return {...row.doc,score:dot/(norm*row.norm)+core.filter(t=>row.tf.has(t)).length*0.15};}).filter(r=>r.score>0.015).sort((a,b)=>b.score-a.score||a.id.localeCompare(b.id)).slice(0,limit);
  }, size:documents.length };
}
let catalogPromise;
export function externalIndex() {
  return catalogPromise ||= readFile(new URL('../data/processed/courses.json',import.meta.url),'utf8').then(JSON.parse).then(rows=>createIndex(rows.map(r=>({id:r.id,title:r.title,url:r.url,source:'external',text:r.search_text,level:r.level,skills:r.skills,subjects:r.subjects,provider:r.providers.join(', ')})))).catch(()=>{catalogPromise=null;throw new Error('assistant-data-missing');});
}
export const knowledgeIndex=createIndex(platformKnowledge,{enforceSkills:false});
export function platformDocuments(catalog=[],language='ar') {
  return catalog.filter(c=>c&&['string','number'].includes(typeof c.id)&&/^[a-zA-Z0-9_-]{1,80}$/.test(String(c.id))&&!['draft','rejected','archived','suspended','pending'].includes(c.status)).slice(0,200).map(c=>{
    const localized=v=>typeof v==='string'?v:typeof v?.[language]==='string'?v[language]:v?.en||v?.ar||'';
    return {id:`catalog:${c.id}`,courseId:String(c.id),title:localized(c.title).slice(0,200),url:`/courses/${encodeURIComponent(c.id)}`,source:'platform-course',level:c.level||'',text:[localized(c.title),localized(c.description),c.category,(c.tags||[]).filter(x=>typeof x==='string').join(' ')].join(' ').slice(0,4000)};
  }).filter(c=>c.title);
}
export async function retrieve(query,{catalog=[],language='ar',external=true}={}) {
  const platform=createIndex(platformDocuments(catalog,language)).search(query,{limit:3});
  const knowledge=knowledgeIndex.search(query,{limit:4});
  const outside=external?(await externalIndex()).search(query,{limit:4}):[];
  return [...knowledge,...platform,...outside];
}
export async function recommendations({query='',interests=[],catalog=[],exclude=[],scope='platform',language='ar',level=''},{loadExternal=externalIndex}={}) {
  const search=[query,...interests].join(' ').trim();if(!search)return [];
  const index=scope==='external'?await loadExternal():createIndex(platformDocuments(catalog,language));
  // Retrieve broadly before applying level preferences; never invent a catalog ID.
  return index.search(search,{limit:100,exclude:exclude.map(id=>scope==='external'?String(id):`catalog:${id}`)})
    .map(doc=>({...doc,score:doc.score+(level&&doc.level===level?0.03:0)})).sort((a,b)=>b.score-a.score).slice(0,5)
    .map(({id,courseId,title,url,source,level,score})=>({id,courseId,title,url,source,level,score,reason:language==='ar'?'توافق نصي مع اهتماماتك ومهاراتك':'Content similarity to your interests and skills'}));
}
