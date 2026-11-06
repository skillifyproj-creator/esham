require('./require-isolated-test-target.cjs')();
// Read-only visual audit. Persona overrides are browser fixtures, never database writes.
const fs=require('fs'),os=require('os'),path=require('path'),assert=require('assert/strict');
const {chromium}=require(path.join(os.tmpdir(),'esham-curriculum-browser/node_modules/playwright'));
const api='http://localhost:5216',web='http://localhost:5175';
const contrastAudit=require('./theme-browser-helpers.cjs');
(async()=>{const f=JSON.parse(fs.readFileSync(path.join(os.tmpdir(),'esham-isolated-review-fixture.json')));assert.equal(f.isolated,true);const browser=await chromium.launch({channel:'msedge',headless:true}),results=[],errors=[];
try{
 const setup=await browser.newContext();let cr=f.credentials.instructor;await setup.request.post(api+'/auth/login',{data:{email:cr.email,password:cr.password}});const snap=await(await setup.request.get(api+`/api/courses/${f.courseId}/review`)).json();const section=snap.sections[0],lesson=section.lessons[0],task=snap.tasks[0];const catalog=await(await setup.request.get(api+'/api/courses/public')).json();const publicId=catalog[0]?.courseId||f.courseId;await setup.close();
 const admin=['/admin','/admin/admins','/admin/users','/admin/notifications','/admin/courses',`/admin/courses/${f.courseId}/review`,'/admin/categories','/admin/reports','/admin/moderation','/admin/announcements','/admin/activity'];
 const category=['/category-admin','/category-admin/courses',`/category-admin/courses/${f.courseId}/review`,'/category-admin/activity','/category-admin/notifications','/category-admin/moderation'];
 const learner=['/learner','/learner/profile','/learner/settings','/learner/settings/security','/learner/courses',`/learner/courses/${publicId}/learn`,'/learner/tasks','/learner/courses/certificates','/learner/certificates',`/learner/certificates/${publicId}`,'/learner/progress','/learner/points','/learner/reviews','/learner/notifications'];
 const instructor=['/instructor','/instructor/profile','/instructor/settings','/instructor/settings/security','/instructor/courses','/instructor/courses/new',`/instructor/courses/${f.courseId}/edit`,`/instructor/courses/${f.courseId}/curriculum`,`/instructor/courses/${f.courseId}/review`,`/instructor/courses/${f.courseId}/review-report`,`/instructor/courses/${f.courseId}/preview`,'/instructor/performance',`/instructor/courses/${f.courseId}/performance`,'/instructor/feedback',`/instructor/courses/${f.courseId}/feedback`,'/instructor/submissions','/instructor/notifications','/instructor/points','/instructor/courses/certificates','/instructor/certificates',`/instructor/courses/${f.courseId}/sections/${section.id}/lessons/${lesson.id}/edit`,`/instructor/courses/${f.courseId}/sections/${section.id}/lessons/${lesson.id}/video`,`/instructor/courses/${f.courseId}/sections/${section.id}/tasks/new`,`/instructor/courses/${f.courseId}/tasks/${task.id}/edit`];
 const groups={guest:['/','/courses',`/courses/${publicId}`,'/help/support','/help/guidelines','/help/privacy','/help/terms','/signup','/login','/forgot-password','/reset-password','/auth/google/complete','/not-found'],general:admin,reviewer:category,instructor,learner,hybrid:['/learner','/instructor'],onboarding:['/onboarding/role','/onboarding/profile','/onboarding/interests','/onboarding/goals','/onboarding/complete']};
 const quick=process.env.ESHAM_THEME_QUICK==='1';
 async function checkGroup([who,allRoutes]){
 const ctx=await browser.newContext();if(who!=='guest'){cr=f.credentials[['learner','hybrid','onboarding'].includes(who)?'instructor':who];assert.equal((await ctx.request.post(api+'/auth/login',{data:{email:cr.email,password:cr.password}})).status(),200);}
 if(['learner','hybrid','onboarding'].includes(who))await ctx.route('**/auth/session',async r=>{const response=await r.fetch();const s=await response.json();s.onboardingRequired=who==='onboarding';if(who==='onboarding'){s.profile.username='theme_fixture';s.profile.name='Theme Fixture';s.profile.goal=0;}s.profile.role=who==='learner'?'learner':'both';s.profile.roles=who==='learner'?['Learner']:['Learner','Instructor'];await r.fulfill({response,json:s});});
 if(who==='onboarding')await ctx.route('**/me/categories',r=>r.fulfill({json:{learningCategoryIds:[f.categoryId],teachingCategoryIds:[f.categoryId]}}));
 // Block business mutations, camera acquisition and AI requests. Auth already completed.
 await ctx.route('**/api/**',r=>['GET','HEAD','OPTIONS'].includes(r.request().method())?r.continue():r.abort());
 const p=await ctx.newPage();p.on('pageerror',e=>errors.push({who,message:e.message}));
 for(const theme of quick?[process.env.ESHAM_THEME_QUICK_THEME||'dark']:['light','dark'])for(const language of quick?['en']:['ar','en'])for(const width of quick?[1440]:[1440,390]){
  await p.setViewportSize({width,height:1000});await p.goto(web+'/');await p.waitForLoadState('networkidle');await p.evaluate(({theme,language})=>{localStorage.setItem('esham-theme',theme);localStorage.setItem('esham-language',language)},{theme,language});
  const routes=quick?allRoutes.filter((_,i)=>i<2||i===allRoutes.length-1):allRoutes;
  for(const route of routes){await p.goto(web+route);await p.waitForLoadState('networkidle');await p.evaluate(()=>document.fonts.ready);const state=await p.evaluate(()=>({theme:document.documentElement.dataset.theme,dir:document.documentElement.dir,overflow:document.documentElement.scrollWidth>innerWidth+1,bg:getComputedStyle(document.body).backgroundColor,error:!!document.querySelector('.page-error-boundary')}));assert.equal(state.theme,theme);assert.equal(state.dir,language==='ar'?'rtl':'ltr');assert.equal(state.error,false,route);
   const logos=await p.locator('img[data-esham-logo]').evaluateAll(imgs=>imgs.map(i=>({src:i.getAttribute('src'),filter:getComputedStyle(i).filter,loaded:i.complete&&i.naturalWidth>0})));for(const logo of logos){assert(logo.src.includes(theme==='dark'?'logo2':'esham-logo'));assert.equal(logo.filter,'none');assert(logo.loaded);}
   const audit=await p.evaluate(contrastAudit);results.push({who,route,actual:new URL(p.url()).pathname,theme,language,width,...state,...audit});
   if(quick||['/','/login','/learner','/instructor','/admin','/category-admin'].includes(route))await p.screenshot({path:path.join(os.tmpdir(),`esham-theme-${who}-${theme}-${language}-${width}-${route.replaceAll('/','_')||'home'}.png`),fullPage:!quick});
  }
  console.log('Checked '+who+' '+theme+' '+language+' '+width);
 }
 await ctx.close();
 }
 const jobs=Object.entries(groups);async function worker(){while(jobs.length)await checkGroup(jobs.shift());}await Promise.all(Array.from({length:3},worker));
 const report={routes:[...new Set(results.map(x=>x.route))].length,checks:results.length,textChecks:results.reduce((n,r)=>n+r.checked,0),contrastFailures:results.reduce((n,r)=>n+r.failures.length,0),overflows:results.filter(r=>r.overflow).map(r=>({who:r.who,route:r.route,width:r.width,theme:r.theme})),errors,results};fs.writeFileSync(path.join(os.tmpdir(),quick?'esham-platform-theme-quick-results.json':'esham-platform-theme-results.json'),JSON.stringify(report,null,2));console.log(JSON.stringify({...report,results:undefined}));
}finally{await browser.close()}})().catch(e=>{console.error(e);process.exitCode=1});
