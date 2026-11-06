import { test } from 'node:test';
import assert from 'node:assert/strict';
import { loadAdminOverview,loadAdminCategories,loadCategoryAssignments,saveCategoryAssignments,saveAdminCategory,setAdminCategoryStatus } from '../src/services/adminIntegration.js';
test('admin reads and category writes use real APIs, credentials and current assignment version',async()=>{
 const original=globalThis.fetch,calls=[];globalThis.fetch=async(url,options)=>{calls.push({url,options});return{ok:true,status:200,json:async()=>({})}};
 try{await loadAdminOverview();await loadAdminCategories();await loadCategoryAssignments('id');await saveCategoryAssignments('id',['existing-role-holder'],'A'.repeat(64));await saveAdminCategory(null,{nameAr:'Arabic',nameEn:'English',displayOrder:0});await saveAdminCategory('id',{nameAr:'Changed',nameEn:'Changed'});await setAdminCategoryStatus('id',false);
 assert.match(calls[0].url,/api\/admin\/overview$/);assert.match(calls[1].url,/api\/admin\/categories$/);assert.equal(calls[3].options.method,'PUT');assert.equal(JSON.parse(calls[3].options.body).expectedVersion,'A'.repeat(64));assert.equal(calls[4].options.method,'POST');assert.equal(calls[5].options.method,'PUT');assert.equal(calls[6].options.method,'PATCH');assert.deepEqual(JSON.parse(calls[6].options.body),{isActive:false});assert(calls.every(x=>x.options.credentials==='include'&&x.options.headers['X-Requested-With']==='XMLHttpRequest'));
 globalThis.fetch=async()=>({ok:false,status:409,json:async()=>({title:'Assignments changed'})});await assert.rejects(saveCategoryAssignments('id',[],'old'),/Assignments changed/);
 }finally{globalThis.fetch=original;}
});

test('CategoryAdmin creation sends only fixed provisioning fields, propagates errors and never accepts role injection', async () => {
 const { createCategoryAdministrator } = await import('../src/services/adminIntegration.js');
 let sent;
 await createCategoryAdministrator({ name: 'Isolated admin', email: 'isolated@test.invalid', password: 'Synthetic123!', categoryIds: [], roles: ['GeneralAdmin'] }, async (...args) => { sent = args; return { id: 'created' }; });
 assert.equal(sent[0], '/admin/users/category-admins'); assert.equal(sent[2], 'POST');
 assert.deepEqual(Object.keys(sent[1]).sort(), ['categoryIds','email','name','password']);
 await assert.rejects(() => createCategoryAdministrator({name:'Test', email:'test@test.invalid', password:'Synthetic123!', categoryIds:[]}, async () => { throw new Error('Rejected'); }), /Rejected/);
});
