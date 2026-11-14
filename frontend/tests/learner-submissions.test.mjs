import test from 'node:test';import assert from 'node:assert/strict';
import {taskList,attemptDetail,createAttempt,mutateAttempt,uploadAttemptFile,validateSubmissionFile,submissionFileUrl} from '../src/services/learnerSubmissionsApi.js';
const e='10000000-0000-4000-8000-000000000001',t='20000000-0000-4000-8000-000000000001',v='30000000-0000-4000-8000-000000000001',id='40000000-0000-4000-8000-000000000001';
const attempt={accountId:'a',enrollmentId:e,id,courseTaskId:t,courseVersionId:v,draftToken:'opaque',status:'inProgress',attachments:[]};
test('task and attempt APIs bind actual account enrollment and immutable identities',async()=>{
 assert.equal((await taskList('a',e,undefined,async()=>({accountId:'a',enrollmentId:e,availableCourseVersionId:v,items:[{id:t,courseVersionId:v}]}))).items[0].id,t);
 await assert.rejects(taskList('b',e,undefined,async()=>({accountId:'a'})),/account_changed/);
 await assert.rejects(attemptDetail('a',e,t,undefined,async()=>attempt),/response/);
 await assert.rejects(attemptDetail('b',e,id,undefined,async()=>attempt),/account_changed/);
});
test('draft creation reuses request identity and never sends status attempt number ownership or optional mode',async()=>{
 await createAttempt('a',e,t,v,id,undefined,async(path,options)=>{assert.equal(options.method,'POST');assert.deepEqual(options.body,{requestId:id,expectedCourseVersionId:v});return attempt;});
 await assert.rejects(createAttempt('a',e,t,v,id,undefined,async()=>({...attempt,courseVersionId:e})),/response/);
});
test('draft finalization and removal carry persisted fingerprint without forging assessment',async()=>{
 for(const kind of ['draft','submit','remove'])await mutateAttempt('a',e,attempt,kind,{answerText:'Work',workUrl:'https://example.test',attachmentId:t},undefined,async(_,options)=>{
  assert.equal(options.accountId,'a');assert.equal(options.body.expectedDraftToken,'opaque');assert.equal(options.body.expectedTaskVersionId,v);assert.equal(options.body.status,undefined);assert.equal(options.body.attemptNumber,undefined);return attempt;
 });
});
test('attachment policy excludes DOC and enforces five files and exact 10 MiB cap',()=>{
 for(const name of ['work.pdf','work.png','work.jpg','work.webp','work.txt','work.docx'])assert.doesNotThrow(()=>validateSubmissionFile({name,size:10*1024*1024},4));
 for(const file of [{name:'work.doc',size:1},{name:'work.exe',size:1},{name:'work.txt',size:0},{name:'work.txt',size:10*1024*1024+1}])assert.throws(()=>validateSubmissionFile(file),/invalid_attachment/);
 assert.throws(()=>validateSubmissionFile({name:'work.txt',size:1},5),/invalid_attachment/);
});
test('multipart upload uses cookies account header stable upload id and lets browser set boundary',async()=>{
 const file=new Blob(['A real answer'],{type:'text/plain'});file.name='work.txt';
 await uploadAttemptFile('a',e,attempt,file,t,undefined,async(_,options)=>{
  assert.equal(options.credentials,'include');assert.equal(options.headers['X-Esham-Account-Id'],'a');assert.equal(options.headers['Content-Type'],undefined);
  assert.equal(options.body.get('uploadId'),t);assert.equal(options.body.get('expectedDraftToken'),'opaque');assert.equal(options.body.get('file').name,'work.txt');return Response.json(attempt);
 });
});
test('private file links reject unrelated enrollment external URLs and traversal',()=>{
 const path=`/me/enrollments/${e}/submissions/${id}/attachments/${t}/content`;
 assert.equal(submissionFileUrl(path,e,'http://localhost:5216'),'http://localhost:5216'+path);
 for(const p of ['https://evil.test',path+'/../secret',path.replace(e,v)])assert.throws(()=>submissionFileUrl(p,e),/response/);
});
test('conflicts and upload failures propagate without fabricating a successful attempt',async()=>{
 await assert.rejects(mutateAttempt('a',e,attempt,'submit',{},undefined,async()=>{throw new Error('draft_conflict');}),/draft_conflict/);
 const file=new Blob(['Work']);file.name='work.txt';await assert.rejects(uploadAttemptFile('a',e,attempt,file,t,undefined,async()=>Response.json({code:'upload_conflict'},{status:409})),err=>err.code==='upload_conflict'&&err.status===409);
});
