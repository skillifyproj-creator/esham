import test from 'node:test';
import assert from 'node:assert/strict';
import {backendCatalog,catalogProjection} from '../src/catalog.mjs';
const id='c6666666-1111-4444-8888-111111111111';
const rows=[{courseId:id,publishedVersionId:'c6666666-1111-4444-8888-222222222222',categoryId:'c6666666-1111-4444-8888-333333333333',titleEn:'Trusted public course',descriptionEn:'Public',ownerUserId:'private',level:'beginner'}];
const json=value=>new Response(JSON.stringify(value),{headers:{'Content-Type':'application/json'}});

test('catalog uses only public GUID projections and removes ownership/private fields',()=>{
  const [course]=catalogProjection(rows); assert.equal(course.id,id); assert.equal(course.status,'published'); assert.equal(course.ownerUserId,undefined);
  for(const value of [[{...rows[0],courseId:'0'}],[{...rows[0],publishedVersionId:null}],[rows[0],rows[0]],Array(201).fill(rows[0])])assert.throws(()=>catalogProjection(value));
});
test('backend refresh is cookie-free, single flight, bounded and expires into safe empty fallback',async()=>{
  let calls=0,time=0,fail=false;
  const load=backendCatalog('https://backend.example/auth/session',{now:()=>time,fetcher:async(url,options)=>{
    calls++;assert.equal(url,'https://backend.example/api/courses/public');assert.equal(options.credentials,'omit');assert.equal(options.redirect,'error');assert.equal(options.headers.Cookie,undefined);
    await new Promise(resolve=>setTimeout(resolve,5)); if(fail)throw Error('offline');return json(rows);
  }});
  const result=await Promise.all([load(),load(),load()]);assert.equal(calls,1);assert.equal(result[0][0].id,id);
  time=29999;await load();assert.equal(calls,1);time=30001;fail=true;assert.deepEqual(await load(),[]);assert.equal(calls,2);
  await load();assert.equal(calls,2);time+=5001;fail=false;assert.equal((await load()).length,1);assert.equal(calls,3);
});
test('malformed, overlarge, redirected and non-JSON backend responses fail closed',async()=>{
  for(const response of [()=>json([{courseId:'index-1'}]),()=>new Response('bad',{headers:{'Content-Type':'application/json'}}),
    ()=>new Response('x'.repeat(2*1024*1024+1),{headers:{'Content-Type':'application/json'}}),
    ()=>new Response('[]',{status:302}),()=>new Response('[]',{headers:{'Content-Type':'text/html'}})]){
    assert.deepEqual(await backendCatalog('https://backend.example/auth/session',{fetcher:async()=>response()})(),[]);
  }
});

test('large public catalogs use a validated bounded prefix and cancel the unread response',async()=>{
 let cancelled=false;
 const batch=Array.from({length:201},(_,i)=>({...rows[0],courseId:`c6666666-1111-4444-8888-${String(i+1).padStart(12,'0')}`,titleEn:'Quoted " title with } nested characters'}));
 const text=JSON.stringify(batch),bytes=new TextEncoder().encode(text);let offset=0;
 const response=new Response(new ReadableStream({pull(controller){if(offset>=bytes.length)return controller.close();controller.enqueue(bytes.slice(offset,offset+123));offset+=123;},cancel(){cancelled=true;}}),{headers:{'Content-Type':'application/json'}});
 const catalog=await backendCatalog('https://backend.example/auth/session',{fetcher:async()=>response})();assert.equal(catalog.length,200);assert.ok(cancelled);assert.ok(offset<bytes.length+123);
});
