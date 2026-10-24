import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import { createAssistantServer } from './assistant-server.mjs';
import { createReviewServer } from './server.mjs';
import {guestHelp} from './guest-help.mjs';

export function gatewayConfig(env=process.env) {
  const origin=new URL(env.PUBLIC_ORIGIN || '');
  const session=new URL(env.BACKEND_SESSION_URL || '');
  if(origin.protocol!=='https:' || origin.origin!==env.PUBLIC_ORIGIN || origin.username || origin.password) throw Error('PUBLIC_ORIGIN must be an HTTPS origin');
  if(session.username || session.password || session.search || session.hash ||
    (session.protocol!=='https:' && !(session.protocol==='http:' && (['127.0.0.1','localhost'].includes(session.hostname) || env.ALLOW_INTERNAL_HTTP==='true')))) throw Error('BACKEND_SESSION_URL must use HTTPS or explicitly trusted internal HTTP');
  return {origin:origin.origin,host:origin.host,sessionUrl:session.href};
}
export function identityCookie(header='') {
  return header.split(';').map(x=>x.trim()).filter(x=>/^Esham\.Identity(?:C\d+)?=/.test(x)).join('; ');
}
// Use an existing server-owned cookie session. No keys, tokens or local profile claims from the frontend.
export async function verifySession(cookie, sessionUrl, fetcher=fetch) {
  const selected=identityCookie(cookie);
  if(!selected) return null;
  const response=await fetcher(sessionUrl,{headers:{Cookie:selected,Accept:'application/json'},redirect:'error',signal:AbortSignal.timeout(5000)});
  if(response.status===401 || response.status===403)return null;
  if(!response.ok)throw Error('session-service');
  const result=await response.json(),profile=result?.profile;
  if(result.onboardingRequired || !profile || typeof profile.id!=='string' || !profile.id || typeof profile.role!=='string' || !profile.role)return null;
  return {id:profile.id,role:profile.role};
}
export async function createGateway({config,assistantOptions={},videoOptions={},authenticate=verifySession,catalog=[]}={}) {
  if(!config)config=gatewayConfig();
  const assistant=createAssistantServer({...assistantOptions,allowedOrigins:['http://127.0.0.1:5174']}),video=createReviewServer({...videoOptions,allowedOrigins:['http://127.0.0.1:5174']});
  const listen=server=>new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',()=>{server.off('error',reject);resolve(server.address().port);});});
  let assistantPort,videoPort;
  try { assistantPort=await listen(assistant);videoPort=await listen(video); }
  catch(error){assistant.close();video.close();throw error;}
  const users=new Map();let active=0;
  const gateway=http.createServer(async(req,res)=>{
    res.setHeader('Cache-Control','no-store');res.setHeader('X-Content-Type-Options','nosniff');
    const reply=(status,error)=>{if(!res.destroyed){res.writeHead(status,{'Content-Type':'application/json'});res.end(JSON.stringify(typeof error==='string'?{error}:error));}};
    if(req.headers.host!==config.host)return reply(403,'assistant-origin');
    const path=req.url;
    // Health probes do not expose provider/model names or user data and cannot invoke a paid model.
    if(req.method==='GET'&&['/health','/assistant/health'].includes(path))return reply(200,{configured:path==='/health'?Boolean(videoOptions.apiKey??process.env.GEMINI_API_KEY):Boolean(assistantOptions.apiKey??(process.env.CHAT_PROVIDER==='deepseek'?process.env.DEEPSEEK_API_KEY:process.env.GEMINI_API_KEY)),mode:'authenticated-gateway'});
    if(!['/assistant/chat','/assistant/recommendations','/video/review'].includes(path))return reply(404,'not-found');
    if(req.headers.origin!==config.origin || req.headers['sec-fetch-site']==='cross-site')return reply(403,'assistant-origin');
    res.setHeader('Access-Control-Allow-Origin',config.origin);res.setHeader('Access-Control-Allow-Credentials','true');res.setHeader('Vary','Origin');
    res.setHeader('Access-Control-Allow-Methods','POST,OPTIONS');res.setHeader('Access-Control-Allow-Headers','Content-Type,X-AI-Request,X-Media-Id,X-Video-Duration,X-Review-Consent');
    if(req.method==='OPTIONS'){res.writeHead(204);res.end();return;}
    if(req.method!=='POST')return reply(405,'not-found');
    const isVideo=path==='/video/review',prefix=isVideo?'screening':'assistant';
    if(active>=20)return reply(429,`${prefix}-rate-limit`);
    active++;
    let upstream;
    const close=()=>upstream?.destroy();res.on('close',close);
    try {
      const identity=await authenticate(req.headers.cookie,config.sessionUrl);
      if(!identity&&isVideo)return reply(401,'screening-unauthorized');
      if(isVideo&&!['instructor','both'].includes(identity.role))return reply(403,'screening-forbidden');
      const now=Date.now();for(const[k,v]of users)if(v.until<=now)users.delete(k);
      const userKey=identity?`user:${identity.id}`:'anonymous';
      if(users.size>=10000&&!users.has(userKey))return reply(429,`${prefix}-rate-limit`);
      const usage=users.get(userKey)||{until:now+60000,chat:0,video:0},kind=isVideo?'video':'chat';
      if(usage[kind]>=(isVideo?3:identity?10:30))return reply(429,`${prefix}-rate-limit`);
      usage[kind]++;users.set(userKey,usage);
      const headers={Origin:'http://127.0.0.1:5174'};
      for(const key of ['content-type','x-ai-request','x-media-id','x-video-duration','x-review-consent'])if(req.headers[key])headers[key]=req.headers[key];
      let body;
      if(!isVideo){
        let size=0;const chunks=[];
        for await(const chunk of req){size+=chunk.length;if(size>4*1024*1024)return reply(413,'assistant-size');chunks.push(chunk);}
        try{body=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{return reply(400,'assistant-input');}
        if(!body||typeof body!=='object'||Array.isArray(body))return reply(400,'assistant-input');
        if(!identity){
          if(body.document||body.image)return reply(401,'assistant-unauthorized');
          if(!['ar','en'].includes(body.language)||typeof body.message!=='string'||!body.message.trim()||body.message.length>2000)return reply(400,'assistant-input');
          if(path!=='/assistant/chat')return reply(401,'assistant-unauthorized');
          return reply(200,guestHelp(body.message,body.language));
        }
        // The public browser catalog is not an authority. Production uses only an operator-owned catalog.
        body=Buffer.from(JSON.stringify({...body,catalog}));headers['Content-Length']=body.length;
      }else if(Number(req.headers['content-length'])>20*1024*1024)return reply(413,'screening-cloud-size');
      await new Promise(resolve=>{
        upstream=http.request({host:'127.0.0.1',port:isVideo?videoPort:assistantPort,path:isVideo?path:path.replace('/assistant',''),method:'POST',headers},response=>{
          if(res.destroyed){response.destroy();return resolve();}
          res.writeHead(response.statusCode,{'Content-Type':'application/json'});response.pipe(res);response.on('end',resolve);response.on('error',()=>{res.destroy();resolve();});
        });
        upstream.on('error',()=>{reply(502,`${prefix}-unavailable`);resolve();});
        upstream.setTimeout(isVideo?130000:100000,()=>upstream.destroy());
        req.on('aborted',()=>upstream.destroy());
        if(body)upstream.end(body);else req.pipe(upstream);
      });
    }catch {reply(503,`${prefix}-unavailable`);}
    finally {active--;res.off('close',close);}
  });
  gateway.requestTimeout=140000;gateway.headersTimeout=10000;
  gateway.on('close',()=>{assistant.closeAllConnections();assistant.close();video.closeAllConnections();video.close();});
  return gateway;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
  try {
    const catalog=process.env.PLATFORM_CATALOG_FILE?JSON.parse(await readFile(process.env.PLATFORM_CATALOG_FILE,'utf8')):[];
    if(!Array.isArray(catalog)||catalog.length>200)throw Error('Invalid server catalog');
    const server=await createGateway({catalog});
    server.on('error',()=>{console.error('AI gateway failed to start; check the port and configuration.');process.exit(1);});
    server.listen(Number(process.env.GATEWAY_PORT||(process.env.NODE_ENV==='production'?process.env.PORT:undefined)||8080),'0.0.0.0',()=>console.log('Authenticated AI gateway started.'));
    for(const signal of ['SIGINT','SIGTERM'])process.once(signal,()=>{server.close();setTimeout(()=>process.exit(0),10000).unref();});
  }catch{console.error('AI gateway configuration failed. Check PUBLIC_ORIGIN, BACKEND_SESSION_URL and server catalog.');process.exitCode=1;}
}
