import { financialRequest,bindAccount,isGuid,FinancialError } from './financialApi.js';
export function reviewCsvCell(value){let text=String(value??'');if(/^[=+\-@\t\r]/.test(text))text="'"+text;return '"'+text.replaceAll('"','""')+'"';}
export const reviewError=(language)=>language==='ar'?'تعذّر حفظ التقييم. حدّث البيانات وراجع صلاحيات الحساب ثم حاول مجددًا.':'Unable to save the review. Refresh the data, check account access and retry.';
export function ownedReviewEnrollment(selected,read,accountId){
 if(read?.accountId!==accountId||read.enrollmentId!==selected?.id||!isGuid(read.purchasedCourseVersionId))throw new FinancialError('account_changed',409);
 return {...selected,courseVersionId:read.purchasedCourseVersionId};
}
export async function loadReviews(accountId,page=1,signal,request=financialRequest){return bindAccount(await request(`/me/reviews?page=${page}&pageSize=20`,{signal}),accountId);}
export async function mutateReview(accountId,enrollmentId,body,{withdraw=false,signal,request=financialRequest}={}){
 if(!isGuid(enrollmentId)||!isGuid(body.requestId))throw new FinancialError('validation',400);
 return bindAccount(await request(`/me/enrollments/${enrollmentId}/review`,{method:withdraw?'DELETE':'PUT',body,accountId,signal}),accountId);
}
export async function replyReview(accountId,reviewId,body,remove=false,request=financialRequest){
 if(!isGuid(reviewId))throw new FinancialError('validation',400);
 return bindAccount(await request(`/api/instructor/reviews/${reviewId}/reply`,{method:remove?'DELETE':'PUT',accountId,body}),accountId);
}
