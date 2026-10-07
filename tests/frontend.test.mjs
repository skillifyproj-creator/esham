import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router';
const server = await createServer({ server: { middlewareMode: true }, appType: 'custom' });
let certificatePolicy, reportPolicy, newPages, adminModules, recommendations, safety, categories, courses, profile, draft, workspace, reviews, providers, learnerPages, learnerNavigation, instructorPages;
try {
  [categories, courses, profile, draft, workspace, reviews] = await Promise.all([
    '/src/data/categories.js', '/src/data/courses.js', '/src/hooks/useAccountProfile.js',
    '/src/data/instructorCourseDraft.js', '/src/data/instructorCourseWorkspace.js', '/src/services/categoryAdminService.js',
  ].map(path => server.ssrLoadModule(path)));
  certificatePolicy = await server.ssrLoadModule('/src/data/certificates.js');
  reportPolicy = await server.ssrLoadModule('/src/services/courseReports.js');
  newPages = await Promise.all(['/src/pages/learner/LearnerCertificatesPage.jsx','/src/pages/shared/ModerationQueuePage.jsx','/src/pages/shared/PlatformHelpPage.jsx','/src/pages/instructor/InstructorReviewReportPage.jsx','/src/pages/instructor/InstructorCertificatesPage.jsx'].map(path=>server.ssrLoadModule(path)));
  adminModules = await Promise.all(['/src/pages/admin/SuperAdminModule.jsx','/src/pages/category-admin/CategoryAdminModule.jsx'].map(path=>server.ssrLoadModule(path)));
  recommendations = await server.ssrLoadModule('/src/data/courseRecommendations.js');
  safety = await server.ssrLoadModule('/src/services/courseSafety.js');
  providers = await Promise.all(['/src/context/PreferencesContext.jsx','/src/context/LearnerContext.jsx','/src/context/LearnerTasksContext.jsx','/src/context/NotificationsContext.jsx'].map(path => server.ssrLoadModule(path)));
  learnerPages = await Promise.all(['LearnerDashboard','LearnerCoursesPage','LearnerLessonPage','LearnerTasksPage','LearnerProgressPage','LearnerPointsPage','LearnerReviewsPage','LearnerNotificationsPage'].map(name=>server.ssrLoadModule('/src/pages/learner/'+name+'.jsx')));
  learnerNavigation = await server.ssrLoadModule('/src/components/learner/LearnerNavigation.jsx');
  instructorPages = await Promise.all(['InstructorDashboard','InstructorCoursesPage','CreateCoursePage','CourseCurriculumPage','CourseReviewPage','EditLessonPage','InstructorTaskPage','InstructorPerformancePage','InstructorFeedbackPage','InstructorVideoSourcePage','InstructorVideoRecordingSetupPage','InstructorVideoRecordingPage','InstructorVideoPreviewPage','InstructorVideoEditorPage'].map(name=>server.ssrLoadModule('/src/pages/instructor/'+name+'.jsx')));
} finally { await server.close(); }
const memory = () => { const values = new Map(); return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), clear: () => values.clear() }; };
const session = memory();
globalThis.sessionStorage = session;
globalThis.localStorage = memory();
globalThis.window = { localStorage: globalThis.localStorage, sessionStorage: session };
test('category order preserves existing profile selections and catalog labels', () => {
  assert.deepEqual(categories.categories.map(c => c.id), ['programming','design','photography','marketing','crafts','business']);
  assert.deepEqual(courses.categoryKeys, ['all', ...categories.categories.map(c => c.id)]);
  assert.ok(courses.courses.every(course => categories.getCategory(course.category)));
  assert.equal(categories.resolveCategoryId('ui-design'), 'design');
  assert.equal(categories.resolveCategoryId({ ar: 'التصوير', en: 'Photography' }), 'photography');
  assert.equal(categories.resolveCategoryId('data'), 'programming');
});
test('single role flags stay single roles and hybrid flags resolve to both', () => {
  for (const [input, expected] of [[{role:'learner'},'learner'],[{role:'instructor'},'instructor'],[{role:'both'},'both'],[{isLearner:true},'learner'],[{isInstructor:true},'instructor'],[{isLearner:true,isInstructor:true},'both'],[{roles:['instructor']},'instructor'],[{roles:['learner','instructor']},'both']]) assert.equal(profile.normalizeAccountProfile(input).role, expected);
  assert.equal(profile.normalizeAccountProfile(null), null);
  assert.equal(profile.normalizeAccountProfile({role:'unknown'}), null);
});
test('invalid storage falls back to the next role source', () => {
  window.localStorage.setItem('esham-account-profile-v1', '{broken');
  session.setItem('esham-onboarding-draft-v1', JSON.stringify({isInstructor:true}));
  assert.equal(profile.readAccountProfile().role, 'instructor');
  window.localStorage.clear(); session.clear();
});
test('course draft preserves information while saving curriculum and rejects malformed values', () => {
  session.setItem('esham-instructor-course-draft-v1', '[]');
  assert.equal(draft.readInstructorCourseDraft(), null);
  assert.ok(draft.saveInstructorCourseDraft({title:{ar:'دورة',en:'Course'},categoryKey:'programming'}));
  assert.ok(draft.saveInstructorCourseDraft({curriculum:[{id:'s1',title:{en:'Section'},lessons:[],task:null}]}));
  assert.equal(draft.readInstructorCourseDraft().title.en, 'Course');
  assert.equal(workspace.getInstructorCourseWorkspace('new').sections.length, 1);
  assert.equal(workspace.getInstructorCourseWorkspace('missing'), null);
});
test('lesson and task updates stay in their own course section', () => {
  assert.equal(workspace.saveWorkspaceLesson('new','missing',{id:'l1'}), false);
  assert.ok(workspace.saveWorkspaceLesson('new','s1',{id:'l1',title:{en:'Lesson'},contentType:'article',description:{en:'Reading content'},minutes:10}));
  assert.ok(workspace.saveWorkspaceTask('new','s1',{id:'t1',title:{en:'Task'},status:'ready'}));
  let current = workspace.getInstructorCourseWorkspace('new');
  assert.equal(current.sections[0].lessons[0].id,'l1'); assert.equal(current.sections[0].task.id,'t1');
  assert.ok(workspace.saveWorkspaceTask('new','s1',null));
  current=workspace.getInstructorCourseWorkspace('new');
  assert.equal(current.sections[0].task,null); assert.equal(current.sections[0].lessons.length,1);
});
test('review scope prevents changing courses outside assigned categories', () => {
  const list=[{id:'allowed',categoryId:'design',status:'pending'},{id:'other',categoryId:'programming',status:'pending'}], admin={id:'a1',categoryIds:['design']};
  assert.deepEqual(reviews.getCategoryAdminCourses(list,admin).map(c=>c.id),['allowed']);
  assert.throws(()=>reviews.reviewCourse(list,'other',admin,'approve',''));
  assert.throws(()=>reviews.reviewCourse(list,'allowed',admin,'reject','  '));
  const next=reviews.reviewCourse(list,'allowed',admin,'request_changes','Explain outcomes');
  assert.equal(next.courses[0].status,'changes_requested');assert.equal(next.courses[1].status,'pending');
  assert.throws(()=>reviews.reviewCourse(next.courses,'allowed',admin,'approve',''));
});
test('notification read action stays within assigned categories and recipient', () => {
  const admin={id:'a1',categoryIds:['design']}, list=[{id:1,recipientId:'a1',categoryId:'design',isRead:false},{id:2,recipientId:'a1',categoryId:'programming',isRead:false},{id:3,recipientId:'a2',categoryId:'design',isRead:false}];
  assert.deepEqual(reviews.markAllNotificationsAsRead(list,admin).map(item=>item.isRead),[true,false,false]);
});

