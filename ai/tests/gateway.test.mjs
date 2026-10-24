import test from 'node:test';
import assert from 'node:assert/strict';
import {createGateway,gatewayConfig,verifySession,identityCookie} from '../src/gateway.mjs';
import {aiEndpoint} from '../../frontend/src/services/aiEndpoint.js';

test('deployment URLs reject insecure origins, credentials, queries and frontend secrets',()=>{
  assert.equal(aiEndpoint('/ai/assistant',false,8001),'/ai/assistant');
  assert.equal(aiEndpoint('',false,8001),'');
  assert.equal(aiEndpoint('',true,8001),'http://127.0.0.1:8001');
  for(const value of ['http://public.example','https://key@api.example','https://api.example?key=secret','//evil.test'])assert.equal(aiEndpoint(value,false,8001),'');
  assert.throws(()=>gatewayConfig({PUBLIC_ORIGIN:'http://website.example',BACKEND_SESSION_URL:'https://api.example/auth/session'}));
  assert.throws(()=>gatewayConfig({PUBLIC_ORIGIN:'https://website.example',BACKEND_SESSION_URL:'http://api.example/auth/session'}));
  assert.equal(gatewayConfig({PUBLIC_ORIGIN:'https://website.example',BACKEND_SESSION_URL:'http://backend:5206/auth/session',ALLOW_INTERNAL_HTTP:'true'}).host,'website.example');
});
test('gateway authenticates via the existing server session, forwarding only the identity cookie',async()=>{
  assert.equal(identityCookie('analytics=private; Esham.Identity=abc; Esham.IdentityC1=chunk; unrelated=secret'),'Esham.Identity=abc; Esham.IdentityC1=chunk');
  assert.equal(await verifySession('unrelated=secret','https://backend/session',()=>assert.fail('must not fetch')),null);
  const result=await verifySession('Esham.Identity=abc; unrelated=secret','https://backend/session',async(url,options)=>{
    assert.equal(url,'https://backend/session');assert.equal(options.headers.Cookie,'Esham.Identity=abc');assert.equal(options.redirect,'error');
    return new Response(JSON.stringify({profile:{id:'server-id',role:'learner',email:'not-returned'}}));
  });assert.deepEqual(result,{id:'server-id',role:'learner'});
  assert.equal(await verifySession('Esham.Identity=x','https://backend/session',async()=>new Response('',{status:401})),null);
});
test('gateway allows website guests, denies anonymous files/forged origins and learner video; ignores client catalog claims',async()=>{
  let videoCalls=0,chatCalls=0;
  const config={origin:'https://website.example',host:'website.example',sessionUrl:'https://account/session'};
  const server=await createGateway({config,
    authenticate:async cookie=>cookie==='instructor'?{id:'teacher',role:'instructor'}:cookie==='learner'?{id:'student',role:'learner'}:null,
    catalog:[{id:'official',title:'Official course'}],
    assistantOptions:{apiKey:'test',answer:async(body)=>{chatCalls++;assert.equal(body.catalog[0].id,'official');return {answer:'test',sources:[],answerType:'general'};}},
    videoOptions:{apiKey:'test',review:async()=>{videoCalls++;return {status:'review'};}}});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;config.host=new URL(base).host;
  const headers={Host:config.host,Origin:'https://website.example',Cookie:'learner','Content-Type':'application/json','X-AI-Request':'esham-assistant'};
  const body=JSON.stringify({message:'hello',language:'en',catalog:[{id:'forged',title:'Free money'}]});
  try{
    assert.equal((await fetch(base+'/assistant/chat',{method:'POST',headers:{...headers,Cookie:''},body})).status,200);assert.equal(chatCalls,0);
    assert.equal((await fetch(base+'/assistant/chat',{method:'POST',headers:{...headers,Origin:'https://evil.test'},body})).status,403);
    assert.equal((await fetch(base+'/assistant/chat',{method:'POST',headers,body})).status,200);assert.equal(chatCalls,1);
    assert.equal((await fetch(base+'/assistant/chat',{method:'POST',headers:{...headers,Cookie:''},body:JSON.stringify({message:'analyze',language:'en',document:{name:'note',text:'text',truncated:false}})})).status,401);
    assert.equal((await fetch(base+'/video/review',{method:'POST',headers,body})).status,403);assert.equal(videoCalls,0);
    const videoHeaders={Host:config.host,Origin:headers.Origin,Cookie:'instructor','Content-Type':'video/webm','X-Review-Consent':'google-video-upload','X-Media-Id':'clip','X-Video-Duration':'2'};
    assert.equal((await fetch(base+'/video/review',{method:'POST',headers:videoHeaders,body:Buffer.from('1a45dfa300','hex')})).status,200);assert.equal(videoCalls,1);
    assert.equal((await fetch(base+'/assistant/chat',{method:'POST',headers,body:'x'.repeat(4*1024*1024+1)})).status,413);
  }finally{server.closeAllConnections();await new Promise(r=>server.close(r));}
});

test('guest help answers website policy without invoking a paid general model',async()=>{
 const {guestHelp}=await import('../src/guest-help.mjs');
 assert.ok(guestHelp('كم تكلفة الدورة؟','ar').answer.includes('20'));
 assert.ok(guestHelp('What does a course cost?','en').sources.some(s=>s.id==='platform:points'));
 const general=guestHelp('What is photosynthesis?','en');assert.ok(general.answer.includes('Sign in'));assert.deepEqual(general.sources,[]);
});
