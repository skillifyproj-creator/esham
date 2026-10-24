import {readFile,writeFile,mkdir} from 'node:fs/promises';
import {resolve,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {chatAnswer} from '../src/chat.mjs';
import {recommendations} from '../src/retrieval.mjs';
import {reviewVideo} from '../src/gemini.mjs';

const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const results=[];
function record(name,passed,detail={}){results.push({name,passed,...detail});console.log(`${passed?'PASS':'FAIL'} ${name}`);}
const courses=JSON.parse(await readFile(resolve(root,'ai/data/processed/courses.json'),'utf8'));
record('clean catalog identity integrity',courses.length>0&&new Set(courses.map(c=>c.id)).size===courses.length&&new Set(courses.map(c=>c.url)).size===courses.length&&courses.every(c=>c.title&&c.url.startsWith('https://www.coursera.org/')),{courses:courses.length});
const features=JSON.parse(await readFile(resolve(root,'ai/data/processed/courses-features.json'),'utf8'));
record('feature rows retain imputation labels',features.length===courses.length&&features.every(c=>c.imputed&&Object.values(c.features).every(v=>v!==null&&v!==''&&(!Array.isArray(v)||v.length))));
for(const[query,word]of [['بايثون','python'],['اكسل','excel'],['تصوير','photograph'],['javascript','javascript']]){
  const items=await recommendations({query,scope:'external',language:'ar'});
  record(`retrieval smoke: ${query}`,items.length>0&&items.some(x=>x.title.toLowerCase().includes(word)),{titles:items.map(x=>x.title)});
}
if(process.argv.includes('--live')){
  const provider=process.env.CHAT_PROVIDER||'google';
  const options={provider,apiKey:provider==='deepseek'?process.env.DEEPSEEK_API_KEY:process.env.GEMINI_API_KEY,model:provider==='deepseek'?(process.env.DEEPSEEK_MODEL||'deepseek-flash'):(process.env.GEMINI_CHAT_MODEL||'gemini-3.5-flash-lite')};
  const cases=[
    ['fixed enrollment cost','كم تكلفة التسجيل في دورة إسهام؟','platform:points',/20|٢٠/],
    ['account transition','أنا متعلم وبدي أعطي دروس بنفس الحساب، كيف؟','platform:roles',/إعداد|اعداد|حساب/],
    ['certificate requirements','كيف أحصل على شهادة إسهام؟','platform:certificates',/مهام|مهم|دروس/],
    ['general reasoning','What is 12 multiplied by 7?',null,/84/],
    ['document summary','Summarize the attached note.',null,/photosynthesis/i,{name:'note.txt',text:'Photosynthesis uses light to help plants make sugars from water and carbon dioxide.',truncated:false}],
  ];
  for(const[name,message,source,pattern,document]of cases){
    try{const value=await chatAnswer({message,language:message.match(/[\u0600-\u06ff]/)?'ar':'en',document},{...options,signal:AbortSignal.timeout(90000)});
      record(`live chat: ${name}`,pattern.test(value.answer)&&(!source||value.sources.some(s=>s.id===source))&&!/deepseek|gemini|ديب سيك|جيميني/i.test(value.answer),{answer:value.answer,sources:value.sources});
    }catch(error){record(`live chat: ${name}`,false,{error:error.message});}
  }
}
// Optional operator-labelled, consented clips. Never invent human labels or claim these are a broad benchmark.
const manifestArg=process.argv.indexOf('--video-manifest');
if(manifestArg>=0){
  const manifest=JSON.parse(await readFile(resolve(process.argv[manifestArg+1]),'utf8'));
  for(const clip of manifest){
    if(!['review','no-flags'].includes(clip.expectedStatus)||!clip.labelNotes)throw Error('Each video needs a human expectedStatus and labelNotes.');
    try{
      const bytes=await readFile(resolve(clip.path));
      if(bytes.length>20*1024*1024||clip.duration<=0||clip.duration>600)throw Error('clip-limit');
      const value=await reviewVideo(bytes,{mediaId:clip.id,duration:clip.duration,mimeType:clip.mimeType},{apiKey:process.env.GEMINI_API_KEY,model:process.env.GEMINI_MODEL||'gemini-3.8-flash',signal:AbortSignal.timeout(120000)});
      record(`labelled video: ${clip.id}`,value.status===clip.expectedStatus,{expected:clip.expectedStatus,actual:value.status,labelNotes:clip.labelNotes,findings:value.findings});
    }catch(error){record(`labelled video: ${clip.id}`,false,{error:error.message});}
  }
}
const report={createdAt:new Date().toISOString(),scope:'Engineering smoke checks; not a representative accuracy benchmark or child-safety certification.',liveChat:process.argv.includes('--live'),liveVideos:manifestArg>=0,passed:results.filter(r=>r.passed).length,total:results.length,results};
await mkdir(resolve(root,'artifacts/evaluation'),{recursive:true});
await writeFile(resolve(root,'artifacts/evaluation/ai-readiness.json'),JSON.stringify(report,null,2));
console.log(`${report.passed}/${report.total} checks passed. Report: artifacts/evaluation/ai-readiness.json`);
if(report.passed!==report.total)process.exitCode=1;
