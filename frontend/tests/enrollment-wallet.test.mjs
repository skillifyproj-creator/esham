import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'vite';
import { createElement as h } from 'react';
import { renderToString } from 'react-dom/server';
import { MemoryRouter } from 'react-router';
import { financialRequest, financialMessage } from '../src/services/financialApi.js';
import { loadEnrollments, loadEnrollment, loadPurchaseAvailability, purchaseEnrollment, enrollmentIntent } from '../src/services/enrollments.js';
import { loadWallet, loadWalletHistory, loadTeachingTotals } from '../src/services/wallet.js';
import { createFinancialStore, visibleFinancialState, emptyFinancialState } from '../src/services/financialStore.js';

const a='account-a',b='account-b',course='10000000-0000-4000-8000-000000000001',version='20000000-0000-4000-8000-000000000001',id='30000000-0000-4000-8000-000000000001',requestId='40000000-0000-4000-8000-000000000001';
const enrollment={id,courseId:course,courseVersionId:version,availableCourseVersionId:version,status:'active',enrolledAt:'2026-11-13T10:00:00Z',completedAt:null,lastOpenedAt:null,titleEn:'Real saved course',titleAr:'دورة محفوظة',instructorName:'Instructor',isAvailable:true};
const intent={courseId:course,expectedPublishedVersionId:version,requestId};
const page=(accountId,items,totalCount=items.length,page=1,pageSize=20)=>({accountId,items,totalCount,page,pageSize});
const wallet=(accountId=a,balance=20)=>({accountId,balance,earned:0,spent:20-balance});
function replies(accountId=a,balance=20,items=[]) {return async path=>path.includes('transactions')?page(accountId,[]):path.includes('teaching-summary')?{...page(accountId,[],0,1,100),totalEarned:0}:path.includes('enrollments')?page(accountId,items):wallet(accountId,balance);}

