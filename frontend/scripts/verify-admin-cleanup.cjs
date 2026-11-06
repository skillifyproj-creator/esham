require('./require-isolated-test-target.cjs')();
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(process.env.PLAYWRIGHT_MODULE||path.join(os.tmpdir(),'esham-curriculum-browser/node_modules/playwright'));
(async()=>{
 const f=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'esham-isolated-review-fixture.json')));assert.equal(f.isolated,true);
 const api='http://localhost:5216',web='http://localhost:5175',browser=await chromium.launch({channel:'msedge',headless:true}),errors=[],checks=[];
 const general=['','/admins','/users','/courses',`/courses/${f.courseId}/review?version=${f.versionId}`,'/categories','/reports','/moderation','/announcements','/notifications','/activity'].map(p=>'/admin'+p);
 const category=['','/courses',`/courses/${f.courseId}/review?version=${f.versionId}`,'/moderation','/activity','/notifications'].map(p=>'/category-admin'+p);
 try {
 for(const who of ['guest','instructor','other','general','reviewer','outsider']){
  const ctx=await browser.newContext(),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
  if(who!=='guest'){const c=f.credentials[who];const r=await ctx.request.post(api+'/auth/login',{data:{email:c.email,password:c.password},headers:{Origin:web,'X-Requested-With':'XMLHttpRequest'}});assert.equal(r.status(),200);}
  await ctx.route('**/api/**',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.abort());
  async function read(url,status){const r=await ctx.request.get(api+url);assert.equal(r.status(),status,url);return status===200?r.json():null;}
  if(['guest','instructor','other'].includes(who)){
   for(const route of [...general,...category]){await p.goto(web+route,{waitUntil:'domcontentloaded'});if(who==='guest')await p.waitForURL('**/login');else await p.getByRole('alert').waitFor();assert.equal(await p.locator('.admin-workspace').count(),0);}
   for(const route of ['/api/course-reviews','/api/admin/users','/api/admin/activity','/api/admin/announcements'])await read(route,who==='guest'?401:403);
   for(const language of ['ar','en']){
    await p.goto(web+'/');await p.evaluate(l=>localStorage.setItem('esham-language',l),language);
    for(const route of who==='guest'?['/']:['/','/learner','/instructor']){await p.goto(web+route,{waitUntil:'domcontentloaded'});if(route!=='/')await p.locator('.learner-dashboard,.instructor-dashboard').first().waitFor();else await p.locator('main').first().waitFor();assert.equal(await p.locator('.development-admin-menu,.development-admin-access,a[href="/admin"],a[href="/category-admin"]').count(),0);assert.equal(await p.locator('html').getAttribute('dir'),language==='ar'?'rtl':'ltr');assert(!await p.locator('body').innerText().then(t=>t.includes('Something went wrong')));}
   }
   console.log('Checked ordinary role: '+who);checks.push(who+': all 17 protected routes blocked; public/learner/instructor shortcuts absent in RTL/LTR');
  } else if(who==='general'||who==='reviewer') {
   for(const route of who==='general'?general:category){await p.goto(web+route);await p.waitForLoadState('networkidle');await p.locator('.admin-workspace').waitFor();assert.equal(await p.locator('footer').count(),0);assert.equal(await p.locator('.development-admin-menu').count(),0);}
   const root=who==='general'?'/admin':'/category-admin';await p.setViewportSize({width:390,height:900});await p.goto(web+'/');await p.evaluate(()=>localStorage.setItem('esham-language','ar'));await p.goto(web+root);await p.locator('.admin-menu-button').click();await p.locator(`.admin-nav-link[href="${root}/courses"]`).click();await p.waitForURL('**'+root+'/courses');assert.equal(await p.locator('.admin-menu-button').getAttribute('aria-expanded'),'false');
   checks.push(who+': authorized routes and Arabic mobile sidebar navigation preserved');
  } else {
   const rows=await read('/api/course-reviews',200);assert(!rows.some(x=>x.categoryId===f.categoryId));await read(`/api/courses/${f.courseId}/review/versions/${f.versionId}`,403);await read('/api/admin/users',403);checks.push('unassigned CategoryAdmin cannot read foreign review or manage users');
  }
  await ctx.close();
 }
 assert.deepEqual(errors,[]);console.log(JSON.stringify({result:'PASS',checks}));
 }finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
