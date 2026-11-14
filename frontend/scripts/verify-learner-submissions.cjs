require('./require-isolated-test-target.cjs')();
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const api='http://localhost:5216',frontend='http://localhost:5175',root=path.resolve(__dirname,'../../artifacts/phase3-isolated');
const f=JSON.parse(fs.readFileSync(fs.readFileSync(path.join(root,'current-fixture-path.txt'),'utf8'),'utf8'));
const headers={Origin:frontend,'X-Requested-With':'XMLHttpRequest','X-Esham-Account-Id':f.learner.id};
const base=`/me/enrollments/${f.enrollmentId}`,taskUrl=`${frontend}/learner/enrollments/${f.enrollmentId}/tasks/${f.taskId}`;
let browser,current='setup';const checks=[];
async function check(name,action){current=name;await action();checks.push({name,passed:true});console.log('PASS: '+name);}
async function login(context,user){const r=await context.request.post(api+'/auth/login',{headers,data:{email:user.email,password:user.password}});assert.equal(r.status(),200);assert.equal((await r.json()).profile.id,user.id);}
async function read(context,url){const r=await context.request.get(api+url);assert.equal(r.status(),200);return r.json();}
(async()=>{
 const safety=await(await fetch(api+'/development/test-isolation')).json();assert.ok(safety.isolated&&safety.submissionMutationsEnabled&&safety.mediaIsolated);
 browser=await chromium.launch({channel:'msedge',headless:true});const learner=await browser.newContext(),owner=await browser.newContext(),guest=await browser.newContext();
 for(const context of [learner,owner,guest])await context.route('**/*',route=>{const r=route.request();return !['GET','HEAD','OPTIONS'].includes(r.method())&&!r.url().startsWith(api+'/')?route.abort():route.continue();});
 await login(learner,f.learner);await login(owner,f.instructor);
 const page=await learner.newPage(),instructor=await owner.newPage();page.setDefaultTimeout(20000);instructor.setDefaultTimeout(20000);
 for(const p of [page,instructor])await p.addInitScript(()=>{if(!localStorage.getItem('esham-language'))localStorage.setItem('esham-language','en');});
 let attempt;
 await check('membership ownership and real task contract',async()=>{
  assert.equal((await guest.request.get(api+base+'/tasks')).status(),401);assert.equal((await owner.request.get(api+base+'/tasks')).status(),403);
  const tasks=await read(learner,base+'/tasks');assert.equal(tasks.items[0].id,f.taskId);assert.equal(tasks.mutationsEnabled,true);
  await page.goto(taskUrl);await page.getByRole('heading',{name:'Practical work',exact:true}).waitFor();assert.match(await page.locator('main').innerText(),/Explain your work/);
 });
 await check('real draft creation and double click protection',async()=>{
  const response=page.waitForResponse(r=>r.url()===api+base+`/tasks/${f.taskId}/submissions`&&r.request().method()==='POST');
  await page.getByRole('button',{name:'Create new attempt',exact:true}).evaluate(b=>{b.click();b.click();});const r=await response;assert.equal(r.status(),200);attempt=await r.json();
  await page.getByRole('button',{name:'Save draft',exact:true}).waitFor();assert.equal((await read(learner,base+'/submissions')).totalCount,1);
  assert.equal((await owner.request.get(api+`/api/instructor/submissions/${attempt.id}`)).status(),404);
 });
 await check('server draft persistence and safe work URL',async()=>{
  await page.getByLabel('Answer or explanation',{exact:true}).fill('A persisted practical answer');await page.getByLabel('HTTP/HTTPS work URL',{exact:true}).fill('https://example.test/work');
  const saved=page.waitForResponse(r=>r.url().endsWith('/draft')&&r.request().method()==='PUT');await page.getByRole('button',{name:'Save draft',exact:true}).click();assert.equal((await saved).status(),200);
  await page.reload();await page.getByRole('button',{name:'Save draft',exact:true}).waitFor();assert.equal(await page.getByLabel('Answer or explanation',{exact:true}).inputValue(),'A persisted practical answer');
  attempt=await read(learner,base+`/submissions/${attempt.id}`);
 });
 await check('real upload replay removal and detached identity protection',async()=>{
  const before=attempt;const request=page.waitForRequest(r=>r.url().endsWith('/attachments')&&r.method()==='POST');const response=page.waitForResponse(r=>r.url().endsWith('/attachments')&&r.request().method()==='POST');
  await page.getByLabel('Upload file',{exact:true}).setInputFiles({name:'work.txt',mimeType:'text/plain',buffer:Buffer.from('Private text answer')});
  const intent=(await request).postDataBuffer().toString('utf8').match(/name="uploadId"\r\n\r\n([0-9a-f-]+)/i)[1];assert.equal((await response).status(),200);await page.getByRole('link',{name:'work.txt',exact:true}).waitFor();
  attempt=await read(learner,base+`/submissions/${attempt.id}`);const file=attempt.attachments[0];
  const repeat=()=>learner.request.post(api+base+`/submissions/${attempt.id}/attachments`,{headers,multipart:{uploadId:intent,expectedTaskVersionId:f.versionId,expectedDraftToken:before.draftToken,file:{name:'work.txt',mimeType:'text/plain',buffer:Buffer.from('Private text answer')}}});
  assert.equal((await repeat()).status(),200);assert.equal((await read(learner,base+`/submissions/${attempt.id}`)).attachments.length,1);
  const download=await learner.request.get(api+file.contentUrl);assert.equal(download.status(),200);assert.match(download.headers()['content-disposition'],/^attachment/);assert.match(download.headers()['cache-control'],/no-store/);
  assert.equal((await guest.request.get(api+file.contentUrl)).status(),401);assert.equal((await owner.request.get(api+`/api/instructor/submissions/${attempt.id}/attachments/${file.id}`)).status(),404);
  const removed=page.waitForResponse(r=>r.request().method()==='DELETE');await page.getByRole('button',{name:'Remove',exact:true}).click();assert.equal((await removed).status(),200);await page.getByRole('link',{name:'work.txt',exact:true}).waitFor({state:'detached'});
  assert.equal((await repeat()).status(),409);assert.equal((await learner.request.get(api+file.contentUrl)).status(),404);
 });
 await check('all approved file formats upload and five-file cap is enforced',async()=>{
  const images=await page.evaluate(()=>{const canvas=document.createElement('canvas');canvas.width=2;canvas.height=2;canvas.getContext('2d').fillRect(0,0,2,2);return ['png','jpeg','webp'].map(type=>({type,data:canvas.toDataURL('image/'+type).split(',')[1]}));});
  const files=[{name:'answer.pdf',mimeType:'application/pdf',buffer:fs.readFileSync(path.join(root,'synthetic.pdf'))},...images.map(i=>({name:'image.'+i.type,mimeType:'image/'+i.type,buffer:Buffer.from(i.data,'base64')})),{name:'answer.docx',mimeType:'application/vnd.openxmlformats-officedocument.wordprocessingml.document',buffer:fs.readFileSync(path.join(root,'synthetic.docx'))}];
  for(const file of files){const response=page.waitForResponse(r=>r.url().endsWith('/attachments')&&r.request().method()==='POST');await page.getByLabel('Upload file',{exact:true}).setInputFiles(file);assert.equal((await response).status(),200,file.name);await page.getByRole('link',{name:file.name,exact:true}).waitFor();}
  attempt=await read(learner,base+`/submissions/${attempt.id}`);assert.equal(attempt.attachments.length,5);
  const extra=await learner.request.post(api+base+`/submissions/${attempt.id}/attachments`,{headers,multipart:{uploadId:crypto.randomUUID(),expectedTaskVersionId:f.versionId,expectedDraftToken:attempt.draftToken,file:{name:'sixth.txt',mimeType:'text/plain',buffer:Buffer.from('sixth')}}});assert.equal(extra.status(),409);assert.equal((await extra.json()).code,'attachment_limit');
 });
 await check('finalization freezes payload and emits one instructor event',async()=>{
  const response=page.waitForResponse(r=>r.url().endsWith('/submit')&&r.request().method()==='POST');await page.getByRole('button',{name:'Submit task',exact:true}).evaluate(b=>{b.click();b.click();});assert.equal((await response).status(),200);
  await page.getByRole('button',{name:'Submit task',exact:true}).waitFor({state:'detached'});
  const replay=await learner.request.post(api+base+`/submissions/${attempt.id}/submit`,{headers,data:{expectedTaskVersionId:f.versionId,expectedDraftToken:attempt.draftToken}});assert.equal(replay.status(),200);
  const notices=await read(owner,'/me/notifications');assert.equal(notices.items.filter(n=>n.notificationType==='task.submitted').length,1);
  const detail=await read(owner,`/api/instructor/submissions/${attempt.id}`);assert.equal(detail.items[0].courseVersionId,f.versionId);assert.equal(detail.items[0].instructions.en,'Explain your work');assert.equal(detail.items[0].files.length,5);
 });
 async function assess(decision,feedback){await instructor.goto(frontend+'/instructor/submissions');await instructor.getByRole('button').filter({hasText:'Practical work'}).first().click();await instructor.getByRole('heading',{name:'Original task context',exact:true}).waitFor();await instructor.getByLabel('Review feedback',{exact:true}).fill(feedback);
  const response=instructor.waitForResponse(r=>r.url().endsWith('/review')&&r.request().method()==='POST');await instructor.getByRole('button',{name:decision==='approved'?'Approve task':'Request revision',exact:true}).click();assert.equal((await response).status(),200);}
 await check('instructor rejection preserves feedback and a new numbered attempt',async()=>{
  await assess('rejected','Please revise the explanation');await page.reload();await page.getByText('Please revise the explanation',{exact:true}).waitFor();
  const response=page.waitForResponse(r=>r.url().endsWith(`/tasks/${f.taskId}/submissions`)&&r.request().method()==='POST');await page.getByRole('button',{name:'Create new attempt',exact:true}).click();attempt=await(await response).json();assert.equal(attempt.attemptNumber,2);
  await page.getByLabel('Answer or explanation',{exact:true}).fill('A revised persisted answer');let saved=page.waitForResponse(r=>r.url().endsWith('/draft'));await page.getByRole('button',{name:'Save draft',exact:true}).click();await saved;
  let submitted=page.waitForResponse(r=>r.url().endsWith('/submit'));await page.getByRole('button',{name:'Submit task',exact:true}).click();await submitted;
 });
 await check('instructor approval updates authoritative progress and notification navigation',async()=>{
  await assess('approved','Approved practical work');await page.reload();await page.getByText('Approved practical work',{exact:true}).waitFor();
  const learning=await read(learner,base+'/learning');assert.equal(learning.versionState.tasks[0].isApproved,true);assert.equal(learning.versionState.isCourseCompleted,false);
  const notices=await read(learner,'/me/notifications');assert.equal(notices.items.filter(n=>n.notificationType==='task.assessed').length,2);assert.ok(notices.items.filter(n=>n.notificationType==='task.assessed').every(n=>n.targetUrl.startsWith(`/learner/enrollments/${f.enrollmentId}/submissions/`)));
 });
 await check('optional rejected attempt retains the previous logical approval',async()=>{
  let created=page.waitForResponse(r=>r.url().endsWith(`/tasks/${f.taskId}/submissions`)&&r.request().method()==='POST');await page.getByRole('button',{name:'Create new attempt',exact:true}).click();attempt=await(await created).json();assert.equal(attempt.attemptNumber,3);assert.equal(attempt.isOptionalAtCreation,true);
  await page.getByLabel('Answer or explanation',{exact:true}).fill('Optional new work');let saved=page.waitForResponse(r=>r.url().endsWith('/draft'));await page.getByRole('button',{name:'Save draft',exact:true}).click();await saved;
  let submitted=page.waitForResponse(r=>r.url().endsWith('/submit'));await page.getByRole('button',{name:'Submit task',exact:true}).click();await submitted;await assess('rejected','Optional work feedback');
  assert.equal((await read(learner,base+'/tasks')).items[0].isApproved,true);
  assert.equal((await read(learner,base+`/submissions/${attempt.id}`)).task.isApproved,true);
 });
 await check('delayed previous-account attempt cannot restore private form or files',async()=>{
  let ready,release;const captured=new Promise(r=>ready=r),hold=new Promise(r=>release=r);const endpoint=api+base+`/submissions/${attempt.id}`;
  await page.route(endpoint,async route=>{const response=await route.fetch();ready();await hold;const h={...response.headers()};delete h['set-cookie'];await route.fulfill({response,headers:h});});
  await page.goto(frontend+`/learner/enrollments/${f.enrollmentId}/submissions/${attempt.id}`);await captured;await login(learner,f.otherLearner);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.waitForFunction(id=>JSON.parse(localStorage.getItem('esham-account-profile-v1')||'{}').id===id,f.otherLearner.id);release();await page.waitForTimeout(250);
  assert.equal(await page.locator('.task-editor').count(),0);assert.equal((await learner.request.get(endpoint)).status(),404);await page.unroute(endpoint);
 });
 await check('expired session removes protected submission data',async()=>{
  await login(learner,f.learner);await page.goto(taskUrl);await page.locator('.task-editor').waitFor();await learner.clearCookies();await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  await page.locator('.task-editor').waitFor({state:'detached'});assert.equal((await learner.request.get(api+base+'/tasks')).status(),401);
 });
 await login(learner,f.learner);
 for(const language of ['ar','en'])for(const width of [390,1440])await check(`task history layout ${language} ${width}`,async()=>{
  await page.setViewportSize({width,height:900});await page.goto(frontend);await page.evaluate(lang=>localStorage.setItem('esham-language',lang),language);await page.goto(taskUrl);await page.locator('.task-editor').waitFor();
  assert.equal(await page.evaluate(()=>document.documentElement.dir),language==='ar'?'rtl':'ltr');assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));await page.screenshot({path:path.join(root,`tasks-${language}-${width}.png`)});
 });
})().catch(error=>{checks.push({name:current,passed:false,error:error.message});console.error('FAIL: '+current+': '+error.message);process.exitCode=1;})
.finally(async()=>{fs.writeFileSync(path.join(root,'browser-results.json'),JSON.stringify(checks,null,2));if(browser)await browser.close();});
