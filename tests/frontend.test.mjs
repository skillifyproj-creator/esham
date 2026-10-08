import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter, Routes, Route } from 'react-router';
const server = await createServer({ cacheDir:'node_modules/.vite-tests', optimizeDeps:{noDiscovery:true,include:[]}, server: { middlewareMode: true }, appType: 'custom' });
let publishing, submissions, mediaValidation, videoValidation, accountApi, certificatePolicy, reportPolicy, newPages, adminModules, recommendations, safety, categories, courses, profile, draft, workspace, reviews, providers, learnerPages, learnerNavigation, instructorPages, ledger, courseStorage;
try {
  [categories, courses, profile, draft, workspace, reviews] = await Promise.all([
    '/src/data/categories.js', '/src/data/courses.js', '/src/hooks/useAccountProfile.js',
    '/src/data/instructorCourseDraft.js', '/src/data/instructorCourseWorkspace.js', '/src/services/categoryAdminService.js',
  ].map(path => server.ssrLoadModule(path)));
  [publishing,submissions,mediaValidation,videoValidation,accountApi]=await Promise.all(['/src/services/coursePublishing.js','/src/services/taskSubmissions.js','/src/services/mediaStore.js','/src/services/videoProcessing.js','/src/services/accountApi.js'].map(path=>server.ssrLoadModule(path)));
  certificatePolicy = await server.ssrLoadModule('/src/data/certificates.js');
  ledger = await server.ssrLoadModule('/src/data/pointsLedger.js');
  courseStorage = await server.ssrLoadModule('/src/data/instructorCourseStorage.js');
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

test('every catalog course costs 20 and the welcome grant is issued only once', () => {
  localStorage.clear();
  const learner = { id: 'new-learner', role: 'learner' };
  assert.ok(courses.courses.every(course => course.points === 20));
  for (let i = 0; i < 3; i++) ledger.initializeWallet(learner);
  assert.equal(ledger.getAccountWallet(learner).balance, 20);
  assert.equal(ledger.getAccountWallet(learner).transactions.length, 1);
  localStorage.clear();
});

test('enrollment commits registration, debit and teacher credit once and survives reads', () => {
  localStorage.clear();
  const learner = { id: 'new-learner', role: 'learner' };
  const teacher = { id: courses.courses[0].instructorId, role: 'instructor' };
  const enrolled = ledger.enrollWithPoints(learner, 1);
  assert.deepEqual(ledger.enrollWithPoints(learner, 1), enrolled);
  assert.equal(ledger.getAccountWallet(learner).balance, 0);
  assert.equal(ledger.getAccountWallet(learner).enrollments.length, 1);
  assert.equal(ledger.getAccountWallet(teacher).balance, 40);
  assert.equal(ledger.getAccountWallet(teacher).earned, 20);
  assert.equal(ledger.getAccountWallet(learner).earned, 0);
  ledger.initializeWallet({ ...learner, role: 'both' });
  ledger.initializeWallet({ ...learner, role: 'instructor' });
  assert.equal(ledger.getAccountWallet(learner).balance, 0);
  assert.equal(ledger.getAccountWallet({ ...learner, role: 'both' }).enrollments.length, 1);
  localStorage.clear();
});

test('each distinct learner gives the instructor 20 points for the same course', () => {
  localStorage.clear();
  ledger.enrollWithPoints({ id: 'learner-a', role: 'learner' }, 1);
  ledger.enrollWithPoints({ id: 'learner-b', role: 'both' }, 1);
  const teacher = { id: courses.courses[0].instructorId };
  assert.equal(ledger.getAccountWallet(teacher).earned, 40);
  assert.equal(ledger.getAccountWallet(teacher).balance, 60);
  assert.equal(ledger.getAccountWallet({ id: 'learner-c' }).balance, 20);
  localStorage.clear();
});

test('insufficient balance, invalid role and self enrollment never change the ledger', () => {
  localStorage.clear();
  const learner = { id: 'learner-a', role: 'learner' };
  ledger.enrollWithPoints(learner, 1);
  const before = localStorage.getItem('esham-points-ledger-v1');
  assert.throws(() => ledger.enrollWithPoints(learner, 2), /balance/);
  assert.throws(() => ledger.enrollWithPoints({ id: 'teacher', role: 'instructor' }, 2), /learner-role/);
  assert.throws(() => ledger.enrollWithPoints({ id: courses.courses[0].instructorId, role: 'both' }, 1), /own-course/);
  assert.throws(() => ledger.enrollWithPoints(learner, 'missing'), /course/);
  assert.equal(localStorage.getItem('esham-points-ledger-v1'), before);
  localStorage.clear();
});

test('storage failure cannot partially debit the learner or credit the instructor', () => {
  localStorage.clear();
  const learner = { id: 'learner-a', role: 'learner' };
  ledger.initializeWallet(learner);
  const before = localStorage.getItem('esham-points-ledger-v1');
  const setter = localStorage.setItem;
  try {
    localStorage.setItem = () => { throw new Error('quota'); };
    assert.throws(() => ledger.enrollWithPoints(learner, 1), /quota/);
  } finally { localStorage.setItem = setter; }
  assert.equal(localStorage.getItem('esham-points-ledger-v1'), before);
  assert.equal(ledger.getAccountWallet(learner).balance, 20);
  localStorage.clear();
});

test('course metadata and curriculum persist together and failed saves retain prior data', () => {
  localStorage.clear();
  assert.equal(courseStorage.persistInstructorCourse('digital-content', { title: { ar: 'عنوان محفوظ', en: 'Saved title' } }), true);
  assert.equal(courseStorage.persistInstructorCourse('digital-content', { curriculum: [{ id: 'section-1', title: 'Section', lessons: [] }] }), true);
  const saved = courseStorage.readSavedInstructorCourse('digital-content');
  assert.equal(saved.title.en, 'Saved title');
  assert.equal(saved.curriculum[0].id, 'section-1');
  assert.equal(workspace.getInstructorCourseWorkspace('digital-content').course.title.en, 'Saved title');
  assert.equal(workspace.getInstructorCourseWorkspace('digital-content').sections[0].id, 'section-1');
  const setter = localStorage.setItem;
  try {
    localStorage.setItem = () => { throw new Error('quota'); };
    assert.equal(workspace.saveWorkspaceSections('digital-content', []), false);
    assert.deepEqual(courseStorage.readSavedInstructorCourse('digital-content'), saved);
  } finally { localStorage.setItem = setter; localStorage.clear(); }
});

test('draft migrates from the session to durable storage without losing its content', () => {
  localStorage.clear(); session.clear();
  session.setItem('esham-instructor-course-draft-v1', JSON.stringify({ title: { ar: 'مسودة', en: 'Draft' }, curriculum: [] }));
  assert.equal(draft.saveInstructorCourseDraft({ objectives: [{ ar: 'هدف', en: 'Goal' }] }), true);
  session.clear();
  assert.equal(draft.readInstructorCourseDraft().title.en, 'Draft');
  assert.equal(draft.readInstructorCourseDraft().objectives[0].en, 'Goal');
  localStorage.clear();
});
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
test('hybrid activation preserves identity and both learning and teaching records', () => {
  const originalDispatch = window.dispatchEvent;
  let updates = 0;
  window.dispatchEvent = event => { assert.equal(event.type, 'esham-profile-updated'); updates++; };
  try {
    for (const role of ['learner', 'instructor']) {
      const account = { id: 'existing-user', role, name: 'Existing user', username: 'existing', interests: [1], teachingAreas: [2], customSkills: ['Design'], goal: 2 };
      localStorage.setItem('esham-account-profile-v1', JSON.stringify(account));
      localStorage.setItem('esham-learner-progress-v1', '[{"courseId":6,"completedLessonIds":["lesson-1"]}]');
      localStorage.setItem('esham-task-submissions-v1', '{"task-1":{"status":"submitted"}}');
      session.setItem('esham-instructor-course-draft-v1', '{"title":{"en":"Existing draft"}}');
      const learning = localStorage.getItem('esham-learner-progress-v1');
      const tasks = localStorage.getItem('esham-task-submissions-v1');
      const teaching = session.getItem('esham-instructor-course-draft-v1');
      const upgraded = profile.updateAccountRole('both');
      assert.deepEqual(upgraded, { ...account, role: 'both', roles: ['learner', 'instructor'] });
      assert.equal(profile.readAccountProfile().role, 'both');
      assert.equal(localStorage.getItem('esham-learner-progress-v1'), learning);
      assert.equal(localStorage.getItem('esham-task-submissions-v1'), tasks);
      assert.equal(session.getItem('esham-instructor-course-draft-v1'), teaching);
    }
    assert.equal(updates, 2);
  } finally { window.dispatchEvent = originalDispatch; localStorage.clear(); session.clear(); }
});
test('hybrid activation does not announce success when storage fails', () => {
  const originalStorage = window.localStorage;
  const originalDispatch = window.dispatchEvent;
  let updates = 0;
  window.localStorage = { getItem: () => JSON.stringify({ role: 'learner', id: 'existing-user' }), setItem: () => { throw new Error('Storage unavailable'); } };
  window.dispatchEvent = () => { updates++; };
  try { assert.throws(() => profile.updateAccountRole('both'), /Storage unavailable/); assert.equal(updates, 0); }
  finally { window.localStorage = originalStorage; window.dispatchEvent = originalDispatch; }
});
test('all account type transitions preserve history and synchronize legacy flags', () => {
  const originalDispatch = window.dispatchEvent;
  window.dispatchEvent = () => {};
  try {
    for (const from of ['learner', 'instructor', 'both']) {
      for (const to of ['learner', 'instructor', 'both']) {
        const account = { id: 'same-user', role: from, roles: from === 'both' ? ['learner', 'instructor'] : [from], isLearner: from !== 'instructor', isInstructor: from !== 'learner', learner: from !== 'instructor', instructor: from !== 'learner', name: 'Existing user', email: 'user@example.com', interests: [1], teachingAreas: [2] };
        localStorage.setItem('esham-account-profile-v1', JSON.stringify(account));
        localStorage.setItem('esham-learner-progress-v1', 'existing learning history');
        localStorage.setItem('esham-task-submissions-v1', 'existing task history');
        session.setItem('esham-instructor-course-draft-v1', 'existing teaching history');
        const next = profile.updateAccountRole(to);
        assert.equal(profile.readAccountProfile().role, to);
        for (const field of ['id', 'email', 'name', 'interests', 'teachingAreas']) assert.deepEqual(next[field], account[field]);
        assert.equal(next.isLearner, to !== 'instructor');
        assert.equal(next.isInstructor, to !== 'learner');
        assert.equal(localStorage.getItem('esham-learner-progress-v1'), 'existing learning history');
        assert.equal(localStorage.getItem('esham-task-submissions-v1'), 'existing task history');
        assert.equal(session.getItem('esham-instructor-course-draft-v1'), 'existing teaching history');
      }
    }
    const before = localStorage.getItem('esham-account-profile-v1');
    assert.throws(() => profile.updateAccountRole('admin'), /Invalid account role/);
    assert.equal(localStorage.getItem('esham-account-profile-v1'), before);
  } finally { window.dispatchEvent = originalDispatch; localStorage.clear(); session.clear(); }
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


const publishingFixture = () => ({
 course: { id:'qa-publish',title:{ar:'دورة اختبار',en:'Test course'},description:{ar:'وصف دورة اختبار متكامل للتأكد من نشر المحتوى بعد الاعتماد فقط.',en:'A complete test description for reviewing and publishing course content.'},categoryKey:'programming',language:'ar',image:'/images/auth-learning.jpg',level:'beginner',objectives:['إتمام التطبيق'] },
 sections:[{id:'section-test',title:'الوحدة الأولى',lessons:[{id:'lesson-test',title:'درس تجريبي',description:'محتوى مكتمل يشرح الخطوات العملية بالتفصيل المطلوب.',contentType:'article',status:'ready',minutes:5,objectives:['تطبيق الخطوات']}],task:{id:'qa-task',title:'مهمة تجريبية',description:'وصف مهمة تجريبية يتضمن التطبيق العملي والمتطلبات.',instructions:'طبّق خطوات الدرس ثم أرسل شرحًا للنتيجة التي أنجزتها.',requirements:['وضوح النتيجة'],status:'ready'}}]
});
test('publication stays private until scoped approval and preserves the approved snapshot during edits',()=>{
 localStorage.clear(); const {course,sections}=publishingFixture(),owner={id:'qa-teacher',role:'instructor',name:'QA Teacher'};
 const submitted=publishing.submitCourse(course,sections,owner);
 assert.equal(publishing.asPublicCourse(submitted),null);
 assert.throws(()=>publishing.submitCourse(course,sections,owner),/pending/);
 assert.throws(()=>publishing.reviewSubmission(course.id,'approve','',{id:'wrong',categoryIds:['design']}),/scope/);
 const approved=publishing.reviewSubmission(course.id,'approve','',{id:'reviewer',categoryIds:['programming']});
 assert.equal(publishing.asPublicCourse(approved).instructorId,owner.id);
 publishing.updateSubmittedCourse(course.id,{title:{ar:'عنوان معدل',en:'Edited title'}});
 assert.equal(publishing.asPublicCourse(publishing.readSubmissions()[0]).title.en,'Test course');
 publishing.submitCourse({...course,title:{ar:'عنوان معدل',en:'Edited title'}},sections,owner);
 assert.equal(publishing.asPublicCourse(publishing.readSubmissions()[0]).title.en,'Test course');localStorage.clear();
});
test('a failed publication does not announce pending state or lose the previous queue',()=>{
 localStorage.clear();const {course,sections}=publishingFixture(),storage=globalThis.localStorage;
 globalThis.localStorage={getItem:storage.getItem,setItem:()=>{throw Error('quota');}};
 assert.throws(()=>publishing.submitCourse(course,sections,{id:'qa-teacher'}),/quota/);
 globalThis.localStorage=storage;assert.equal(publishing.readSubmissions().length,0);
});
test('task submission requires enrollment and only its instructor may approve; review gives no points',()=>{
 localStorage.clear();const {course,sections}=publishingFixture();publishing.submitCourse(course,sections,{id:'qa-teacher',name:'QA Teacher'});
 publishing.reviewSubmission(course.id,'approve','',{id:'reviewer',categoryIds:['programming']});courses.refreshPublishedCourses();
 const learner={id:'qa-student',role:'learner'},teacher={id:'qa-teacher',role:'instructor'};
 assert.throws(()=>submissions.saveTaskSubmission(learner,'qa-task',{answer:'Test answer',submit:true}),/locked/);
 ledger.enrollWithPoints(learner,course.id);const record=submissions.saveTaskSubmission(learner,'qa-task',{answer:'Test answer',submit:true});
 assert.throws(()=>submissions.saveTaskSubmission(learner,'qa-task',{answer:'Overwrite'}),/locked/);
 assert.throws(()=>submissions.reviewTaskSubmission({...teacher,id:'another'},record.id,true),/scope/);
 const balance=ledger.getAccountWallet(teacher).balance;submissions.reviewTaskSubmission(teacher,record.id,true,'Accepted');
 assert.equal(submissions.readTaskSubmissions()[0].status,'completed');assert.equal(ledger.getAccountWallet(teacher).balance,balance);
 courses.courses.splice(courses.courses.findIndex(item=>item.id===course.id),1);localStorage.clear();
});
test('video and attachments reject empty, oversized and unsupported files; trimming validates bounds',()=>{
 assert.throws(()=>mediaValidation.validateVideo({name:'movie.mp4',type:'video/mp4',size:0}),/size/);
 assert.throws(()=>mediaValidation.validateVideo({name:'bad.exe',type:'video/mp4',size:100}),/type/);
 assert.throws(()=>mediaValidation.validateAttachments([{name:'bad.pdf',size:11*1024**2}]),/limit/);
 assert.throws(()=>mediaValidation.validateAttachments([{name:'file.pdf',size:1}],5),/limit/);
 assert.doesNotThrow(()=>mediaValidation.validateAttachments([{name:'file.pdf',size:1}]));
 assert.throws(()=>videoValidation.validateTrim(-1,2,3),/trim/);assert.throws(()=>videoValidation.validateTrim(0,4,3),/trim/);assert.doesNotThrow(()=>videoValidation.validateTrim(1,2,3));
});
test('account requests use cookies and safely classify invalid responses, failures and timeouts',async()=>{
 const base='/api';let request;
 const result=await accountApi.accountRequest('/auth/login',{email:'qa@example.test',password:'test-only'},{base,fetcher:async(url,options)=>{request={url,options};return {ok:true,status:200,json:async()=>({profile:{id:'qa'}})};}});
 assert.equal(result.profile.id,'qa');assert.equal(request.options.credentials,'include');assert.equal(request.url,'/api/auth/login');
 await assert.rejects(accountApi.accountRequest('/auth/login',{}, {base,fetcher:async()=>({ok:false,status:401})}),error=>error.code==='unauthorized');
 await assert.rejects(accountApi.accountRequest('/auth/login',{}, {base,fetcher:async()=>({ok:true,status:200,json:async()=>{throw Error('invalid');}})}),error=>error.code==='response');
 await assert.rejects(accountApi.accountRequest('/auth/login',{}, {base,fetcher:async()=>{throw TypeError('network');}}),error=>error.code==='network');
 await assert.rejects(accountApi.accountRequest('/auth/login',{}, {base,timeout:5,fetcher:async(url,{signal})=>new Promise((resolve,reject)=>signal.addEventListener('abort',()=>reject(new DOMException('aborted','AbortError'))))}),error=>error.code==='timeout');
 await assert.rejects(accountApi.accountRequest('/auth/login',{}, {base:''}),error=>error.code==='unconfigured');
});
