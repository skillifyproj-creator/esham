require('./require-isolated-test-target.cjs')();
const {chromium}=require(process.env.PLAYWRIGHT_MODULE || 'playwright');
const fs=require('node:fs'),os=require('node:os'),path=require('node:path'),assert=require('node:assert/strict');
const fixturePath=process.env.ESHAM_REVIEW_FIXTURE || path.join(os.tmpdir(),'esham-review-browser-fixture.json');
const f=JSON.parse(fs.readFileSync(fixturePath,'utf8'));
// Mutation checks must never reuse a hosted/shared fixture or its API server.
assert(process.env.ESHAM_REVIEW_FIXTURE && process.env.ESHAM_API_URL, 'Explicit isolated fixture and API URL are required.');
assert.equal(f.isolated, true, 'Only isolated database fixtures may be mutated.');
const frontend=process.env.ESHAM_FRONTEND_URL || 'http://localhost:5175',api=process.env.ESHAM_API_URL;
const target=new URL(api);
assert(['localhost','127.0.0.1'].includes(target.hostname) && target.port && target.port!=='5206', 'Use a separate local API port for isolated mutation checks.');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});const contexts={},pages={},errors=[],results=[];
 const root='/api/courses/'+f.courseId,review=root+'/review';
 async function call(who,url,method='GET',body,status=200){
  const response=await contexts[who].request.fetch(api+url,{method,data:body,headers:{'X-Requested-With':'XMLHttpRequest'}});
  assert.equal(response.status(),status,method+' '+url+': '+await response.text());const bodyText=await response.text();return bodyText?JSON.parse(bodyText):null;
 }
 async function page(who,url,width=1440){
  const p=pages[who];await p.setViewportSize({width,height:1000});await p.goto(frontend+url);return p;
 }
 async function status(p,value){await p.locator('[data-review-status="'+value+'"]').waitFor({timeout:30000});}
 async function screenshot(p,name){await p.evaluate(()=>document.fonts.ready);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'Horizontal overflow: '+name);
  await p.screenshot({path:path.join(os.tmpdir(),'esham-review-'+name+'.png'),fullPage:true});
 }
 async function layouts(){
  const snapshot=await call('instructor',review),version=snapshot.version.id;
  for(const who of ['instructor','reviewer','general']) {
   const route=who==='instructor'?'/instructor/courses/'+f.courseId+'/review':(who==='general'?'/admin':'/category-admin')+'/courses/'+f.courseId+'/review?version='+version;
   for(const language of ['ar','en']) for(const width of [1440,390]) {
    // Initialize the website origin before setting its language preference.
    await page(who,'/');await pages[who].evaluate(l=>localStorage.setItem('esham-language',l),language);
    const p=await page(who,route,width);await status(p,snapshot.version.reviewStatus);
    assert.equal(await p.locator('html').getAttribute('dir'),language==='ar'?'rtl':'ltr');
    if(who!=='instructor') assert.equal(await p.locator('footer').count(),0,'Admin layouts must have no Footer');
    if(who==='general') assert.equal(await p.locator('textarea').count(),0,'GeneralAdmin retains oversight-only permission');
    await screenshot(p,who+'-'+language+'-'+width);
   }
  }
  assert.deepEqual(errors,[]);
  results.push('12 Instructor/CategoryAdmin/GeneralAdmin layouts: Arabic RTL and English LTR at 1440px and 390px; no overflow or Admin Footer');
 }
 try{
  for(const who of ['guest',...Object.keys(f.credentials)]){
   contexts[who]=await browser.newContext({viewport:{width:1440,height:1000}});await contexts[who].addInitScript(()=>{if(!localStorage.getItem('esham-language'))localStorage.setItem('esham-language','ar')});
   pages[who]=await contexts[who].newPage();pages[who].on('pageerror',e=>errors.push(e.message));
   if(who!=='guest'){const c=f.credentials[who];await call(who,'/auth/login','POST',{email:c.email,password:c.password});await call(who,'/auth/session');}
  }
  if(process.env.ESHAM_REVIEW_LAYOUT_ONLY==='1'){await layouts();console.log(JSON.stringify({result:'PASS',checks:results}));return;}
  await page('guest','/');await pages.guest.locator('main#home').waitFor();await call('guest','/auth/session','GET',undefined,401);
  const initial=await call('instructor',review);assert(initial.version.titleEn.startsWith('Temporary Review Workflow '));assert(initial.eligibility.canSubmit);
  await call('guest',review+'/submit','POST',{expectedVersionId:f.versionId},401);
  await call('instructor','/api/courses/'+f.incompleteId+'/review/submit','POST',{expectedVersionId:f.incompleteVersionId},400);
  await call('other',review+'/submit','POST',{expectedVersionId:f.versionId},403);
  await call('outsider',review+'/versions/'+f.versionId,'GET',undefined,403);
  const ip=await page('instructor','/instructor/courses/'+f.courseId+'/review');
  await status(ip,'draft');await screenshot(ip,'instructor-draft-ar-desktop');
  await ip.getByRole('button',{name:'إرسال للمراجعة',exact:true}).click();await ip.getByRole('button',{name:'تأكيد الإرسال',exact:true}).click();await status(ip,'pending');
  await ip.reload();await status(ip,'pending');assert.equal(await ip.getByRole('button',{name:'إرسال للمراجعة',exact:true}).count(),0);
  await call('instructor',review+'/submit','POST',{expectedVersionId:f.versionId},409);
  await call('guest','/api/courses/public/'+f.courseId,'GET',undefined,404);
  const pending=await call('reviewer',review+'/versions/'+f.versionId);assert(pending.canReview);assert(pending.sections.length&&pending.tasks.length);
  assert.equal((await call('outsider','/api/course-reviews?status=pending')).some(x=>x.courseId===f.courseId),false);
  await call('outsider',review+'/versions/'+f.versionId+'/decision','POST',{decision:'approved'},403);
  await call('general',review+'/versions/'+f.versionId);await call('general',review+'/versions/'+f.versionId+'/decision','POST',{decision:'approved'},403);
  const rp=await page('reviewer','/category-admin/courses?status=pending');
  await rp.locator('a[href*="'+f.courseId+'/review?version='+f.versionId+'"]').waitFor();await screenshot(rp,'queue-ar-desktop');
  await page('reviewer','/category-admin/courses/'+f.courseId+'/review?version='+f.versionId);
  await status(rp,'pending');await rp.locator('.review-cover').waitFor();
  assert(await rp.locator('.review-cover').evaluate(e=>e.complete&&e.naturalWidth>0));
  await screenshot(rp,'submission-ar-desktop');await rp.setViewportSize({width:390,height:844});await screenshot(rp,'submission-ar-mobile');
  await call('reviewer',review+'/versions/'+f.versionId+'/decision','POST',{decision:'rejected',comment:' '},400);
  await rp.locator('textarea').fill('Please expand the practical explanation.');await rp.getByRole('button',{name:'رفض',exact:true}).click();await status(rp,'rejected');
  await ip.reload();await status(ip,'rejected');assert(await ip.getByText('Please expand the practical explanation.',{exact:true}).count());
  await screenshot(ip,'instructor-feedback-ar-desktop');await ip.getByRole('button',{name:'إنشاء مسودة للتعديل',exact:true}).click();await ip.waitForURL('**/curriculum');
  const revised=await call('instructor',review),v2=revised.version.id;assert.notEqual(v2,f.versionId);assert.equal(revised.version.versionNumber,2);
  await call('instructor',root+'/draft','PATCH',{titleEn:'Temporary approved review version'});
  const race=await Promise.all([1,2].map(()=>contexts.instructor.request.post(api+review+'/submit',{data:{expectedVersionId:v2},headers:{'X-Requested-With':'XMLHttpRequest'}})));assert.deepEqual(race.map(r=>r.status()).sort(),[200,409]);
  const approvalRace=await Promise.all([1,2].map(()=>contexts.reviewer.request.post(api+review+'/versions/'+v2+'/decision',{data:{decision:'approved',comment:'Verified temporary course'},headers:{'X-Requested-With':'XMLHttpRequest'}})));assert.deepEqual(approvalRace.map(r=>r.status()).sort(),[200,409]);
  const pub=await call('guest','/api/courses/public/'+f.courseId);assert.equal(pub.publishedVersionId,v2);assert.equal(pub.titleEn,'Temporary approved review version');
  assert.equal((await call('instructor',review+'/versions/'+f.versionId)).version.reviewStatus,'rejected');
  await page('instructor','/instructor/courses/'+f.courseId+'/review',390);await status(ip,'approved');await screenshot(ip,'published-ar-mobile');
  await call('instructor',review+'/revision','POST',{expectedVersionId:v2});
  const v3=(await call('instructor',review)).version.id;await call('instructor',root+'/draft','PATCH',{titleEn:'PRIVATE temporary revision'});
  assert.equal((await call('guest','/api/courses/public/'+f.courseId)).titleEn,'Temporary approved review version');
  await call('instructor',review+'/submit','POST',{expectedVersionId:v3});await call('reviewer',review+'/versions/'+v3+'/decision','POST',{decision:'changes_requested',comment:'Keep the published version intact.'});
  const final=await call('instructor',review);assert.equal(final.publishedVersionId,v2);assert.equal(final.version.reviewStatus,'changes_requested');
  assert.equal((await call('guest','/api/courses/public/'+f.courseId)).publishedVersionId,v2);
  await page('reviewer','/category-admin/activity');await rp.locator('.review-panel').first().waitFor();
  for(const language of ['ar','en']){await ip.evaluate(l=>localStorage.setItem('esham-language',l),language);await page('instructor','/instructor/courses/'+f.courseId+'/review',390);await status(ip,'changes_requested');await screenshot(ip,'final-'+language+'-mobile');}
  await layouts();
  assert.deepEqual(errors,[]);results.push('guest landing','ineligible and unauthorized submissions blocked','pending survives refresh','scoped category review','rejection feedback','immutable revision cloning','concurrent duplicate submit blocked','concurrent decisions serialize','exact approved version public','later private/rejected snapshots isolated','audit feed','Arabic desktop/mobile and English mobile');
  fs.writeFileSync(path.join(os.tmpdir(),'esham-review-verification-result.json'),JSON.stringify({result:'PASS',courseId:f.courseId,rejectedVersion:f.versionId,publishedVersion:v2,changesRequestedVersion:v3,checks:results},null,2));
  console.log(JSON.stringify({result:'PASS',courseId:f.courseId,publishedVersion:v2,checks:results}));
 }catch(e){console.error('Routes',Object.fromEntries(Object.entries(pages).map(([k,p])=>[k,p.url()])));throw e}finally{await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
