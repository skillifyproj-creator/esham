require('./require-isolated-test-target.cjs')();
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const api='http://localhost:5216',web='http://localhost:5175',root=process.env.ESHAM_PHASE4_ARTIFACTS?path.resolve(process.env.ESHAM_PHASE4_ARTIFACTS):path.resolve(__dirname,'../../artifacts/phase4-isolated');
const fixture=JSON.parse(fs.readFileSync(fs.readFileSync(path.join(root,'current-fixture-path.txt'),'utf8'),'utf8'));
const f=fixture,base=`/me/enrollments/${f.enrollmentId}`,checks=[];let browser,current='setup';
async function check(name,fn){current=name;await fn();checks.push({name,passed:true});console.log('PASS: '+name);}
const headers=user=>({Origin:web,'X-Requested-With':'XMLHttpRequest','X-Esham-Account-Id':user.id});
async function login(c,u){const r=await c.request.post(api+'/auth/login',{headers:headers(u),data:{email:u.email,password:u.password}});assert.equal(r.status(),200);assert.equal((await r.json()).profile.id,u.id);}
async function read(c,p){const r=await c.request.get(api+p);assert.equal(r.status(),200);return r.json();}
(async()=>{
 const safety=await(await fetch(api+'/development/test-isolation')).json();assert.ok(safety.isolated&&safety.completionMutationsEnabled&&safety.progressWritesEnabled);fs.writeFileSync(path.join(root,'gate-state.json'),JSON.stringify(safety,null,2));
 browser=await chromium.launch({channel:'msedge',headless:true});const learner=await browser.newContext(),instructor=await browser.newContext(),guest=await browser.newContext(),other=await browser.newContext(),admin=await browser.newContext();
 await login(learner,f.learner);await login(instructor,f.instructor);await login(other,f.otherLearner);await login(admin,f.admin);
 const page=await learner.newPage();page.setDefaultTimeout(20000);await page.addInitScript(()=>localStorage.setItem('esham-language','en'));
 let certificate;
 await check('actual gate and learner/owner/anonymous access isolation',async()=>{assert.equal((await guest.request.get(api+base+'/completion')).status(),401);assert.equal((await instructor.request.get(api+base+'/completion')).status(),403);assert.equal((await other.request.get(api+base+'/completion')).status(),404);assert.equal((await read(learner,base+'/completion')).status,'active');});
 await check('trusted origin and account preconditions reject forged reconciliation',async()=>{const data={expectedCourseVersionId:f.versionId};assert.equal((await learner.request.post(api+base+'/completion/reconcile',{data})).status(),403);assert.equal((await learner.request.post(api+base+'/completion/reconcile',{headers:headers(f.otherLearner),data})).status(),409);});
 await check('real lesson player completion remains pending required task approval',async()=>{
  await page.goto(`${web}/learner/enrollments/${f.enrollmentId}/learn`);await page.getByRole('button',{name:'Mark lesson complete',exact:true}).waitFor();
  const completion=page.waitForResponse(r=>r.url().endsWith('/completion')&&r.request().method()==='PUT');await page.getByRole('button',{name:'Mark lesson complete',exact:true}).click();assert.equal((await completion).status(),200);
  for(const id of [f.articleLessonId,f.videoLessonId]){const r=await learner.request.put(api+base+`/learning/lessons/${id}/completion`,{headers:headers(f.learner),data:{expectedCourseVersionId:f.versionId}});assert.equal(r.status(),200);}
  const state=await read(learner,base+'/completion');assert.equal(state.status,'active');assert.equal(state.earnedRequiredLessonCount,2);assert.equal(state.approvedRequiredTaskCount,0);
 });
 await check('instructor approval atomically completes and issues exactly one certificate',async()=>{
  const r=await instructor.request.post(api+`/api/instructor/submissions/${f.submissionId}/review`,{headers:headers(f.instructor),data:{decision:'approved',feedback:'Phase4 synthetic approval'}});assert.equal(r.status(),200);
  const c=await read(learner,base+'/completion');assert.equal(c.status,'completed');assert.ok(c.completedAt);assert.ok(c.certificate);certificate=c.certificate;
  const notices=(await read(learner,'/me/notifications')).items.filter(n=>n.notificationType==='certificate.issued');assert.equal(notices.length,1);assert.equal(notices[0].targetUrl,`/learner/certificates/record/${certificate.id}`);
  await page.goto(web+'/learner/notifications');await page.locator(`a[href="/learner/certificates/record/${certificate.id}"]`).first().waitFor();
  assert.equal((await instructor.request.post(api+`/api/instructor/submissions/${f.submissionId}/review`,{headers:headers(f.instructor),data:{decision:'approved'}})).status(),409);
 });
 await check('concurrent replay preserves certificate identity and timestamp',async()=>{
  const before=await read(learner,base+'/completion');const replay=await Promise.all(Array.from({length:5},()=>learner.request.post(api+base+'/completion/reconcile',{headers:headers(f.learner),data:{expectedCourseVersionId:f.versionId}})));
  for(const r of replay){assert.equal(r.status(),200);const c=await r.json();assert.equal(c.completedAt,before.completedAt);assert.equal(c.certificate.id,certificate.id);}assert.equal((await read(learner,'/me/certificates')).total,1);
 });
 await check('My Courses and enrollment show persisted completion and certificate link',async()=>{
  await page.goto(web+'/learner/courses');await page.getByText('Completed',{exact:true}).first().waitFor();await page.goto(`${web}/learner/enrollments/${f.enrollmentId}`);await page.getByRole('link',{name:'View certificate',exact:true}).waitFor();
 });
 await check('certificate details and PDF ignore forged local profile data',async()=>{
  await page.evaluate(()=>localStorage.setItem('esham-account-profile-v1',JSON.stringify({name:'FORGED CERTIFICATE NAME',nameEn:'FORGED'})));
  await page.goto(web+`/learner/certificates/record/${certificate.id}`);await page.getByRole('button',{name:'Download certificate PDF',exact:true}).waitFor();assert.match(await page.locator('.esham-certificate').innerText(),new RegExp(certificate.learnerNameSnapshot));assert.doesNotMatch(await page.locator('.esham-certificate').innerText(),/FORGED/);
  await page.getByLabel('Certificate language',{exact:true}).selectOption('en');const download=page.waitForEvent('download');await page.getByRole('button',{name:'Download certificate PDF',exact:true}).evaluate(b=>{b.click();b.click();});const d=await download;await d.saveAs(path.join(root,'synthetic-certificate-en.pdf'));assert.ok(fs.readFileSync(path.join(root,'synthetic-certificate-en.pdf')).subarray(0,5).equals(Buffer.from('%PDF-')));
 });
 await check('public verification is masked and omits all account/evidence identifiers',async()=>{
  const c=await read(guest,`/certificates/verify/${certificate.verificationCode}`);assert.equal(c.status,'issued');assert.match(c.learnerName,/\*\*\*/);assert.deepEqual(Object.keys(c).sort(),['courseTitleAr','courseTitleEn','issuedAt','issuer','learnerName','status']);const p=await guest.newPage();await p.goto(web+`/certificates/verify/${certificate.verificationCode}`);await p.getByText(/Valid certificate|شهادة سارية/).waitFor();assert.match(await p.locator('head meta[name="robots"]').getAttribute("content"),/noindex/);await p.close();
 });
 await check('cross-account details and account switching hide private certificates',async()=>{
  assert.equal((await other.request.get(api+`/me/certificates/${certificate.id}`)).status(),404);await login(learner,f.otherLearner);await page.reload();await page.getByRole('alert').waitFor();assert.doesNotMatch(await page.locator('main').innerText(),new RegExp(certificate.verificationCode));await login(learner,f.learner);await page.reload();await page.getByRole('button',{name:'Download certificate PDF',exact:true}).waitFor();
 });
 await check('delayed previous-account certificate response cannot restore private content',async()=>{
  let release,captured;const hold=new Promise(r=>release=r),received=new Promise(r=>captured=r),url=api+`/me/certificates/${certificate.id}`;
  await page.route(url,async route=>{const response=await route.fetch();assert.ok(!response.headers()['set-cookie'],'Passive response unexpectedly attempted cookie renewal');captured();await hold;const h={...response.headers()};await route.fulfill({response,headers:h}).catch(()=>{});});
  await page.reload();await received;await login(learner,f.otherLearner);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('esham-account-profile-v1')||'{}').id===id,f.otherLearner.id);release();
  await page.getByRole('alert').waitFor();assert.equal(await page.locator('.esham-certificate').count(),0);await page.unroute(url);await login(learner,f.learner);await page.reload();await page.getByRole('button',{name:'Download certificate PDF',exact:true}).waitFor();
 });
 await check('Arabic English and mobile desktop certificate layouts',async()=>{
  for(const [lang,width] of [['ar',390],['en',1440]]){await page.setViewportSize({width,height:1000});await page.getByLabel('Certificate language',{exact:true}).selectOption(lang);assert.equal(await page.locator('.esham-certificate').getAttribute('dir'),lang==='ar'?'rtl':'ltr');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));if(lang==='ar'){const d=page.waitForEvent('download');await page.getByRole('button',{name:'Download certificate PDF',exact:true}).click();await(await d).saveAs(path.join(root,'synthetic-certificate-ar.pdf'));}await page.screenshot({path:path.join(root,`certificate-${lang}.png`),fullPage:true});}
 });
 await check('revocation remains admin-only gated idempotent and visible in verification',async()=>{
  const route=api+`/admin/certificates/${certificate.id}/revoke`;assert.equal((await instructor.request.post(route,{headers:headers(f.instructor),data:{reason:'Synthetic reason'}})).status(),403);
  for(let i=0;i<2;i++)assert.equal((await admin.request.post(route,{headers:headers(f.admin),data:{reason:'Synthetic Phase4 revocation'}})).status(),200);
  await page.reload();await page.getByRole('button',{name:'Download certificate PDF',exact:true}).waitFor();assert.equal(await page.getByRole('button',{name:'Download certificate PDF',exact:true}).isDisabled(),true);assert.equal((await read(guest,`/certificates/verify/${certificate.verificationCode}`)).status,'revoked');
 });
 await check('stale issued view refreshes revocation before creating a PDF',async()=>{
  const stale=await learner.newPage();await stale.addInitScript(()=>localStorage.setItem('esham-language','en'));let first=true,downloads=0;
  stale.on('download',()=>downloads++);
  await stale.route(api+`/me/certificates/${certificate.id}`,async route=>{
   if(!first)return route.continue();const response=await route.fetch(),body=await response.json();
   // Transport fault injection only: emulate a previously issued DTO; the next request reads real revocation.
   const h={...response.headers()};await route.fulfill({response,headers:h,json:{...body,status:'issued'}});
  });
  await stale.goto(web+`/learner/certificates/record/${certificate.id}`);await stale.getByRole('button',{name:'Download certificate PDF',exact:true}).waitFor();first=false;await stale.getByRole('button',{name:'Download certificate PDF',exact:true}).click();
  await stale.waitForFunction(()=>[...document.querySelectorAll('button')].some(b=>b.textContent.includes('Download certificate PDF')&&b.disabled));assert.equal(downloads,0);await stale.close();
 });
 await check('expired sessions clear private certificate content',async()=>{await page.waitForLoadState('networkidle');await learner.clearCookies();await page.reload();await page.waitForFunction(()=>!document.querySelector(".esham-certificate"));assert.equal((await learner.request.get(api+`/me/certificates/${certificate.id}`)).status(),401);assert.doesNotMatch(await page.locator('body').innerText(),new RegExp(certificate.verificationCode));});
 await check('unknown status is explicit and issue date uses UTC in a western timezone',async()=>{
  const context=await browser.newContext({timezoneId:'America/Los_Angeles'});await login(context,f.learner);const p=await context.newPage();await p.addInitScript(()=>localStorage.setItem('esham-language','en'));
  await p.route(api+`/me/certificates/${certificate.id}`,async route=>{const response=await route.fetch();await route.fulfill({response,json:{...await response.json(),status:'legacy-unknown',issuedAt:'2026-11-21T00:01:00Z'}});});
  await p.goto(web+`/learner/certificates/record/${certificate.id}`);await p.getByText('Unknown status',{exact:true}).waitFor();assert.equal(await p.getByRole('button',{name:'Download certificate PDF',exact:true}).isDisabled(),true);assert.match(await p.locator('.esham-certificate').innerText(),/11\/21\/2026/);await context.close();
 });
 await check('public verification throttles excessive lookup attempts',async()=>{const responses=[];for(let i=0;i<23;i++)responses.push((await guest.request.get(api+'/certificates/verify/'+'F'.repeat(48))).status());assert.ok(responses.includes(429));});
 fs.writeFileSync(path.join(root,'browser-results.json'),JSON.stringify({passed:checks.length,failed:0,checks},null,2));console.log(`Phase4 browser: ${checks.length} passed`);
})().catch(e=>{fs.writeFileSync(path.join(root,'browser-results.json'),JSON.stringify({passed:checks.length,failed:1,current,error:e.message,checks},null,2));console.error('FAIL: '+current+' '+e.message);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});
