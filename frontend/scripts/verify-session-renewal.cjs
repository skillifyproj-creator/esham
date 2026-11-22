require('./require-isolated-test-target.cjs')();
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const api='http://localhost:5216',web='http://localhost:5175',root=process.env.ESHAM_PHASE4_ARTIFACTS||path.resolve(__dirname,'../../artifacts/phase4-hardening/browser');
const f=JSON.parse(fs.readFileSync(fs.readFileSync(path.join(root,'current-fixture-path.txt'),'utf8'),'utf8'));let browser;const checks=[];
async function login(c,u){const r=await c.request.post(api+'/auth/login',{headers:{Origin:web,'X-Requested-With':'XMLHttpRequest'},data:{email:u.email,password:u.password}});assert.equal(r.status(),200);}
(async()=>{
 const safety=await(await fetch(api+'/development/test-isolation')).json();assert.ok(safety.isolated&&safety.completionMutationsEnabled);
 browser=await chromium.launch({channel:'msedge',headless:true});
 for(const switchAccount of [false,true]){
  const context=await browser.newContext();await login(context,f.learner);const list=await(await context.request.get(api+'/me/certificates')).json(),cert=list.items[0];assert.ok(cert);
  const page=await context.newPage();await page.addInitScript(()=>localStorage.setItem('esham-language','en'));let release,captured;const hold=new Promise(r=>release=r),received=new Promise(r=>captured=r);
  await page.route(api+`/me/certificates/${cert.id}`,async route=>{const response=await route.fetch();assert.ok(!response.headers()['set-cookie'],'Passive response unexpectedly attempted cookie renewal');captured();await hold;await route.fulfill({response}).catch(()=>{});});
  await page.goto(web+`/learner/certificates/record/${cert.id}`);await received;
  if(switchAccount)await login(context,f.otherLearner);else assert.equal((await context.request.post(api+'/auth/logout')).status(),204);
  await page.evaluate(()=>window.dispatchEvent(new Event('focus')));
  if(switchAccount)await page.waitForFunction(id=>JSON.parse(localStorage.getItem('esham-account-profile-v1')||'{}').id===id,f.otherLearner.id);
  else await page.waitForURL(/login/, {waitUntil:'domcontentloaded'});
  release();const current=await context.request.get(api+'/auth/session');
  if(switchAccount){assert.equal(current.status(),200);assert.equal((await current.json()).profile.id,f.otherLearner.id);await page.getByRole('alert').waitFor();}
  else assert.equal(current.status(),401);
  assert.equal(await page.locator('.esham-certificate').count(),0);
  const name=switchAccount?'late response with original headers preserves new account':'late response with original headers cannot restore logout';checks.push({name,passed:true});console.log('PASS: '+name);await context.close();
 }
 fs.writeFileSync(path.join(root,'session-browser-results.json'),JSON.stringify({passed:checks.length,failed:0,checks},null,2));
})().catch(e=>{fs.writeFileSync(path.join(root,'session-browser-results.json'),JSON.stringify({passed:checks.length,failed:1,error:e.message,checks},null,2));console.error(e.message);process.exitCode=1;}).finally(async()=>{if(browser)await browser.close();});
