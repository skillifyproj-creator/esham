import test from 'node:test';
import assert from 'node:assert/strict';
import { loadCourseReview, listCourseReviews, submitCourseReview, createCourseRevision, decideCourseReview, reviewStatusLabel } from '../src/services/courseReviewApi.js';
test('review requests retain server version identities, cookies and application headers', async()=>{
 const original=globalThis.fetch,calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json(url.includes('/course-reviews?')?[]:{ok:true})};
 try { await loadCourseReview('course',undefined,'version');await listCourseReviews('pending');await submitCourseReview('course','expected');
 await createCourseRevision('course','expected');await decideCourseReview('course','version','rejected','Feedback');
 assert.deepEqual(calls.map(x=>x.url),['/api/courses/course/review/versions/version','/api/course-reviews?status=pending','/api/courses/course/review/submit','/api/courses/course/review/revision','/api/courses/course/review/versions/version/decision']);
 for(const {options} of calls){assert.equal(options.credentials,'include');assert.equal(options.headers['X-Requested-With'],'XMLHttpRequest')}
 assert.equal(calls[0].options.method,'GET');assert.deepEqual(JSON.parse(calls[2].options.body),{expectedVersionId:'expected'});
 assert.deepEqual(JSON.parse(calls[4].options.body),{decision:'rejected',comment:'Feedback'});
 }finally{globalThis.fetch=original}
});
test('conflicting submissions and denied decisions remain failures with server feedback',async()=>{
 const original=globalThis.fetch;
 try{globalThis.fetch=async()=>Response.json({detail:'not used',title:'Version no longer pending'},{status:409});await assert.rejects(decideCourseReview('course','version','approved',''),/Version no longer pending/);
 globalThis.fetch=async()=>Response.json({title:'Assigned category required'},{status:403});await assert.rejects(decideCourseReview('course','version','approved',''),/Assigned category required/);
 }finally{globalThis.fetch=original}
});
test('real review states are localized',()=>{assert.equal(reviewStatusLabel('pending','en'),'Pending review');assert.equal(reviewStatusLabel('approved','ar'),'معتمد')});

test('review queues reject null/malformed successful bodies instead of crashing filters', async () => {
 const { listCourseReviews } = await import('../src/services/courseReviewApi.js');
 const original=globalThis.fetch;
 try { globalThis.fetch=async()=>({ok:true,status:200,json:async()=>null});await assert.rejects(listCourseReviews('approved'),/invalid course review list/); }
 finally { globalThis.fetch=original; }
});

test('unchanged resubmission preserves the backend bilingual validation message', async () => {
  const original=globalThis.fetch;
  const message='يجب إجراء تعديل فعلي على الدورة قبل إعادة إرسالها للمراجعة.\nYou must make an actual change to the course before resubmitting it for review.';
  try {globalThis.fetch=async()=>Response.json({title:message},{status:400});
    await assert.rejects(submitCourseReview('course','same-draft-id'),error=>error.message===message);
  } finally {globalThis.fetch=original;}
});

test('unchanged resubmission has a stable typed code independent of translated text', async () => {
 const original=globalThis.fetch;
 try {
   globalThis.fetch=async()=>Response.json({code:'course_resubmission_unchanged',errors:{request:['Different translation']}},{status:400});
   await assert.rejects(submitCourseReview('course','version'),e=>e.status===400&&e.code==='course_resubmission_unchanged'&&e.message==='Different translation');
   globalThis.fetch=async()=>Response.json({title:'Server unavailable'},{status:503});
   await assert.rejects(submitCourseReview('course','version'),e=>e.status===503&&e.code===null&&e.message==='Server unavailable');
   globalThis.fetch=async()=>{throw new TypeError('Network unavailable')};
   await assert.rejects(submitCourseReview('course','version'),e=>e.code!=='course_resubmission_unchanged');
 }finally{globalThis.fetch=original}
});

test('catalog invalidation is emitted only after successful approval', async () => {
 const previousFetch=globalThis.fetch,previousWindow=globalThis.window,events=[];
 globalThis.window={dispatchEvent:e=>events.push(e.type)};
 try {
  globalThis.fetch=async()=>Response.json('version');await decideCourseReview('course','version','approved','');assert.deepEqual(events,['esham:catalog-updated']);
  globalThis.fetch=async()=>Response.json({title:'Not authorized'},{status:403});await assert.rejects(decideCourseReview('course','version','approved',''));assert.equal(events.length,1);
 }finally{globalThis.fetch=previousFetch;if(previousWindow===undefined)delete globalThis.window;else globalThis.window=previousWindow;}
});
