// Uses the real isolated API/cookie/gateway/catalog; AI provider responses are synthetic.
require('./require-isolated-test-target.cjs')();
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../../artifacts/phase6a-results'),api='http://localhost:5216',web='http://localhost:5175';
const fixtures=directory=>JSON.parse(fs.readFileSync(fs.readFileSync(path.join(directory,'current-fixture-path.txt'),'utf8').trim(),'utf8'));
const f=fixtures(path.resolve(root,'../phase5-isolated')),extra=JSON.parse(fs.readFileSync(path.join(root,'browser-fixtures.json'),'utf8'));
const checks=[],errors=[];let browser,current;const run=Date.now();
const headers={'X-Requested-With':'XMLHttpRequest',Origin:web};
async function check(name,fn){current=name;await fn();checks.push({name,passed:true});console.log('PASS: '+name);}
async function login(context,user){const r=await context.request.post(api+'/auth/login',{headers,data:{email:user.email,password:user.password}});assert.equal(r.status(),200);const session=await r.json();assert.equal(session.profile.id,user.id);return session;}
async function pageFor(context,language='en'){const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.addInitScript(lang=>{if(!localStorage.getItem('esham-language'))localStorage.setItem('esham-language',lang);},language);return page;}
async function send(page,text,answer='Synthetic answer through the real authenticated gateway'){
 await page.locator('textarea').fill(text);const response=page.waitForResponse(r=>r.url().endsWith('/ai/assistant/chat')&&r.request().postDataJSON()?.message===text);
 await page.getByRole('button',{name:/^(Send|إرسال)$/}).click();const result=await response;assert.equal(result.status(),200);await page.getByText(answer,{exact:true}).last().waitFor();return result.json();
}
async function fresh(page){await page.getByRole('button',{name:/^(New chat|محادثة جديدة)$/}).click();await page.locator('textarea').waitFor();}
function tinyPdf(){const objects=['<< /Type /Catalog /Pages 2 0 R >>','<< /Type /Pages /Kids [3 0 R] /Count 1 >>','<< /Type /Page /Parent 2 0 R /MediaBox [0 0 300 300] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>','<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];const stream='BT /F1 12 Tf 20 250 Td (Synthetic PDF explanation fixture) Tj ET';objects.push(`<< /Length ${stream.length} >>\nstream\n${stream}\nendstream`);let text='%PDF-1.4\n',offsets=[0];for(let i=0;i<objects.length;i++){offsets.push(Buffer.byteLength(text));text+=`${i+1} 0 obj\n${objects[i]}\nendobj\n`;}const start=Buffer.byteLength(text);text+=`xref\n0 6\n0000000000 65535 f \n`+offsets.slice(1).map(n=>String(n).padStart(10,'0')+' 00000 n \n').join('')+`trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n${start}\n%%EOF`;return Buffer.from(text);}
(async()=>{
 const isolation=await(await fetch(api+'/development/test-isolation')).json();assert.ok(isolation.isolated);
 browser=await chromium.launch({channel:'msedge',headless:true});
 const learner=await browser.newContext(),instructor=await browser.newContext(),general=await browser.newContext(),category=await browser.newContext(),guest=await browser.newContext();
 await check('actual independent role memberships, private headers and cross-role API denial',async()=>{
  const a=await login(learner,f.learner),b=await login(instructor,f.instructor),g=await login(general,extra.general),c=await login(category,extra.categoryAdmin);
  assert.ok(a.profile.roles.includes('Learner')&&a.profile.roles.includes('Instructor'));assert.deepEqual(b.profile.roles,['Instructor']);assert.deepEqual(g.profile.roles,['GeneralAdmin']);assert.deepEqual(c.profile.roles,['CategoryAdmin']);
  assert.equal((await general.request.get(api+'/api/admin/overview')).status(),200);assert.equal((await category.request.get(api+'/api/admin/overview')).status(),403);
  assert.equal((await learner.request.get(api+'/api/admin/users')).status(),403);assert.equal((await instructor.request.get(api+'/api/admin/users')).status(),403);
  const session=await learner.request.get(api+'/auth/session');assert.match(session.headers()['cache-control'],/no-store/);assert.equal(session.headers()['set-cookie'],undefined);
  assert.equal((await general.request.post(api+`/api/courses/${extra.courseId}/review/versions/${extra.versionId}/decision`,{headers,data:{decision:'approved',comment:null}})).status(),403);
 });
 await check('catalog GUIDs and authorized CategoryAdmin scope are real backend data',async()=>{
  const catalog=await(await guest.request.get(api+'/api/courses/public')).json();assert.ok(catalog.some(c=>c.courseId===extra.recommendationId));assert.ok(catalog.every(c=>/^[0-9a-f-]{36}$/i.test(c.courseId)));
  const queue=await category.request.get(api+'/api/course-reviews');assert.equal(queue.status(),200);const text=await queue.text();assert.ok(text.includes(extra.courseId));assert.ok(!text.includes(f.courseId));
 });
 await check('guest policy chat uses public knowledge without a provider call',async()=>{
  const p=await pageFor(guest);await p.goto(web+'/assistant');await p.locator('textarea').waitFor();await p.locator('textarea').fill('How many points does a course cost?');
  const response=p.waitForResponse(r=>r.url().endsWith('/ai/assistant/chat'));await p.getByRole('button',{name:'Send',exact:true}).click();const r=await response;assert.equal(r.status(),200);const answer=await r.json();assert.ok(answer.answer.includes('20'));assert.ok(answer.sources.some(s=>s.id==='platform:points'));await p.close();
 });
 await check('owned instructor UI submission and assigned CategoryAdmin publication preserve existing authority',async()=>{
  const context=await browser.newContext();await login(context,extra.instructor);const ownerPage=await pageFor(context);
  const submitPath=api+`/api/courses/${extra.draftCourseId}/review/submit`;
  assert.equal((await instructor.request.post(submitPath,{headers,data:{expectedVersionId:extra.draftVersionId}})).status(),403);
  assert.equal((await general.request.post(submitPath,{headers,data:{expectedVersionId:extra.draftVersionId}})).status(),403);
  await ownerPage.goto(web+`/instructor/courses/${extra.draftCourseId}/review`);await ownerPage.getByRole('button',{name:'Submit for review',exact:true}).click();
  const submitted=ownerPage.waitForResponse(r=>r.url()===submitPath&&r.request().method()==='POST');await ownerPage.getByRole('button',{name:'Confirm submission',exact:true}).click();assert.equal((await submitted).status(),200);
  const adminPage=await pageFor(category);await adminPage.goto(web+`/category-admin/courses/${extra.draftCourseId}/review`);
  const decided=adminPage.waitForResponse(r=>r.url().endsWith(`/review/versions/${extra.draftVersionId}/decision`)&&r.request().method()==='POST');await adminPage.getByRole('button',{name:'Approve and publish version',exact:true}).click();assert.equal((await decided).status(),200);
  const published=await guest.request.get(api+`/api/courses/public/${extra.draftCourseId}`);assert.equal(published.status(),200);assert.equal((await published.json()).publishedVersionId,extra.draftVersionId);
  await ownerPage.close();await context.close();await adminPage.close();
 });
 for(const [name,context,url]of[['GeneralAdmin',general,'/admin'],['CategoryAdmin',category,'/category-admin'],['Instructor',instructor,'/instructor']]){
  await check(name+' bilingual responsive dashboard loads without script errors',async()=>{
   const page=await pageFor(context);for(const [language,width]of[['en',1440],['ar',390]]){await page.setViewportSize({width,height:900});await page.goto(web+url);await page.evaluate(lang=>localStorage.setItem('esham-language',lang),language);await page.reload();await page.getByRole('heading').first().waitFor();assert.equal(await page.locator('html').getAttribute('dir'),language==='ar'?'rtl':'ltr');assert.ok(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+2));}await page.close();
  });
 }
 const page=await pageFor(learner);await page.goto(web+'/learner/assistant');await page.locator('textarea').waitFor();
 await check('chat sends through real authenticated gateway with English response and trusted catalog',async()=>{await send(page,`English learning question ${run}`);});
 await check('provider error is shown and retry succeeds',async()=>{
  await fresh(page);const text=`[retry] ${run}`;await page.locator('textarea').fill(text);await page.getByRole('button',{name:'Send',exact:true}).click();await page.getByRole('button',{name:'Try again',exact:true}).waitFor();await page.getByRole('button',{name:'Try again',exact:true}).click();await page.getByText('Synthetic answer through the real authenticated gateway',{exact:true}).waitFor();
 });
 await check('text document extraction and explanation traverse the actual gateway',async()=>{await fresh(page);await page.locator('input[type=file]').setInputFiles({name:'synthetic.txt',mimeType:'text/plain',buffer:Buffer.from('Synthetic English and Arabic تعليم content')});await send(page,`Explain text ${run}`);});
 await check('PDF extraction and explanation traverse the actual gateway',async()=>{await fresh(page);await page.locator('input[type=file]').setInputFiles({name:'synthetic.pdf',mimeType:'application/pdf',buffer:tinyPdf()});await send(page,`Explain PDF ${run}`);});
 await check('image conversion and explanation traverse the actual gateway',async()=>{
  await fresh(page);const png=await page.evaluate(()=>{const c=document.createElement('canvas');c.width=64;c.height=64;c.getContext('2d').fillRect(0,0,64,64);return c.toDataURL('image/png').split(',')[1];});
  await page.locator('input[type=file]').setInputFiles({name:'synthetic.png',mimeType:'image/png',buffer:Buffer.from(png,'base64')});await send(page,`Explain image ${run}`);
 });
 await check('Arabic chat and RTL render without replacing identity',async()=>{await fresh(page);await page.getByRole('button',{name:'العربية',exact:true}).click();await send(page,`اشرح التعلّم ${run}`,'إجابة اختبار عربية من المسار الفعلي');assert.equal(await page.locator('html').getAttribute('dir'),'rtl');await page.getByRole('button',{name:'English',exact:true}).click();});
 await check('new chat cancels an in-flight response without restoring messages',async()=>{
  await fresh(page);const text=`[delay] cancel ${run}`;await page.locator('textarea').fill(text);const sent=page.waitForRequest(r=>r.url().endsWith('/ai/assistant/chat'));await page.getByRole('button',{name:'Send',exact:true}).click();await sent;await fresh(page);await page.waitForTimeout(8500);assert.equal(await page.locator('.message').count(),0);
 });
 await check('account switch aborts old chat and hides all previous-account messages',async()=>{
  const text=`[delay] previous account ${run}`;await page.locator('textarea').fill(text);const sent=page.waitForRequest(r=>r.url().endsWith('/ai/assistant/chat'));await page.getByRole('button',{name:'Send',exact:true}).click();await sent;
  await login(learner,f.otherLearner);const refreshed=page.waitForResponse(r=>r.url()===api+'/auth/session');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await refreshed;await page.waitForTimeout(500);assert.equal(await page.getByText(text,{exact:true}).count(),0);await send(page,`New account question ${run}`);
 });
 await check('expired session cannot submit private attachments and untrusted origins are rejected',async()=>{
  await learner.request.post(api+'/auth/logout',{headers});await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForTimeout(500);
  const denied=await guest.request.post(web+'/ai/assistant/chat',{headers:{Origin:web,'Content-Type':'application/json','X-AI-Request':'esham-assistant','X-Esham-Account-Id':f.otherLearner.id},data:{message:'stale',language:'en',document:{name:'synthetic',text:'private',truncated:false}}});assert.equal(denied.status(),409);
  const forbidden=await guest.request.post('http://127.0.0.1:8002/assistant/chat',{headers:{Origin:'https://foreign.invalid','Content-Type':'application/json'},data:{message:'hello',language:'en'}});assert.equal(forbidden.status(),403);
 });
 await check('completed enrollment recommendations use GUIDs, exclude owned courses and survive refresh',async()=>{
  await login(learner,f.learner);await page.goto(web+`/learner/enrollments/${f.enrollmentId}`);await page.getByRole('heading',{name:'Your next step after this course'}).waitFor();
  const panel=page.locator('section').filter({has:page.getByRole('heading',{name:'Your next step after this course'})});await panel.getByRole('link',{name:'View course',exact:true}).first().waitFor();
  const links=await panel.locator('a[href^="/courses/"]').evaluateAll(nodes=>nodes.map(n=>n.getAttribute('href')));assert.ok(links.length);assert.ok(links.every(link=>/^\/courses\/[0-9a-f-]{36}$/i.test(link)&&!link.endsWith(f.courseId)));
  await page.reload();await page.getByRole('heading',{name:'Your next step after this course'}).waitFor();await panel.getByRole('link',{name:'View course',exact:true}).first().waitFor();
  await page.evaluate(()=>localStorage.setItem('esham-language','ar'));await page.setViewportSize({width:390,height:900});await page.reload();await page.getByRole('heading',{name:'خطوتك التالية بعد الدورة'}).waitFor();assert.equal(await page.locator('html').getAttribute('dir'),'rtl');assert.ok(await page.locator('body').evaluate(e=>e.scrollWidth<=innerWidth+2));
  await page.evaluate(()=>localStorage.setItem('esham-language','en'));await page.setViewportSize({width:1440,height:900});await page.reload();await page.getByRole('heading',{name:'Your next step after this course'}).waitFor();
 });
 await check('delayed recommendation response cannot restore another account suggestions',async()=>{
  let release,entered;const held=new Promise(resolve=>release=resolve),received=new Promise(resolve=>entered=resolve);
  await page.route(web+'/ai/assistant/recommendations',async route=>{
   const response=await route.fetch();if(route.request().postDataJSON().scope==='platform'){entered();await held;}
   await route.fulfill({response}).catch(()=>{}); // Expected aborted fetch after the account switch.
  });
  try {
   await page.reload();await received;await login(learner,f.otherLearner);const switched=page.waitForResponse(r=>r.url()===api+'/auth/session');await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await switched;await page.waitForTimeout(500);
   assert.equal(await page.getByRole('heading',{name:'Your next step after this course'}).count(),0);release();await page.waitForTimeout(500);assert.equal(await page.getByRole('heading',{name:'Your next step after this course'}).count(),0);
  }finally{release();await page.unroute(web+'/ai/assistant/recommendations');}
 });
 await check('no uncaught browser script errors across cross-role AI journeys',async()=>assert.deepEqual(errors,[]));
 fs.writeFileSync(path.join(root,'browser-phase6a-results.json'),JSON.stringify({passed:checks.length,failed:0,skipped:0,provider:'synthetic',checks},null,2));await browser.close();
})().catch(async error=>{fs.writeFileSync(path.join(root,'browser-phase6a-error-private.txt'),String(error?.stack||error));console.error('FAIL: '+current+' (private diagnostics retained)');await browser?.close();process.exitCode=1;});
