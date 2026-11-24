// Client-contract tests amend synthetic public API responses only; no catalog/database writes.
require('./require-isolated-test-target.cjs')();
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../../artifacts/phase6a-results'),api='http://localhost:5216',web='http://localhost:5175';
const f=JSON.parse(fs.readFileSync(fs.readFileSync(path.resolve(root,'../phase5-isolated/current-fixture-path.txt'),'utf8').trim(),'utf8'));
const extra=JSON.parse(fs.readFileSync(path.join(root,'browser-fixtures.json'),'utf8'));const checks=[];let browser,current;
async function check(name,fn){current=name;await fn();checks.push({name,passed:true});console.log('PASS: '+name);}
(async()=>{
 browser=await chromium.launch({channel:'msedge',headless:true});const context=await browser.newContext();
 const logged=await context.request.post(api+'/auth/login',{headers:{Origin:web,'X-Requested-With':'XMLHttpRequest'},data:{email:f.learner.email,password:f.learner.password}});assert.equal(logged.status(),200);
 const rows=await(await context.request.get(api+'/api/courses/public')).json(),original=rows.find(x=>x.courseId===extra.recommendationId);assert.ok(original);
 let projection=rows,mode='empty',requests=0,held=false,release,entered;
 const page=await context.newPage(),errors=[];page.on('pageerror',error=>errors.push(error.message));page.setDefaultTimeout(15000);await page.addInitScript(()=>localStorage.setItem('esham-language','en'));
 await page.route(api+'/api/courses/public',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(projection)}));
 await page.route(web+'/ai/assistant/recommendations',async route=>{
  const body=route.request().postDataJSON();if(body.scope==='platform')requests++;
  const items=body.scope==='platform'&&mode==='target'&&!body.exclude.includes(extra.recommendationId)?[{id:'catalog:'+extra.recommendationId,courseId:extra.recommendationId,title:'Old provider title must never replace current catalog',url:'/courses/'+extra.recommendationId,source:'platform-course'}]:[];
  if(held&&body.scope==='platform'){held=false;entered();await new Promise(r=>release=r);}
  await route.fulfill({status:200,contentType:'application/json',body:JSON.stringify({items})}).catch(()=>{});
 });
 const card=()=>page.locator('section').filter({has:page.getByRole('heading',{name:'Your next step after this course'})}).locator(`a[href="/courses/${extra.recommendationId}"]`);
 async function reload(){const response=page.waitForResponse(r=>r.url()===api+'/api/courses/public');await page.evaluate(()=>window.dispatchEvent(new Event('esham:catalog-updated')));await response;await page.waitForTimeout(250);}
 function change(fields){projection=rows.map(row=>row.courseId===extra.recommendationId?{...original,...fields}:row);}
 await check('real completed enrollment uses only current public fallback objects',async()=>{await page.goto(web+`/learner/enrollments/${f.enrollmentId}`);await card().first().waitFor();assert.ok((await card().first().innerText()).length);});
 await check('identical reconstructed metadata does not issue recommendation loops',async()=>{const before=requests;projection=JSON.parse(JSON.stringify(rows));await reload();assert.equal(requests,before);});
 await check('same course GUID updates title level description and published-version projection',async()=>{
  const before=requests;change({titleEn:'Fresh metadata title',descriptionEn:'Fresh changed description',level:'advanced',publishedVersionId:extra.versionId});await reload();await card().filter({hasText:'Fresh metadata title'}).waitFor();assert.ok(requests>before);assert.equal(await card().filter({hasText:original.titleEn}).count(),0);
 });
 await check('category change with unchanged GUID recomputes fallback eligibility',async()=>{change({categoryId:extra.categoryId});await reload();assert.equal(await card().count(),0);});
 await check('ownership change with unchanged GUID excludes the learners authored course',async()=>{change({instructor:{...original.instructor,id:f.learner.id}});await reload();assert.equal(await card().count(),0);});
 await check('held old recommendation cannot restore stale ownership or old course objects',async()=>{
  mode='target';held=true;const received=new Promise(r=>entered=r);change({titleEn:'Old pending catalog title'});await reload();await received;
  change({instructor:{...original.instructor,id:f.learner.id},titleEn:'Now owned by learner'});await reload();assert.equal(await card().count(),0);release();await page.waitForTimeout(250);assert.equal(await card().count(),0);
 });
 await check('removal from public publication feed removes the card and cannot reuse cached objects',async()=>{change({titleEn:'Current public card'});await reload();await card().filter({hasText:'Current public card'}).waitFor();projection=rows.filter(row=>row.courseId!==extra.recommendationId);await reload();assert.equal(await card().count(),0);});
 assert.deepEqual(errors,[]);
 fs.writeFileSync(path.join(root,'browser-round2-freshness-results.json'),JSON.stringify({passed:checks.length,failed:0,skipped:0,publicResponses:'synthetic amendments of actual isolated API DTOs',checks},null,2));await browser.close();
})().catch(async error=>{fs.writeFileSync(path.join(root,'browser-round2-freshness-error-private.txt'),String(error?.stack||error));console.error('FAIL: '+current+' (private diagnostics retained)');await browser?.close();process.exitCode=1;});
