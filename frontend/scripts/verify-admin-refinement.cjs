require('./require-isolated-test-target.cjs')();
const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(os.tmpdir(),'esham-curriculum-browser/node_modules/playwright'));
(async()=>{
 const api='http://localhost:5216',web='http://localhost:5175';
 const f=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'esham-isolated-review-fixture.json')));assert.equal(f.isolated,true);
 const browser=await chromium.launch({channel:'msedge',headless:true}),errors=[],results=[];
 try {
 for(const role of ['general','reviewer']) {
  const ctx=await browser.newContext(),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
  // Authentication is confined to the disposable test server; every page mutation is blocked.
  const cred=f.credentials[role],login=await ctx.request.post(api+'/auth/login',{data:{email:cred.email,password:cred.password},headers:{'Origin':web,'X-Requested-With':'XMLHttpRequest'}});assert.equal(login.status(),200);
  await ctx.route('**/api/**',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.abort());
  const prefix=role==='general'?'/admin':'/category-admin';
  const routes=role==='general'?['','/admins','/users','/courses',`/courses/${f.courseId}/review?version=${f.versionId}`,'/categories','/reports','/moderation','/announcements','/notifications','/activity']:['','/courses',`/courses/${f.courseId}/review?version=${f.versionId}`,'/moderation','/activity','/notifications'];
  for(const language of ['ar','en']) for(const width of [1440,900,390]) for(const route of routes){
   await p.setViewportSize({width,height:1000});await p.goto(web+'/');await p.evaluate(l=>localStorage.setItem('esham-language',l),language);await p.goto(web+prefix+route);await p.waitForLoadState('networkidle');
   const shell=p.locator('.admin-workspace');await shell.waitFor();assert.equal(await shell.getAttribute('dir'),language==='ar'?'rtl':'ltr');assert.equal(await p.locator('footer').count(),0);
   assert.equal(await p.locator('.page-error-boundary').count(),0);assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),`Overflow ${role} ${route} ${language} ${width}`);
   const sidebar=p.locator('.admin-sidebar');
   if(width>900){
    const box=await sidebar.boundingBox();assert(language==='ar'?box.x>width/2:box.x<1,`Wrong sidebar edge ${language}`);
    assert.equal(Math.round(box.width),264);await p.locator('.admin-collapse-button').click();assert.equal(Math.round((await sidebar.boundingBox()).width),80);assert.equal(await p.locator('.admin-collapse-button').getAttribute('aria-expanded'),'false');
    assert(await p.locator('.admin-nav-link').first().getAttribute('aria-label'));await p.locator('.admin-collapse-button').click();assert.equal(Math.round((await sidebar.boundingBox()).width),264);
   }else{
    assert.equal(await sidebar.getAttribute('inert'),'');await p.locator('.admin-menu-button').click();assert.equal(await sidebar.getAttribute('aria-modal'),'true');
    assert(await p.evaluate(()=>document.querySelector('.admin-sidebar').contains(document.activeElement)));
    const links=sidebar.locator('a[href],button:not(:disabled)');await links.last().focus();await p.keyboard.press('Tab');assert(await p.evaluate(()=>document.querySelector('.admin-sidebar').contains(document.activeElement)));
    await p.keyboard.press('Escape');assert.equal(await p.locator('.admin-menu-button').getAttribute('aria-expanded'),'false');assert(await p.locator('.admin-menu-button').evaluate(el=>el===document.activeElement));
    await p.locator('.admin-menu-button').click();await p.locator('.admin-drawer-backdrop').click({position:{x:language==='ar'?5:width-5,y:500}});assert.equal(await p.locator('.admin-menu-button').getAttribute('aria-expanded'),'false');
   }
   if(route===''||route==='/users'||route==='/moderation')await p.screenshot({path:path.join(os.tmpdir(),`esham-admin-ui-${role}-${route.slice(1)||'dashboard'}-${language}-${width}.png`),fullPage:true});
   results.push({role,route:prefix+route,language,width});if(route===routes[routes.length-1])console.log(`Checked ${role} ${language} ${width}px`);
  }
  // Route navigation still uses the existing links and keeps collapsed desktop state.
  await p.setViewportSize({width:1440,height:1000});await p.goto(web+prefix);await p.waitForLoadState('networkidle');await p.locator('.admin-collapse-button').click();await p.locator(`.admin-nav-link[href="${prefix}/courses"]`).click();await p.waitForURL('**'+prefix+'/courses');assert.equal(await p.locator('.admin-workspace.sidebar-collapsed').count(),1);
  if(role==='general'){
   await p.goto(web+'/admin/announcements');await p.waitForLoadState('networkidle');await p.getByRole('button',{name:/Create announcement|إنشاء إعلان/}).click();await p.locator('dialog[open]').waitFor();await p.keyboard.press('Escape');assert.equal(await p.locator('dialog[open]').count(),0);
   await p.goto(web+'/admin/categories');await p.waitForLoadState('networkidle');await p.locator('.sa-page-head button').click();await p.locator('dialog[open]').waitFor();await p.screenshot({path:path.join(os.tmpdir(),'esham-admin-ui-category-dialog.png')});await p.keyboard.press('Escape');assert.equal(await p.locator('dialog[open]').count(),0);
   await p.goto(web+'/admin/users');await p.waitForLoadState('networkidle');await p.locator('tbody .sa-text-button').first().click();await p.locator('dialog[open]').waitFor();await p.keyboard.press('Escape');
  }
  await p.setViewportSize({width:390,height:900});await p.goto(web+prefix);await p.waitForLoadState('networkidle');await p.locator('.admin-menu-button').click();await p.locator(`.admin-nav-link[href="${prefix}/courses"]`).click();await p.waitForURL('**'+prefix+'/courses');assert.equal(await p.locator('.admin-menu-button').getAttribute('aria-expanded'),'false');
  let mode='error';await ctx.route('**/api/course-reviews*',async r=>{if(mode==='loading')await new Promise(resolve=>setTimeout(resolve,1000));return r.fulfill({status:mode==='error'?503:200,contentType:'application/json',body:mode==='error'?JSON.stringify({title:'Isolated visual error state'}):'[]'});});
  await p.goto(web+prefix+'/courses');await p.getByRole('alert').getByText('Isolated visual error state').waitFor();assert.equal(await p.locator('.review-queue .review-panel').count(),0);
  mode='empty';await p.reload();await p.getByText(/No matching submissions|لا توجد إصدارات مطابقة/).waitFor();
  mode='loading';await p.reload({waitUntil:'domcontentloaded'});await p.locator('.course-review-workflow [role="status"]').waitFor();await p.waitForLoadState('networkidle');
  assert.equal(await p.locator('.admin-sidebar').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(238, 229, 225)');assert.equal(await p.locator('.admin-main').evaluate(e=>getComputedStyle(e).backgroundColor),'rgb(250, 247, 245)');
  assert.equal(await p.locator('.admin-sidebar').evaluate(e=>getComputedStyle(e).borderInlineEndColor),'rgb(226, 215, 210)');
  await ctx.close();
 }
 assert.deepEqual(errors,[]);
 const report={result:'PASS',routeLayouts:results.length,routes:17,checks:['RTL/LTR at 1440/900/390','desktop collapse/expand and navigation','mobile inert background, focus trap, Escape, backdrop and focus return','announcement/category/account dialogs','loading, empty and API error states','resolved palette and border tokens','footer absence and no horizontal overflow'],results};
 fs.writeFileSync(path.join(os.tmpdir(),'esham-admin-ui-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,results:undefined}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