const renderLearner = (element, path='/learner', pattern) => renderToString(h(MemoryRouter,{initialEntries:[path]},h(providers[0].PreferencesProvider,null,h(providers[1].LearnerProvider,null,h(providers[2].LearnerTasksProvider,null,h(providers[3].NotificationsProvider,null,h(Routes,null,h(Route,{path:pattern || (path.endsWith('/learn')?'/learner/courses/:courseId/learn':'*'),element}))))))));
test('all learner pages render in both languages with their shared providers',()=>{
  for(const language of ['ar','en']) { localStorage.setItem('esham-language',language); localStorage.setItem('esham-account-profile-v1',JSON.stringify({role:'learner',name:'Test learner'}));
    learnerPages.forEach((module,index)=>{const html=renderLearner(h(module.default),index===2?'/learner/courses/6/learn':'/learner');assert.match(html,/<h1/);assert.ok(!html.includes('[object Object]'));});
  } localStorage.clear();
});
test('role switch is available only to hybrid accounts',()=>{
  localStorage.setItem('esham-language','en');
  for(const role of ['learner','both']) {localStorage.setItem('esham-account-profile-v1',JSON.stringify({role,name:'Test learner'})); const html=renderLearner(h(learnerNavigation.default));assert.equal(html.includes('Switch to instructor'),role==='both');}
  localStorage.clear();
});

