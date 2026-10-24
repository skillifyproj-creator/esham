import http from 'node:http';
import {pathToFileURL} from 'node:url';
import {chatAnswer} from './chat.mjs';
import {recommendations,externalIndex} from './retrieval.mjs';
import {ReviewError} from './gemini.mjs';

function validInput(body,chat){
  if(!body||typeof body!=='object'||!['ar','en'].includes(body.language))return false;
  if(chat&&(typeof body.message!=='string'||!body.message.trim()||body.message.length>2000))return false;
  if(!chat&&(typeof body.query!=='string'||body.query.length>2000||!['platform','external'].includes(body.scope)))return false;
  if(body.image!==undefined){
    const image=body.image;
    if(!chat||!image||typeof image.name!=='string'||image.name.length>160||image.mimeType!=='image/jpeg'||typeof image.data!=='string'||image.data.length>Math.ceil(2*1024*1024/3)*4||!image.data.length||image.data.length%4!==0||!/^[A-Za-z0-9+/]+={0,2}$/.test(image.data)||Buffer.from(image.data,'base64').subarray(0,3).toString('hex')!=='ffd8ff')return false;
  }
  if(body.image&&body.document)return false;
  if(body.document!==undefined&&(!chat||!body.document||typeof body.document.name!=='string'||body.document.name.length>160||typeof body.document.text!=='string'||!body.document.text.trim()||body.document.text.length>16000||typeof body.document.truncated!=='boolean'))return false;
  if(body.history!==undefined&&(!Array.isArray(body.history)||body.history.length>6||body.history.some(m=>!m||!['user','assistant'].includes(m.role)||typeof m.text!=='string'||m.text.length>4000)))return false;
  for(const key of ['interests','exclude'])if(body[key]!==undefined&&(!Array.isArray(body[key])||body[key].length>200||body[key].some(x=>typeof x!=='string'||x.length>200)))return false;
  if(body.level!==undefined&&!['','beginner','intermediate','advanced'].includes(body.level))return false;
  if(body.catalog!==undefined&&(!Array.isArray(body.catalog)||body.catalog.length>200||body.catalog.some(c=>!c||!['string','number'].includes(typeof c.id)||!['string','object'].includes(typeof c.title)||(c.tags!==undefined&&(!Array.isArray(c.tags)||c.tags.some(t=>typeof t!=='string'))))))return false;
  return true;
}
export function createAssistantServer({provider=process.env.CHAT_PROVIDER||'google',apiKey=provider==='deepseek'?process.env.DEEPSEEK_API_KEY:process.env.GEMINI_API_KEY,model=provider==='deepseek'?(process.env.DEEPSEEK_MODEL||'deepseek-flash'):(process.env.GEMINI_CHAT_MODEL||'gemini-3.5-flash-lite'),answer=chatAnswer,recommend=recommendations,health=externalIndex,visionApiKey=process.env.GEMINI_API_KEY,visionModel=process.env.GEMINI_IMAGE_MODEL||'gemini-3.8-flash',allowedOrigins=(process.env.ALLOWED_ORIGINS||'http://127.0.0.1:5174,http://localhost:5174,http://localhost:5173').split(',')}={}){
  const allowed=allowedOrigins;
  const requests=[];let active=0;
  const server=http.createServer(async(req,res)=>{
    const reply=(status,data)=>{if(!res.destroyed){res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));}};
    const origin=req.headers.origin;
    if(!/^(127\.0\.0\.1|localhost):\d+$/.test(req.headers.host||'')||!/^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(origin||'')||!allowed.includes(origin))return reply(403,{error:'assistant-origin'});
    res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Access-Control-Allow-Credentials','true');res.setHeader('Vary','Origin');res.setHeader('Access-Control-Allow-Methods','GET,POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type,X-AI-Request');
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    if(req.method==='GET'&&req.url==='/health'){let courseCount=0;try{courseCount=(await health()).size;}catch{}return reply(200,{configured:Boolean(apiKey),courseCount,mode:'local-development'});}
    if(req.method!=='POST'||!['/chat','/recommendations'].includes(req.url))return reply(404,{error:'not-found'});
    if(req.headers['x-ai-request']!=='esham-assistant'||!/^application\/json(?:;|$)/.test(req.headers['content-type']||''))return reply(400,{error:'assistant-request'});
    if(Number(req.headers['content-length'])>4*1024*1024)return reply(413,{error:'assistant-size'});
    while(requests.length&&requests[0]<Date.now()-60000)requests.shift();
    if(active>=2||requests.length>=15)return reply(429,{error:'assistant-rate-limit'});
    active++;requests.push(Date.now());
    const controller=new AbortController(),timeout=setTimeout(()=>controller.abort(),90000);
    const close=()=>{if(!res.writableEnded)controller.abort();};res.on('close',close);
    try{
      let size=0;const chunks=[];for await(const chunk of req){size+=chunk.length;if(size>4*1024*1024)throw new ReviewError('assistant-size',413);chunks.push(chunk);}
      let body;try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{throw new ReviewError('assistant-input',400);}
      if(!validInput(body,req.url==='/chat'))throw new ReviewError('assistant-input',400);
      if(controller.signal.aborted)throw new ReviewError('assistant-timeout',504);
      const result=req.url==='/chat'?await answer(body,{apiKey,model,provider,visionApiKey,visionModel,signal:controller.signal}):{items:await recommend(body)};
      reply(200,result);
    }catch(e){reply(controller.signal.aborted?504:e.status||503,{error:controller.signal.aborted?'assistant-timeout':e instanceof ReviewError||e.message==='assistant-data-missing'?e.message:'assistant-unavailable'});}
    finally{clearTimeout(timeout);res.off('close',close);active--;}
  });server.requestTimeout=100000;server.headersTimeout=10000;return server;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){const port=Number(process.env.ASSISTANT_PORT||8001);createAssistantServer().listen(port,'127.0.0.1',()=>console.log(`Learning assistant: http://127.0.0.1:${port}`));}
