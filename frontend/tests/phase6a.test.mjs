import test from 'node:test';
import assert from 'node:assert/strict';
import {assistantScope} from '../src/services/assistantScope.js';
import {ownedRecommendationExclusions,recommendationCatalogRevision} from '../src/services/recommendationSelections.js';
import {assistantRequest} from '../src/services/learningAssistant.js';
const guid=n=>`c6666666-1111-4444-8888-${String(n).padStart(12,'0')}`;
test('unchanged IDs do not hide metadata, ownership, publication or ranking revisions',()=>{
 const course={id:guid(1),publishedVersionId:guid(2),instructorId:'A',category:guid(3),level:'beginner',title:{en:'Old'},description:{en:'Description'},status:'published',rating:4,tags:['old']};
 const before=recommendationCatalogRevision([course]);
 for(const change of [{publishedVersionId:guid(4)},{instructorId:'B'},{category:guid(5)},{level:'advanced'},{title:{en:'New'}},{status:'draft'},{description:{en:'Changed'}},{rating:5},{tags:['new']}])assert.notEqual(recommendationCatalogRevision([{...course,...change}]),before);
 assert.equal(recommendationCatalogRevision([JSON.parse(JSON.stringify(course))]),before);
 assert.equal(recommendationCatalogRevision([course,{id:guid(9),title:{en:'Next'}}]),recommendationCatalogRevision([{title:{en:'Next'},id:guid(9)},course]));
});
test('assistant scope rejects delayed responses across logout and A to B to A switches',()=>{
 let live={accountId:'A',generation:1};const scope=assistantScope({session:{profile:{id:'A'}},sessionGeneration:1,getSessionIdentity:()=>live});
 assert.ok(scope.current());live={accountId:'B',generation:2};assert.equal(scope.current(),false);
 live={accountId:'A',generation:3};assert.equal(scope.current(),false);live={accountId:null,generation:4};assert.equal(scope.current(),false);
});
test('recommendation exclusions enumerate all owned pages and fail closed when bounded coverage is incomplete',async()=>{
 const calls=[];const load=async(id,page)=>{assert.equal(id,'A');calls.push(page);return {items:[{courseId:guid(page+1)}],pageSize:1,totalCount:3};};
 assert.deepEqual(await ownedRecommendationExclusions('A',guid(1),load),[guid(1),guid(2),guid(3),guid(4)]);assert.deepEqual(calls,[1,2,3]);
 assert.ok((await ownedRecommendationExclusions('A',guid(1),load,[guid(9)])).includes(guid(9)));
 await assert.rejects(()=>ownedRecommendationExclusions('A',guid(1),async()=>({items:[],pageSize:20,totalCount:201})),/exclusion-limit/);
 await assert.rejects(()=>ownedRecommendationExclusions('A','index-1',load),/input/);
});
test('AI requests bind the originating account, include cookies and preserve cancellation/errors',async()=>{
 await assistantRequest('/chat',{message:'hello',language:'en'},{base:'/ai/assistant',accountId:'A',fetcher:async(url,options)=>{
  assert.equal(options.headers['X-Esham-Account-Id'],'A');assert.equal(options.credentials,'include');return new Response(JSON.stringify({answer:'ok',sources:[],answerType:'general'}));
 }});
 await assert.rejects(()=>assistantRequest('/chat',{}, {base:'/ai/assistant',fetcher:async()=>new Response(JSON.stringify({error:'assistant-account-changed'}),{status:409})}),/account-changed/);
 const controller=new AbortController();controller.abort();await assert.rejects(()=>assistantRequest('/chat',{}, {base:'/ai/assistant',signal:controller.signal,fetcher:async(url,options)=>{if(options.signal.aborted)throw new DOMException('Cancelled','AbortError');}}),{name:'AbortError'});
});