test('readiness validates content rather than trusting an existing ready status',()=>{
  const reading={title:{en:'Reading lesson'},contentType:'article',description:{en:'A detailed reading lesson with useful content.'},objectives:['Understand concepts'],minutes:10,status:'ready'};
  assert.equal(workspace.lessonIsReady(reading,'en'),true);assert.equal(workspace.lessonIsReady({...reading,description:''},'en'),false);assert.equal(workspace.lessonIsReady({...reading,minutes:601},'en'),false);
  assert.equal(workspace.lessonIsReady({...reading,status:'draft'},'en'),false);
  assert.equal(workspace.taskIsReady({status:'ready',title:'Demo task'},'en'),false);
});

test('instructor pages and video workflow render with the current course context',()=>{
  localStorage.setItem('esham-account-profile-v1',JSON.stringify({role:'instructor',name:'Test instructor'}));
  const base='/instructor/courses/photography/sections/6-module-1/lessons/6-0-0', pattern='/instructor/courses/:courseId/sections/:sectionId/lessons/:lessonId';
  const paths=[['/instructor','*'],['/instructor/courses','*'],['/instructor/courses/new','*'],['/instructor/courses/photography/curriculum','/instructor/courses/:courseId/curriculum'],['/instructor/courses/photography/review','/instructor/courses/:courseId/review'],[base+'/edit',pattern+'/edit'],['/instructor/courses/photography/sections/6-module-1/tasks/task-6-1/edit','/instructor/courses/:courseId/sections/:sectionId/tasks/:taskId/edit'],['/instructor/performance','*'],['/instructor/feedback','*'],...['/video','/video/record','/video/recording','/video/preview','/video/edit'].map(suffix=>[base+suffix,pattern+suffix])];
  for(const language of ['ar','en']) {localStorage.setItem('esham-language',language);instructorPages.forEach((module,index)=>{const html=renderLearner(h(module.default),...paths[index]);assert.match(html,/<h1/);assert.ok(!html.includes('[object Object]'));});}
  localStorage.clear();
});

test('course task cap prevents adding a fourth task', () => {
 const sections=Array.from({length:4},(_,i)=>({id:String(i),lessons:[],task:{id:'task'+i}}));
 assert.equal(workspace.countCourseTasks(sections),4);
 assert.equal(workspace.saveWorkspaceSections('new',sections),false);
});
test('verified warnings reject duplicates and archive without deleting history', () => {
 let state=safety.emptyCourseSafety();
 const incident={id:'one',verified:true,reason:'Confirmed violation',correction:'Replace video',deadline:'2026-12-01'};
 assert.throws(()=>safety.issueCourseWarning(state,{...incident,verified:false}));
 state=safety.issueCourseWarning(state,incident);
 assert.throws(()=>safety.issueCourseWarning(state,incident));
 state=safety.issueCourseWarning(state,{...incident,id:'two'});
 assert.equal(state.enrollmentPaused,true);
 state=safety.issueCourseWarning(state,{...incident,id:'three'});
 assert.equal(state.status,'archived');assert.equal(state.warnings.length,3);
 assert.throws(()=>safety.issueCourseWarning(state,{...incident,id:'four'}));
});

