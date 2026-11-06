import test from 'node:test';
import assert from 'node:assert/strict';
import { listAnnouncements,saveAnnouncement,setAnnouncementStatus,fileCourseReport,resolveCourseReport,loadCourseSafety,issueWarning,submitAppeal,decideAppeal,listAdminActivity } from '../src/services/platformModerationApi.js';
test('moderation requests preserve server IDs, credentials, headers and optimistic state',async()=>{
 const original=globalThis.fetch,calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});return Response.json({ok:true})};
 try{await listAnnouncements(true);await saveAnnouncement(null,{titleEn:'Announcement'});await setAnnouncementStatus('a','published','server-version');await fileCourseReport('c',{courseVersionId:'v',reason:'harmful'});await resolveCourseReport('c','r','resolved','Evidence reviewed','reviewing');await loadCourseSafety('c','v');await issueWarning('c',{courseVersionId:'v',verified:true});await submitAppeal('c','w','Context');await decideAppeal('c','a','accepted','Reasoning');await listAdminActivity();
 assert.deepEqual(calls.map(x=>x.url),['/api/admin/announcements','/api/admin/announcements','/api/admin/announcements/a/status','/api/courses/c/reports','/api/courses/c/reports/r','/api/courses/c/safety?versionId=v','/api/courses/c/warnings','/api/courses/c/appeals','/api/courses/c/appeals/a/decision','/api/admin/activity']);
 for(const {options} of calls){assert.equal(options.credentials,'include');assert.equal(options.headers['X-Requested-With'],'XMLHttpRequest')}
 assert.equal(JSON.parse(calls[4].options.body).expectedStatus,'reviewing');assert.equal(JSON.parse(calls[2].options.body).expectedVersion,'server-version');
 }finally{globalThis.fetch=original}
});
test('failed moderation never becomes a local success',async()=>{const original=globalThis.fetch;try{globalThis.fetch=async()=>Response.json({title:'Only GeneralAdmin may decide appeals'},{status:403});await assert.rejects(decideAppeal('c','a','accepted','Evidence reviewed'),/Only GeneralAdmin/);globalThis.fetch=async()=>Response.json({title:'Incident already has a warning'},{status:409});await assert.rejects(issueWarning('c',{}),/already has a warning/);}finally{globalThis.fetch=original}});
