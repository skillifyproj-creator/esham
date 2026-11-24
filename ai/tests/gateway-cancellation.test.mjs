import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import {createGateway} from '../src/gateway.mjs';
const deferred=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve};};
const pause=()=>new Promise(r=>setImmediate(r));

async function setup({authenticate,loadCatalog,answer}={}){
 const config={origin:'https://audit.invalid',host:'temporary',sessionUrl:'https://unused.invalid/session'};
 let providers=0,upstreams=0;const entered=deferred(),aborted=deferred();
 const original=http.request;http.request=function(options,...args){if(options.host==='127.0.0.1'&&options.path==='/chat')upstreams++;return original.call(this,options,...args);};
 const server=await createGateway({config,authenticate:authenticate||(async()=>({id:'A',role:'learner'})),loadCatalog:loadCatalog||(async()=>[]),assistantOptions:{apiKey:'synthetic',answer:async(body,options)=>{providers++;entered.resolve();return answer?answer(body,options,aborted):{answer:'synthetic',sources:[],answerType:'general'};}}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}`;config.host=new URL(base).host;
 let response;const closed=deferred();server.on('request',(req,res)=>{response=res;res.once('close',()=>closed.resolve());});
 const controller=new AbortController();
 return{entered,aborted,closed,controller,forceClose:()=>response.destroy(),counts:()=>({providers,upstreams}),
  send:(attachment={})=>fetch(base+'/assistant/chat',{method:'POST',signal:controller.signal,headers:{Origin:config.origin,'Content-Type':'application/json','X-AI-Request':'esham-assistant','X-Esham-Account-Id':'A'},body:JSON.stringify({message:'synthetic',language:'en',...attachment})}).catch(()=>null),
  stop:async()=>{server.closeAllConnections();await new Promise(r=>server.close(r));http.request=original;}};
}
for(const stage of ['authentication','catalog']){
 test(`cancellation during ${stage} prevents all upstream/provider invocations`,async()=>{
  const reached=deferred(),release=deferred();const identity={id:'A',role:'learner'};
  const env=await setup(stage==='authentication'?{authenticate:async()=>{reached.resolve();await release.promise;return identity;}}:{loadCatalog:async()=>{reached.resolve();await release.promise;return[];}});
  try{const pending=env.send();await reached.promise;env.controller.abort();await pending;await env.closed.promise;release.resolve();await pause();await new Promise(r=>setTimeout(r,50));assert.deepEqual(env.counts(),{providers:0,upstreams:0});}
  finally{release.resolve();await env.stop();}
 });
}
test('disconnect immediately before upstream creation is checked even during body projection',async()=>{
 let env;env=await setup({loadCatalog:async()=>({toJSON(){env.forceClose();return[];}})});
 try{await env.send();await env.closed.promise;await new Promise(r=>setTimeout(r,50));assert.deepEqual(env.counts(),{providers:0,upstreams:0});}finally{await env.stop();}
});
for(const attachment of [{document:{name:'synthetic.txt',text:'Synthetic private attachment',truncated:false}},{image:{name:'synthetic.jpg',mimeType:'image/jpeg',data:'/9j/'}}]){
 test(`cancelled ${attachment.document?'document':'image'} is never forwarded after catalog wait`,async()=>{
  const reached=deferred(),release=deferred();const env=await setup({loadCatalog:async()=>{reached.resolve();await release.promise;return[];}});
  try{const pending=env.send(attachment);await reached.promise;env.controller.abort();await pending;await env.closed.promise;release.resolve();await new Promise(r=>setTimeout(r,50));assert.deepEqual(env.counts(),{providers:0,upstreams:0});}finally{release.resolve();await env.stop();}
 });
}
test('forwarded requests propagate disconnect to the synthetic provider signal',async()=>{
 const env=await setup({answer:async(body,{signal},aborted)=>{await new Promise(resolve=>{signal.addEventListener('abort',()=>{aborted.resolve();resolve();},{once:true});});return {answer:'synthetic',sources:[],answerType:'general'};}});
 try{const pending=env.send();await env.entered.promise;env.controller.abort();await pending;await Promise.race([env.aborted.promise,new Promise((_,reject)=>setTimeout(()=>reject(Error('Provider abort not propagated')),2000))]);assert.deepEqual(env.counts(),{providers:1,upstreams:1});}finally{await env.stop();}
});
test('one cancelled caller does not cancel catalog refresh needed by another caller',async()=>{
 const {backendCatalog}=await import('../src/catalog.mjs');const reached=deferred(),release=deferred();let fetches=0;
 const load=backendCatalog('https://unused.invalid/auth/session',{fetcher:async()=>{fetches++;reached.resolve();await release.promise;return new Response('[]',{headers:{'Content-Type':'application/json'}});}});
 const first=await setup({loadCatalog:load});
 try{const pending=first.send();await reached.promise;const other=load();first.controller.abort();await pending;await first.closed.promise;release.resolve();assert.deepEqual(await other,[]);await new Promise(r=>setTimeout(r,50));assert.equal(fetches,1);assert.deepEqual(first.counts(),{providers:0,upstreams:0});}finally{release.resolve();await first.stop();}
});
