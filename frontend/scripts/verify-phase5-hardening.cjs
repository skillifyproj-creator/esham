require('./require-isolated-test-target.cjs')();
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const root=path.resolve(__dirname,'../../artifacts/phase5-isolated'),api='http://localhost:5216',web='http://localhost:5175';
const f=JSON.parse(fs.readFileSync(fs.readFileSync(path.join(root,'current-fixture-path.txt'),'utf8').trim(),'utf8'));
const headers=u=>({Origin:web,'X-Requested-With':'XMLHttpRequest','X-Esham-Account-Id':u.id});
const deferred=()=>{let resolve;return{promise:new Promise(r=>resolve=r),resolve:()=>resolve()};};
let browser,current;const checks=[];
async function login(c,u){const r=await c.request.post(api+'/auth/login',{headers:headers(u),data:{email:u.email,password:u.password}});assert.equal(r.status(),200);return(await r.json()).profile;}
async function check(name,run){current=name;await run();checks.push({name,passed:true});console.log('PASS: '+name);}
(async()=>{
 const gate=await(await fetch(api+'/development/test-isolation')).json();assert.ok(gate.isolated&&gate.phase5ReviewsEnabled&&gate.phase5AccountSecurityEnabled);
 browser=await chromium.launch({channel:'msedge',headless:true});
 if(process.env.ESHAM_PHASE5_HARDENING_BROWSER==='legacy'){
  await check('legacy Saved Reviews edit uses owned purchase while retaining null historical attribution',async()=>{
   const c=await browser.newContext();await login(c,f.learner);const page=await c.newPage();await page.addInitScript(()=>localStorage.setItem('esham-language','en'));
   const read=await c.request.get(api+`/me/enrollments/${f.enrollmentId}/review`),before=await read.json();assert.equal(before.review.courseVersionId,null);assert.equal(before.purchasedCourseVersionId,f.versionId);
   await page.goto(web+'/learner/reviews');const card=page.locator('article').filter({hasText:before.review.comment});await card.getByRole('button',{name:'Edit',exact:true}).click();
   await page.locator('.reviews-form textarea').fill('A historical review edited through Saved Reviews with a real owned purchase precondition.');
   const response=page.waitForResponse(r=>r.url()===api+`/me/enrollments/${f.enrollmentId}/review`&&r.request().method()==='PUT');await page.locator('.reviews-form').getByRole('button',{name:'Save',exact:true}).click();const saved=await response;assert.equal(saved.status(),200);assert.equal(saved.request().postDataJSON().expectedCourseVersionId,f.versionId);assert.equal((await saved.json()).review.courseVersionId,null);
   page.once('dialog',d=>d.accept());const removed=page.waitForResponse(r=>r.url()===api+`/me/enrollments/${f.enrollmentId}/review`&&r.request().method()==='DELETE');await page.locator('article').filter({hasText:'A historical review edited through Saved Reviews'}).getByRole('button',{name:'Withdraw review',exact:true}).click();assert.equal((await removed).status(),200);await c.close();
  });
 }else for(const mode of ['save-response','save-refresh','failed-response','failed-refresh','persona-refresh','aba-save-refresh']){
  await check(`AccountPage rejects stale ${mode} across session switching`,async()=>{
   const c=await browser.newContext(),a=await login(c,f.learner),page=await c.newPage();page.setDefaultTimeout(12000);await page.addInitScript(()=>localStorage.setItem('esham-language','en'));
   const persona=mode==='persona-refresh';await page.goto(web+(persona?'/learner/settings':'/learner/profile'));
   if(persona)await page.getByRole('combobox',{name:'Account role',exact:true}).waitFor();else await page.locator('#onboarding-name').waitFor();
   const held=deferred(),release=deferred();let holdSession=false,sessionHeld=false,mutationHeld=false;
   await page.route(api+'/auth/session',async route=>{
    if(holdSession&&!sessionHeld){sessionHeld=true;const result=await route.fetch(),snapshot=await result.json();snapshot.profile.name='STALE ACCOUNT A SERVER';held.resolve();await release.promise;await route.fulfill({response:result,json:snapshot});}else await route.continue();
   });
   await page.route(api+(persona?'/me/role':'/me'),async route=>{
    assert.equal(route.request().headers()['x-esham-account-id'],a.id);
    if(mode.endsWith('response')){mutationHeld=true;held.resolve();await release.promise;}else holdSession=true;
    await route.fulfill({status:mode.startsWith('failed')?400:204,headers:{'Access-Control-Allow-Origin':web,'Access-Control-Allow-Credentials':'true'},body:mode.startsWith('failed')?'{}':undefined});
   });
   if(persona){await page.getByRole('combobox',{name:'Account role',exact:true}).selectOption('learner');await page.getByRole('button',{name:'Save account type',exact:true}).click();}
   else{await page.locator('#onboarding-name').fill('STALE ACCOUNT A DRAFT');await page.getByRole('button',{name:'Save changes',exact:true}).click();}
   await Promise.race([held.promise,new Promise((_,reject)=>setTimeout(()=>reject(Error('Delayed response barrier not reached')),15000))]);const b=await login(c,f.otherLearner);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
   await page.waitForFunction(id=>JSON.parse(localStorage.getItem('esham-account-profile-v1')||'{}').id===id,b.id);
   await page.waitForFunction(id=>document.querySelector('.account-page')?.dataset.accountId===id,b.id);
   if(persona)await page.waitForFunction(()=>document.querySelector('.account-field select')?.value==='learner');else await page.waitForFunction(name=>document.querySelector('#onboarding-name')?.value===name,b.name);
   let expected=b;
   if(mode.startsWith('aba')){expected=await login(c,f.learner);await page.evaluate(()=>window.dispatchEvent(new Event('focus')));await page.waitForFunction(id=>document.querySelector('.account-page')?.dataset.accountId===id,expected.id);await page.waitForFunction(name=>document.querySelector('#onboarding-name')?.value===name,expected.name);await page.locator('#onboarding-name').fill('NEW ACCOUNT A EPOCH DRAFT');}
   release.resolve();await page.waitForTimeout(200);
   assert.ok(!await page.getByText('Your profile and categories are saved to your account.',{exact:true}).count());assert.ok(!await page.getByText('Account type changed with all your existing data and history preserved.',{exact:true}).count());
   if(!persona){assert.equal(await page.locator('#onboarding-name').inputValue(),mode.startsWith('aba')?'NEW ACCOUNT A EPOCH DRAFT':expected.name);
    await page.unroute(api+'/me');let checked=false;
    await page.route(api+'/me',async route=>{assert.equal(route.request().headers()['x-esham-account-id'],expected.id);assert.equal(route.request().postDataJSON().name,mode.startsWith('aba')?'NEW ACCOUNT A EPOCH DRAFT':expected.name);checked=true;await route.fulfill({status:204});});
    const saved=page.waitForResponse(r=>r.url()===api+'/me'&&r.request().method()==='PATCH');await page.getByRole('button',{name:'Save changes',exact:true}).click();await saved;assert.ok(checked);
   }
   assert.ok(mutationHeld||sessionHeld);await c.close();
  });
 }
 const output=process.env.ESHAM_PHASE5_HARDENING_BROWSER==='legacy'?'hardening-legacy-browser-results.json':'hardening-race-browser-results.json';fs.writeFileSync(path.join(root,output),JSON.stringify({passed:checks.length,failed:0,checks},null,2));await browser.close();
})().catch(async error=>{fs.writeFileSync(path.join(root,'hardening-browser-error-private.txt'),String(error?.stack||error));console.error('FAIL: '+current+' (private diagnostics retained)');await browser?.close();process.exitCode=1;});
