import { accountRequest, AccountApiError } from './accountApi.js';
const guid = value => typeof value === 'string' && /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i.test(value) && !/^0{8}-0{4}-0{4}-0{4}-0{12}$/.test(value);
export async function loadEnrollmentVersionState(enrollmentId, request = accountRequest) {
 if (!guid(enrollmentId)) throw new AccountApiError('validation', 400);
 const state = await request('/me/enrollments/' + enrollmentId + '/version-state', undefined, {method:'GET'});
 if (state?.enrollmentId !== enrollmentId || !guid(state.originalCourseVersionId) || !guid(state.availableCourseVersionId)
   || typeof state.isCourseCompleted !== 'boolean' || !Number.isInteger(state.progressPercentage)
   || state.progressPercentage < 0 || state.progressPercentage > 100 || !Array.isArray(state.lessons) || !Array.isArray(state.tasks))
   throw new AccountApiError('response');
 return state;
}
// Presentation adapters only: never mutate old local enrollments, marks or points.
// Actual playback/submission APIs are intentionally still unavailable until Mais implements them.
export function versionContentActions(state, item, kind) {
 return {
   earned: kind === 'task' ? item.isApproved === true : item.isCompleted === true,
   inherited: item.isInherited === true,
   isNew: item.isNewToEnrollment === true,
   updated: item.isUpdated === true,
   optional: state.isCourseCompleted === true || item.isOptional === true,
   canRevisit: kind === 'lesson' && state.learnerContentApiAvailable === true && item.revisitAllowedByPolicy === true,
   canResubmit: kind === 'task' && state.learnerSubmissionApiAvailable === true && item.optionalResubmissionAllowedByPolicy === true,
 };
}
export const versionProgressPercentage = state => state.isCourseCompleted ? 100 : state.progressPercentage;
