import test from 'node:test';
import assert from 'node:assert/strict';
import { loadReviews,mutateReview,replyReview,reviewCsvCell,ownedReviewEnrollment } from '../src/services/learnerReviewsApi.js';
import { notificationTarget } from '../src/services/notifications.js';
import { accountRequest } from '../src/services/accountApi.js';
import { profileRequest } from '../src/services/categorySelections.js';
import { beginAccountOperation } from '../src/services/accountOperations.js';
const id='11111111-1111-4111-8111-111111111111';
test('historical null review attribution never replaces the owned purchase precondition',()=>{
 const selected={id,courseVersionId:null},read={accountId:'A',enrollmentId:id,purchasedCourseVersionId:id,review:{courseVersionId:null}};
 assert.equal(ownedReviewEnrollment(selected,read,'A').courseVersionId,id);assert.equal(read.review.courseVersionId,null);
 assert.throws(()=>ownedReviewEnrollment(selected,read,'B'),/account_changed/);
 assert.throws(()=>ownedReviewEnrollment({...selected,id:'other'},read,'A'),/account_changed/);
});
for(const point of ['save-response','save-refresh','failed-save-refresh','persona-refresh','password-response'])
test(`delayed ${point} cannot apply another account's state or survive A-B-A`,async()=>{
 let identity={accountId:'A',generation:1},view=1,applied=false,release;
 const operation=beginAccountOperation(()=>identity,()=>view);
 const delayed=new Promise(r=>release=r);
 const continuation=(async()=>{const profile=await delayed;if(operation.isCurrent(profile))applied=true;})();
 identity={accountId:'B',generation:2};identity={accountId:'A',generation:3};
 release({id:'A'});await continuation;assert.equal(applied,false);
});
test('a same-account refresh is allowed but a mismatched returned profile and disposed view are rejected',()=>{
 let identity={accountId:'A',generation:1},view=1;
 const op=beginAccountOperation(()=>identity,()=>view);identity={...identity};
 assert.equal(op.isCurrent({id:'A'}),true);assert.equal(op.isCurrent({id:'B'}),false);
 view++;assert.equal(op.isCurrent({id:'A'}),false);
});
test('profile writes require caller-bound identity rather than cached account inference',async()=>{
  let calls=0;
  await assert.rejects(accountRequest('/me',{}, {method:'PATCH',base:'http://isolated.test',fetcher:async()=>{calls++;}}),error=>error.status===401);
  await accountRequest('/me',{}, {method:'PATCH',headers:{'X-Esham-Account-Id':'verified-A'},base:'http://isolated.test',fetcher:async(url,options)=>{calls++;assert.equal(options.headers['X-Esham-Account-Id'],'verified-A');return new Response(null,{status:204});}});
  assert.equal(calls,1);
});
test('exported review text cannot become a spreadsheet formula',()=>{assert.equal(reviewCsvCell('=HYPERLINK("x")'),'"\'=HYPERLINK(""x"")"');assert.equal(reviewCsvCell('plain'),'"plain"');assert.equal(reviewCsvCell('@SUM(1)'),'"\'@SUM(1)"');});
test('review listing uses authenticated server pagination and account binding',async()=>{let path;const data=await loadReviews('A',2,null,async p=>{path=p;return{accountId:'A',items:[]};});assert.equal(path,'/me/reviews?page=2&pageSize=20');assert.deepEqual(data.items,[]);await assert.rejects(loadReviews('B',1,null,async()=>({accountId:'A'})),/account_changed/);});
test('review mutation preserves request identity, version receipt and account precondition',async()=>{const body={requestId:id,expectedVersion:'opaque',expectedCourseVersionId:id,rating:5,comment:'Persisted review'};await mutateReview('A',id,body,{request:async(path,o)=>{assert.equal(path,`/me/enrollments/${id}/review`);assert.equal(o.accountId,'A');assert.equal(o.method,'PUT');assert.deepEqual(o.body,body);return{accountId:'A'};}});});
test('withdraw uses owned enrollment and cannot silently cross accounts',async()=>{await assert.rejects(mutateReview('A',id,{requestId:id},{withdraw:true,request:async(p,o)=>{assert.equal(o.method,'DELETE');return{accountId:'B'};}}),/account_changed/);});
test('invalid identifiers do not send review writes',async()=>{await assert.rejects(mutateReview('A','1',{requestId:id}),/validation/);await assert.rejects(replyReview('A','1',{}),/validation/);});
test('instructor replies carry review concurrency token rather than learner identity',async()=>{await replyReview('teacher',id,{requestId:id,expectedVersion:'v1',reply:'Reply'},false,async(p,o)=>{assert.equal(p,`/api/instructor/reviews/${id}/reply`);assert.equal(o.accountId,'teacher');assert.equal(o.body.expectedVersion,'v1');return{accountId:'teacher'};});});
test('new notification routes reject external or arbitrary targets',()=>{for(const [type,target] of [['review.created','/instructor/feedback'],['review.replied','/learner/reviews'],['announcement.published','/announcements']]){assert.equal(notificationTarget({notificationType:type,targetUrl:target}),target);assert.equal(notificationTarget({notificationType:type,targetUrl:'https://example.test'}),null);assert.equal(notificationTarget({notificationType:type,targetUrl:target+'/other'}),null);}});
test('profile contract can include both GUID category sets in one atomic request',()=>{const result=profileRequest({role:'both',name:'Learner',learningCategoryIds:[id],teachingCategoryIds:[id]},{includeCategories:true});assert.deepEqual(result.learningCategoryIds,[id]);assert.deepEqual(result.teachingCategoryIds,[id]);assert.equal(result.interests,undefined);});
test('interactive cookie-changing requests serialize while passive reads remain independent',async()=>{let release,entered;const started=new Promise(r=>entered=r),hold=new Promise(r=>release=r);const order=[];const fetcher=async(url)=>{order.push(url);if(url.endsWith('/auth/login')){entered();await hold;}return new Response(null,{status:204});};const options={base:'http://isolated.test',fetcher};const first=accountRequest('/auth/login',{},options);await started;const logout=accountRequest('/auth/logout',undefined,options);await accountRequest('/auth/session',undefined,{...options,method:'GET'});assert.deepEqual(order,['http://isolated.test/auth/login','http://isolated.test/auth/session']);release();await Promise.all([first,logout]);assert.equal(order.at(-1),'http://isolated.test/auth/logout');});
