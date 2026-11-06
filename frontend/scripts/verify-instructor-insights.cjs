require('./require-isolated-test-target.cjs')();
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(os.tmpdir(),'esham-curriculum-browser/node_modules/playwright'));
(async()=>{
 const f=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'esham-isolated-review-fixture.json'))), fixture=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'esham-instructor-fixture.json')));
 const api=process.env.ESHAM_TEST_API||'http://localhost:5216', frontend=process.env.ESHAM_TEST_FRONTEND||'http://localhost:5175';
 assert(f.isolated&&fixture.isolated);assert.equal(new URL(api).hostname,'localhost');assert.equal(new URL(api).port,'5216');assert.equal(new URL(frontend).port,'5175');
 const browser=await chromium.launch({channel:'msedge',headless:true}),errors=[],checks=[];
 try {
  const ctx=await browser.newContext(),page=await ctx.newPage();page.on('pageerror',e=>errors.push(e.message));
  async function request(route,method='GET',data,status=200,context=ctx){const r=await context.request.fetch(api+route,{method,data,headers:{'Origin':frontend,'X-Requested-With':'XMLHttpRequest'}});assert.equal(r.status(),status,route+': '+await r.text());return r.status()===200?r.json():null;}
  const guest=await browser.newContext();await request('/api/instructor/dashboard','GET',undefined,401,guest);await guest.close();
  const creds=f.credentials.instructor;await request('/auth/login','POST',{email:creds.email,password:creds.password});
  const stats=await request('/api/instructor/dashboard');assert(stats.learners.enrolled>=1);assert.equal(stats.stats.averageWatchHours,null);
  const reviews=await request('/api/instructor/reviews');assert(reviews.items.some(r=>r.comment==='Real isolated instructor integration review'));
  const submissions=await request('/api/instructor/submissions?status=awaitingReview');assert(submissions.items.some(s=>s.id===fixture.submissionId));
  for(const language of ['ar','en']) for(const width of [1440,390]) for(const route of ['/instructor','/instructor/performance','/instructor/feedback','/instructor/submissions']){
   await page.setViewportSize({width,height:1000});await page.goto(frontend+'/');await page.evaluate(l=>localStorage.setItem('esham-language',l),language);await page.goto(frontend+route);await page.waitForLoadState('networkidle');
   assert.equal(await page.locator('html').getAttribute('dir'),language==='ar'?'rtl':'ltr');
   assert.equal(await page.locator('[role="alert"]').count(),0,route+': '+await page.locator('body').innerText());
   assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow ${route} ${language} ${width}`);
   if(route.endsWith('/feedback')){assert((await page.locator('body').innerText()).includes('Real isolated instructor integration review'),page.url()+' '+(await page.locator('body').innerText()).slice(0,700));assert.equal(await page.locator('textarea').count(),0);}
   if(route.endsWith('/submissions')){await page.locator('.report-list-button').first().click();await page.locator('textarea').waitFor();}
   await page.screenshot({path:path.join(os.tmpdir(),`esham-instructor-${route.split('/').pop()||'dashboard'}-${language}-${width}.png`),fullPage:true});
  }
  checks.push('16 RTL/LTR desktop/mobile layouts; populated dashboard, performance, read-only ratings and submission detail');
  await request(`/api/instructor/submissions/${fixture.submissionId}/review`,'POST',{decision:'approved',feedback:'Isolated browser verified'});
  await request(`/api/instructor/submissions/${fixture.submissionId}/review`,'POST',{decision:'approved'},409);
  const outsider=await browser.newContext();const c=f.credentials.other;await request('/auth/login','POST',{email:c.email,password:c.password},200,outsider);await request(`/api/instructor/performance?courseId=${fixture.courseId}`,'GET',undefined,404,outsider);await request(`/api/instructor/submissions/${fixture.submissionId}`,'GET',undefined,404,outsider);const empty=await outsider.newPage();await empty.goto(frontend+'/');await empty.evaluate(()=>localStorage.setItem('esham-language','en'));
  await empty.goto(frontend+'/instructor/feedback');await empty.waitForLoadState('networkidle');assert.equal(await empty.locator('.instructor-feedback-card').count(),0);
  await empty.goto(frontend+'/instructor/submissions');await empty.getByText('No submissions match this status.',{exact:true}).waitFor();
  await outsider.close();
  await page.route('**/api/instructor/reviews?*',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({title:'Temporary isolated API failure'})}));
  await page.goto(frontend+'/instructor/feedback');await page.getByRole('alert').getByText('Temporary isolated API failure').waitFor();assert.equal(await page.locator('.instructor-feedback-card').count(),0);
  checks.push('real empty states and API failure do not display demo reviews/submissions');
  checks.push('guest 401, foreign instructor 404, persisted review and duplicate 409');assert.deepEqual(errors,[]);
  console.log(JSON.stringify({result:'PASS',isolated:true,checks}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
