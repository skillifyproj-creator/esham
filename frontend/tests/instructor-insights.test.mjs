import { test } from 'node:test';
import assert from 'node:assert/strict';
import { instructorQuery, loadInstructorInsights, reviewInstructorSubmission, localizedInstructorText } from '../src/services/instructorInsights.js';
test('instructor query encodes filters and omits missing values', () => {
 assert.equal(instructorQuery('performance', {courseId:'id', period:'30d', absent:undefined}), '/instructor/performance?courseId=id&period=30d');
 assert.equal(localizedInstructorText({titleAr:'Arabic'}, 'en'), 'Arabic');
});
test('real reads use authenticated API and review decisions go to server', async () => {
 const original=globalThis.fetch; const calls=[];
 globalThis.fetch=async (url, options) => {calls.push({url,options}); return {ok:true,status:200,json:async()=>({items:[]})};};
 try {
  assert.deepEqual(await loadInstructorInsights('submissions',{status:'awaitingReview'}),{items:[]});
  await reviewInstructorSubmission('abc','rejected','Revise');
  assert.equal(calls[0].options.credentials,'include'); assert.match(calls[0].url,/api\/instructor\/submissions\?status=awaitingReview$/);
  assert.equal(calls[1].options.method,'POST'); assert.equal(calls[1].options.headers['X-Requested-With'],'XMLHttpRequest');
  assert.deepEqual(JSON.parse(calls[1].options.body),{decision:'rejected',feedback:'Revise'});
  globalThis.fetch=async()=>({ok:false,status:403,json:async()=>({title:'Forbidden'})});
  await assert.rejects(reviewInstructorSubmission('abc','approved',''),/Forbidden/);
 } finally {globalThis.fetch=original;}
});