test('financial requests include cookie, trusted-application header and mutation account precondition',async()=>{
 await financialRequest('/me/enrollments',{base:'https://api.example.test',method:'POST',accountId:a,body:intent,fetcher:async(url,options)=>{
   assert.equal(url,'https://api.example.test/me/enrollments');assert.equal(options.credentials,'include');assert.equal(options.headers['X-Requested-With'],'XMLHttpRequest');assert.equal(options.headers['X-Esham-Account-Id'],a);assert.deepEqual(JSON.parse(options.body),intent);
   return Response.json({accountId:a});
 }});
});
test('server errors retain safe codes and do not become successful financial responses',async()=>{
 await assert.rejects(financialRequest('/me/enrollments',{base:'https://api.example.test',fetcher:async()=>Response.json({code:'insufficient_balance'},{status:409})}),e=>e.status===409&&e.code==='insufficient_balance');
 await assert.rejects(financialRequest('/me/wallet',{base:'https://api.example.test',fetcher:async()=>Response.json({}, {status:401})}),e=>e.code==='unauthorized');
});
test('enrollment list/detail and availability validate real GUIDs and account ownership',async()=>{
 assert.equal((await loadEnrollments(a,1,async path=>{assert.match(path,/page=1&pageSize=20/);return page(a,[enrollment]);})).items[0].id,id);
 assert.equal((await loadEnrollment(a,id,async()=>({accountId:a,enrollment}))).enrollment.courseVersionId,version);
 assert.equal((await loadPurchaseAvailability(a,async()=>({accountId:a,enabled:false,cost:20}))).enabled,false);
 await assert.rejects(loadEnrollments(a,1,async()=>page(b,[enrollment])),/account_changed/);
 await assert.rejects(loadEnrollments(a,1,async()=>page(a,[{...enrollment,courseId:'index-1'}])),/response/);
 await assert.rejects(loadEnrollment(a,'1',async()=>{}),/validation/);
});
test('purchase contract binds request/course/version/account and accepts canonical replay',async()=>{
 const result={accountId:a,requestId,replayed:true,charge:20,enrollment};
 assert.equal((await purchaseEnrollment(a,intent,async(path,options)=>{assert.equal(path,'/me/enrollments');assert.equal(options.accountId,a);assert.deepEqual(options.body,intent);return result;})).replayed,true);
 await assert.rejects(purchaseEnrollment(a,intent,async()=>({...result,charge:40})),/response/);
 await assert.rejects(purchaseEnrollment(a,intent,async()=>({...result,accountId:b})),/account_changed/);
});
test('purchase intent survives reload/retry, remains account-scoped and never stores success or balances',()=>{
 const values=new Map(),storage={getItem:k=>values.get(k),setItem:(k,v)=>values.set(k,v)};
 const first=enrollmentIntent(storage,a,course,version,()=>requestId);
 assert.deepEqual(enrollmentIntent(storage,a,course,version,()=>{throw Error('must reuse');}),first);
 assert.notEqual(enrollmentIntent(storage,b,course,version,()=>id).requestId,first.requestId);
 assert.deepEqual(Object.keys(first).sort(),['courseId','expectedPublishedVersionId','requestId']);
});
test('wallet summary uses server totals; history rejects invalid entries',async()=>{
 assert.equal((await loadWallet(a,async()=>({accountId:a,balance:0,earned:240,spent:260}))).earned,240);
 assert.equal((await loadWalletHistory(a,2,async path=>{assert.match(path,/page=2/);return page(a,[],25,2);})).totalCount,25);
 await assert.rejects(loadWallet(a,async()=>wallet(b)),/account_changed/);
 await assert.rejects(loadWalletHistory(a,1,async()=>page(a,[{id,amount:0,transactionType:'teaching',createdAt:enrollment.enrolledAt}])),/response/);
});
test('per-course teaching metrics aggregate server pages instead of one ledger-history page',async()=>{
 let calls=0;
 const data=await loadTeachingTotals(a,async path=>{calls++;const n=path.includes('page=1&')?1:2;return {...page(a,n===1?Array.from({length:100},()=>({courseId:course,points:20})):[{courseId:version,points:40}],101,n,100),totalEarned:2040};});
 assert.equal(calls,2);assert.equal(data.items.length,101);assert.equal(data.totalEarned,2040);
});
test('empty server responses stay empty without preview balances or enrollments',async()=>{
 const store=createFinancialStore(replies());store.setAccount(a,['Learner']);await store.refresh();
 assert.equal(store.getSnapshot().wallet.balance,20);assert.deepEqual(store.getSnapshot().enrollments,[]);
 store.setAccount(null);assert.equal(store.getSnapshot().wallet,null);
});
test('successful purchase refreshes canonical data; failed purchase never subtracts optimistically',async()=>{
 let balance=20,items=[];
 const store=createFinancialStore(async(path,options)=>{
  if(options?.method==='POST'){balance=0;items=[enrollment];return{accountId:a,requestId,replayed:false,charge:20,enrollment};}
  return replies(a,balance,items)(path);
 });store.setAccount(a,['Learner']);await store.refresh();await store.purchase(a,intent);
 assert.equal(store.getSnapshot().wallet.balance,0);assert.equal(store.getSnapshot().enrollments[0].id,id);
 const failed=createFinancialStore(async(path,options)=>{if(options?.method==='POST')throw Object.assign(Error('insufficient_balance'),{status:409});return replies(a)(path);});
 failed.setAccount(a,['Learner']);await failed.refresh();await assert.rejects(failed.purchase(a,intent));assert.equal(failed.getSnapshot().wallet.balance,20);
});
test('switching accounts clears immediately and late previous-account reads cannot overwrite the new account',async()=>{
 let resolve;const pending=new Promise(r=>resolve=r);
 const store=createFinancialStore(async path=>path==='/me/wallet'?pending:replies(a)(path));
 store.setAccount(a,['Learner']);const old=store.refresh();store.setAccount(b,['Learner']);
 assert.equal(visibleFinancialState({...emptyFinancialState(),accountId:a,wallet:wallet(a)},b).wallet,null);
 resolve(wallet(a));await old;assert.equal(store.getSnapshot().accountId,b);assert.equal(store.getSnapshot().wallet,null);
});
test('a late successful mutation cannot update another account or initiate a follow-up purchase',async()=>{
 let finish;const pending=new Promise(r=>finish=r);
 const store=createFinancialStore(async(path,options)=>options?.method==='POST'?pending:replies(a)(path));store.setAccount(a,['Learner']);await store.refresh();
 const purchase=store.purchase(a,intent);store.setAccount(b,['Learner']);finish({accountId:a,requestId,replayed:false,charge:20,enrollment});
 await assert.rejects(purchase,/account_changed/);assert.equal(store.getSnapshot().wallet,null);await assert.rejects(store.purchase(a,intent),/account_changed/);
});
test('expired or mismatched sessions clear financial data instead of preserving a stale balance',async()=>{
 let expired=false;const store=createFinancialStore(async path=>{if(expired)throw Object.assign(Error('unauthorized'),{status:401});return replies(a)(path);});
 store.setAccount(a,['Learner']);await store.refresh();expired=true;await store.refresh();assert.equal(store.getSnapshot().wallet,null);assert.equal(store.getSnapshot().error.status,401);
});
test('instructor-only refresh does not request learner enrollments',async()=>{
 const store=createFinancialStore(async path=>{assert.ok(!path.startsWith('/me/enrollments'));return replies(a)(path);});store.setAccount(a,['Instructor']);await store.refresh();assert.equal(store.getSnapshot().error,null);
});
test('financial errors provide Arabic/English feedback without rendering provider details',()=>{
 assert.match(financialMessage({code:'insufficient_balance'},'en'),/20/);assert.match(financialMessage({code:'purchase_disabled'},'ar'),/التسجيل/);assert.ok(!financialMessage({code:'private-sql-message'},'en').includes('private'));
});

