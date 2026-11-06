import test from 'node:test';
import assert from 'node:assert/strict';
import { loadEnrollmentVersionState, versionContentActions, versionProgressPercentage } from '../src/services/learnerVersionApi.js';
const id='00000001-1111-4111-8111-111111111111', original='00000002-1111-4111-8111-111111111111', available='00000003-1111-4111-8111-111111111111';
const state={enrollmentId:id,originalCourseVersionId:original,availableCourseVersionId:available,isCourseCompleted:false,progressPercentage:50,lessons:[],tasks:[]};
test('learner version contract uses the owned enrollment and server supplied version state',async()=>{
 const result=await loadEnrollmentVersionState(id,async(path,body,options)=>{assert.equal(path,'/me/enrollments/'+id+'/version-state');assert.equal(body,undefined);assert.equal(options.method,'GET');return state});
 assert.equal(result.originalCourseVersionId,original);assert.equal(result.availableCourseVersionId,available);
 await assert.rejects(loadEnrollmentVersionState('demo',async()=>state),e=>e.status===400);
 await assert.rejects(loadEnrollmentVersionState(id,async()=>({...state,enrollmentId:available})),e=>e.code==='response');
});
test('API failure never announces a local successful version switch',async()=>{
 await assert.rejects(loadEnrollmentVersionState(id,async()=>{throw new Error('Availability not initialized')}),/not initialized/);
});
test('earned achievements remain separate from optional actions which are disabled without real APIs',()=>{
 const item={isApproved:true,isInherited:true,isUpdated:true,isOptional:true,optionalResubmissionAllowedByPolicy:true};
 assert.deepEqual(versionContentActions(state,item,'task'),{earned:true,inherited:true,isNew:false,updated:true,optional:true,canRevisit:false,canResubmit:false});
 assert.equal(versionContentActions({...state,learnerSubmissionApiAvailable:true},item,'task').canResubmit,true);
 const lesson={isCompleted:true,revisitAllowedByPolicy:true};assert.equal(versionContentActions(state,lesson,'lesson').earned,true);assert.equal(versionContentActions(state,lesson,'lesson').canRevisit,false);
});
test('completed learners keep 100 percent and newly added content is optional',()=>{
 const done={...state,isCourseCompleted:true};assert.equal(versionProgressPercentage(done),100);
 assert.equal(versionContentActions(done,{isNewToEnrollment:true},'lesson').optional,true);assert.equal(versionProgressPercentage(state),50);
});
