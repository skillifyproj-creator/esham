require('./require-isolated-test-target.cjs')();
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(os.tmpdir(),'esham-curriculum-browser/node_modules/playwright'));
(async()=>{
 const f=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'esham-isolated-review-fixture.json')));assert.equal(f.isolated,true);
 const api='http://localhost:5216',web='http://localhost:5175',browser=await chromium.launch({channel:'msedge',headless:true}),contexts={},pages={},errors=[],checks=[];
 try {
 async function call(who,url,method='GET',data,status=200){const r=await contexts[who].request.fetch(api+url,{method,data,headers:{Origin:web,'X-Requested-With':'XMLHttpRequest'}});assert.equal(r.status(),status,url+': '+await r.text());return status===200||status===201?r.json():null;}
 for(const who of ['guest','general','reviewer','outsider','instructor']){contexts[who]=await browser.newContext();pages[who]=await contexts[who].newPage();pages[who].on('pageerror',e=>errors.push(e.message));if(who!=='guest'){const c=f.credentials[who];await call(who,'/auth/login','POST',{email:c.email,password:c.password});}}
 await call('guest','/api/admin/overview','GET',undefined,401);await call('reviewer','/api/admin/overview','GET',undefined,403);await call('instructor','/api/admin/categories','GET',undefined,403);
 const usersBefore=(await call('general','/api/admin/users?pageSize=100')).items.map(u=>({id:u.id,roles:u.roles}));
 const p=pages.general;await p.goto(web+'/');await p.evaluate(()=>localStorage.setItem('esham-language','en'));await p.goto(web+'/admin/categories');await p.getByRole('button',{name:/Add category/}).click();
 const title='Isolated Admin Integration '+Date.now(),dialog=p.locator('dialog[open]');await dialog.locator('[name="nameAr"]').fill(title+' AR');await dialog.locator('[name="nameEn"]').fill(title);await dialog.locator('[name="descriptionAr"]').fill('وصف تحقق معزول');await dialog.locator('[name="descriptionEn"]').fill('Isolated persisted description');await dialog.locator('[name="displayOrder"]').fill('7');await dialog.locator('[name="parentCategoryId"]').selectOption(f.categoryId);await dialog.locator(`input[value="${f.credentials.reviewer.id}"]`).check();await dialog.getByRole('button',{name:'Save',exact:true}).click();
 let row=p.getByRole('row').filter({hasText:title});await row.waitFor();const categories=await call('general','/api/admin/categories'),created=categories.find(c=>c.nameEn===title);assert(created);assert.equal(created.parentCategoryId,f.categoryId);assert.equal(created.displayOrder,7);assert.equal(created.descriptionEn,'Isolated persisted description');assert(created.adminIds.includes(f.credentials.reviewer.id));
 const scoped=await call('reviewer','/api/admin/categories');assert(scoped.some(c=>c.id===created.id));assert(!(await call('outsider','/api/admin/categories')).some(c=>c.id===created.id));
 const stale=await call('general',`/api/admin/categories/${created.id}/assignments`);
 await call('reviewer',`/api/admin/categories/${created.id}/assignments`,'PUT',{userIds:[f.credentials.outsider.id],expectedVersion:stale.version},403);
 await call('reviewer','/api/categories','POST',{nameAr:'Forbidden isolated category',nameEn:'Forbidden isolated category',displayOrder:0},403);
 await row.getByRole('button',{name:/Edit.*assign/}).click();await dialog.locator('[name="nameEn"]').fill(title+' Edited');await dialog.locator(`input[value="${f.credentials.reviewer.id}"]`).uncheck();await dialog.locator(`input[value="${f.credentials.outsider.id}"]`).check();await dialog.getByRole('button',{name:'Save',exact:true}).click();await p.locator('dialog[open]').waitFor({state:'detached'});
 await call('general',`/api/admin/categories/${created.id}/assignments`,'PUT',{userIds:[],expectedVersion:stale.version},409);
 assert(!(await call('reviewer','/api/admin/categories')).some(c=>c.id===created.id));assert((await call('outsider','/api/admin/categories')).some(c=>c.id===created.id));
 row=p.getByRole('row').filter({hasText:title+' Edited'});await row.waitFor();await row.getByRole('button',{name:'Deactivate',exact:true}).click();await row.getByRole('button',{name:'Activate',exact:true}).waitFor();assert.equal((await call('general','/api/admin/categories')).find(c=>c.id===created.id).isActive,false);await row.getByRole('button',{name:'Activate',exact:true}).click();await row.getByRole('button',{name:'Deactivate',exact:true}).waitFor();await p.reload();assert.equal((await call('general','/api/admin/categories')).find(c=>c.id===created.id).isActive,true);
 assert.deepEqual((await call('general','/api/admin/users?pageSize=100')).items.map(u=>({id:u.id,roles:u.roles})),usersBefore);checks.push('real isolated category create/edit/deactivate/reactivate and metadata persistence, assignment grant/revoke, role/account preservation and stale409');
 for(const language of ['ar','en'])for(const width of [1440,390])for(const route of ['/admin','/admin/reports','/admin/categories','/category-admin']){
  const who=route.startsWith('/category-admin')?'reviewer':'general',page=pages[who];await page.setViewportSize({width,height:1000});await page.goto(web+'/');await page.evaluate(l=>localStorage.setItem('esham-language',l),language);await page.goto(web+route);await page.waitForLoadState('networkidle');assert.equal(await page.locator('footer').count(),0);assert.equal(await page.locator('html').getAttribute('dir'),language==='ar'?'rtl':'ltr');assert.equal(await page.getByRole('alert').count(),0);assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));await page.screenshot({path:path.join(os.tmpdir(),`esham-admin-integration-${route.split('/').pop()}-${language}-${width}.png`),fullPage:true});
 }
 const overview=await call('general','/api/admin/overview');assert.equal(Object.values(overview.statusCounts).reduce((a,b)=>a+b,0),overview.totalCourses);
 for(const c of Object.values(contexts))await c.route('**/api/admin/overview',r=>r.fulfill({status:503,contentType:'application/json',body:JSON.stringify({title:'Isolated overview failure'})}));
 await p.goto(web+'/admin');await p.getByRole('alert').getByText('Isolated overview failure').waitFor();assert.equal(await p.locator('.sa-stat-card').count(),0);
 await p.unroute('**/api/admin/overview');
 const empty={totalCourses:0,pendingReviewCourses:0,statusCounts:{published:0,pending:0,rejected:0,draft:0,approved:0,changes_requested:0}};
 await p.route('**/api/admin/overview',r=>r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(empty)}));
 for(const route of ['categories','category-admins','activity'])await p.route('**/api/admin/'+route,r=>r.fulfill({status:200,contentType:'application/json',body:'[]'}));
 await p.goto(web+'/admin/categories');await p.locator('.sa-empty').waitFor();assert.equal(await p.locator('tbody tr').count(),1);
 await p.unroute('**/api/admin/overview');await p.route('**/api/admin/overview',async r=>{await new Promise(resolve=>setTimeout(resolve,2000));return r.fulfill({status:200,contentType:'application/json',body:JSON.stringify(empty)});});
 await p.goto(web+'/admin',{waitUntil:'domcontentloaded'});await p.getByRole('status').filter({hasText:'Loading server data'}).waitFor();assert.equal(await p.locator('.sa-stat-card').count(),0);await p.waitForLoadState('networkidle');
 checks.push('16 RTL/LTR desktop/mobile layouts, real aggregates, scoped CategoryAdmin page, loading/empty/API error states');assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',isolated:true,checks}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