const vite=await createServer({cacheDir:'node_modules/.vite-enrollment-tests',optimizeDeps:{noDiscovery:true,include:[]},server:{middlewareMode:true},appType:'custom'});
let modules;try{modules=await Promise.all(['/src/context/FinancialContext.jsx','/src/context/LearnerContext.jsx','/src/context/AccountSessionContext.jsx','/src/context/PreferencesContext.jsx','/src/pages/learner/LearnerCoursesPage.jsx','/src/pages/learner/LearnerPointsPage.jsx','/src/components/learner/EnrollmentAction.jsx'].map(path=>vite.ssrLoadModule(path)));}finally{await vite.close();}
const [financial,learner,account,preferences,myCourses,points,action]=modules;
const storage=new Map();globalThis.localStorage={getItem:k=>storage.get(k),setItem:(k,v)=>storage.set(k,v)};globalThis.window={localStorage};
function render(component,state={},language='en',session={status:'authenticated',session:{profile:{id:a,roles:['Learner']}}}){
 storage.set('esham-language',language);const value={...emptyFinancialState(),accountId:a,refresh:async()=>{},...state};
 return renderToString(h(MemoryRouter,null,h(preferences.PreferencesProvider,null,h(account.AccountSessionContext.Provider,{value:session},h(financial.FinancialContext.Provider,{value},h(learner.LearnerProvider,null,component))))));
}
test('My Courses renders persisted enrollments and detail links, including unavailable historical courses',()=>{
 const html=render(h(myCourses.default),{enrollments:[enrollment],enrollmentTotal:1});assert.match(html,/Real saved course/);assert.ok(html.includes('/learner/enrollments/'+id));assert.ok(!html.includes('/'+course+'/learn'));
 assert.match(render(h(myCourses.default),{enrollments:[{...enrollment,isAvailable:false}],enrollmentTotal:1}),/enrollment is retained/);
});
test('wallet renders canonical amounts, loading/error/empty states and keeps existing styling in both languages',()=>{
 for(const lang of ['ar','en']){const html=render(h(points.default),{wallet:wallet(a,0)},lang);assert.match(html,/wallet-balance/);assert.match(html,/<strong>0<\/strong>/);}
 assert.match(render(h(points.default),{loading:true}),/Loading wallet/);assert.match(render(h(points.default),{error:{status:503}}),/Retry/);
 assert.match(render(h(myCourses.default)),/No enrollments/);
});
test('public purchase UI requires verified session and stays disabled before the server gate is confirmed',()=>{
 const props={course:{id:course,publishedVersionId:version,instructorId:b},language:'en'};
 assert.match(render(h(action.default,props)),/disabled/);
 assert.match(render(h(action.default,props),{},'en',{status:'anonymous',session:null}),/Sign in to enroll/);
 assert.match(render(h(action.default,props),{},'en',{status:'authenticated',session:{profile:{id:a,roles:['Instructor']}}}),/Learner membership/);
});
