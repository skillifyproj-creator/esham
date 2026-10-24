import { aiEndpoint } from './aiEndpoint.js';
export const assistantBase = aiEndpoint(import.meta.env?.VITE_ASSISTANT_API_URL, import.meta.env?.DEV, 8001);
export function publicCatalog(catalog) {
  return catalog.slice(0,200).map(({id,title,description,category,tags,level,status})=>({id,title,description,category,tags,level,status}));
}
export function safeAssistantSource(s) {
  if(!s||typeof s.id!=='string'||typeof s.title!=='string'||typeof s.url!=='string')return false;
  if(s.source==='external'){try{const u=new URL(s.url);return u.protocol==='https:'&&u.hostname==='www.coursera.org'&&!u.username&&!u.password&&s.id.startsWith('coursera:');}catch{return false;}}
  return ['platform','platform-course'].includes(s.source)&&/^\/(courses(?:\/[a-zA-Z0-9_-]+)?|help\/(terms|privacy|guidelines|support))$/.test(s.url);
}
export async function assistantRequest(path,payload,{signal,base=assistantBase,fetcher=fetch}={}) {
  if(!base)throw new Error('assistant-unavailable');
  const controller=new AbortController(),abort=()=>controller.abort();
  signal?.addEventListener('abort',abort,{once:true});
  const timeout=setTimeout(()=>controller.abort(),95000);
  try{
    if(signal?.aborted)abort();
    const response=await fetcher(`${base}${path}`,{method:'POST',credentials:'include',signal:controller.signal,headers:{'Content-Type':'application/json','X-AI-Request':'esham-assistant'},body:JSON.stringify(payload)});
    const value=await response.json();
    if(!response.ok)throw new Error(/^assistant-[a-z-]+$/.test(value?.error)?value.error:'assistant-unavailable');
    if(path==='/chat'){
      if(typeof value.answer!=='string'||!value.answer.trim()||value.answer.length>12000||!['general','grounded','mixed'].includes(value.answerType)||!Array.isArray(value.sources)||value.sources.length>12||value.sources.some(s=>!safeAssistantSource(s)))throw new Error('assistant-result');
    }else if(!Array.isArray(value.items)||value.items.length>5||value.items.some(s=>!safeAssistantSource(s)))throw new Error('assistant-result');
    return value;
  }catch(e){if(signal?.aborted)throw new DOMException('Cancelled','AbortError');if(controller.signal.aborted)throw new Error('assistant-timeout');throw e;}
  finally{clearTimeout(timeout);signal?.removeEventListener('abort',abort);}
}