test('recommendations exclude enrolled and unavailable courses and respond to feedback', () => {
 const catalog=[{id:1,category:'programming',level:'advanced',instructor:'A'}, {id:2,category:'programming',level:'beginner',instructor:'B',rating:4,tags:['javascript']},{id:3,category:'programming',level:'advanced',instructor:'A',rating:5},{id:4,category:'design',level:'beginner'}, {id:5,category:'programming',status:'archived'}, {id:6,category:'programming',level:'beginner'}];
 const args={catalog,completedCourse:catalog[0],review:{rating:2,text:'too hard, javascript basics please'},enrollments:[{courseId:6}]};
 const result=recommendations.recommendCourses(args);assert.deepEqual(result.map(item=>item.course.id),[2,3]);
 assert.equal(result[0].reason,'feedback');
 assert.equal(recommendations.recommendCourses({...args,review:null}).length,0);
});

test('all administrator pages render in both languages with scoped providers', () => {
 for(const language of ['ar','en']) {
  localStorage.setItem('esham-language',language);
  for(const [index,names] of [[0,['Dashboard','AdminsPage','UsersPage','CoursesPage','CategoriesPage','ReportsPage','AnnouncementsPage','ActivityPage']],[1,['Dashboard','CoursesPage','ReviewPage','ActivityPage','NotificationsPage']]]) {
   const module=adminModules[index],root=index===0?'/admin':'/category-admin';
   for(const name of names){
    const review=name==='ReviewPage',path=review?root+'/courses/c2/review':root;
    const html=renderToString(h(providers[0].PreferencesProvider,null,h(MemoryRouter,{initialEntries:[path]},h(Routes,null,h(Route,{path:root,element:h(module[index===0?'SuperAdminRoutes':'CategoryAdminProvider'])},h(Route,{path:review?'courses/:courseId/review':undefined,index:!review,element:h(module[name])}))))));
    assert.ok(html.includes('<h1'),language+' '+name);
   }
  }
 }
});
test('malformed safety storage and invalid deadlines are rejected', () => {
 assert.deepEqual(safety.readCourseSafety({warnings:[null]}),safety.emptyCourseSafety());
 const incident={id:'bad-date',verified:true,reason:'Reason',correction:'Fix',deadline:'yesterday'};
 assert.throws(()=>safety.issueCourseWarning(safety.emptyCourseSafety(),incident));
 assert.throws(()=>safety.issueCourseWarning(safety.emptyCourseSafety(),{...incident,deadline:'2020-01-01'}));
});

test('certificate preview requires completed lessons and approved tasks', () => {
 const details={courseId:1,isComplete:true};
 assert.equal(certificatePolicy.canPreviewCertificate(details,[{courseId:1,status:'submitted'}]),false);
 assert.equal(certificatePolicy.canPreviewCertificate({...details,isComplete:false},[]),false);
 assert.equal(certificatePolicy.canPreviewCertificate(details,[{courseId:1,status:'completed'},{courseId:2,status:'submitted'}]),true);
});
test('reports validate content and prevent duplicate open incidents', () => {
 const input={courseId:1,reason:'harmful',reporter:'Test learner',description:'A sufficiently detailed test-only concern about course content.'};
 const records=reportPolicy.createCourseReport([],input);assert.equal(records[0].status,'pending');
 assert.throws(()=>reportPolicy.createCourseReport(records,input));
 assert.throws(()=>reportPolicy.createCourseReport([],{...input,courseId:999}));
 assert.throws(()=>reportPolicy.createCourseReport([],{...input,description:'short'}));
 assert.equal(reportPolicy.validCourseReport(null),null);
});
test('new certificate, report, help and instructor pages render in both languages', () => {
 const paths=[['/learner/certificates','*'],['/admin/moderation','*'],['/help/support','/help/:topic'],['/instructor/courses/photography/review-report','/instructor/courses/:courseId/review-report'],['/instructor/certificates','*']];
 for(const language of ['ar','en']){localStorage.setItem('esham-language',language);newPages.forEach((module,index)=>assert.match(renderLearner(h(module.default),...paths[index]),/<h1/));}
});
