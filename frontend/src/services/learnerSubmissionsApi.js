import { apiBase } from './accountApi.js';
import { financialRequest, bindAccount, isGuid, FinancialError } from './financialApi.js';
const root = enrollmentId => { if (!isGuid(enrollmentId)) throw new FinancialError('validation',400);return `/me/enrollments/${enrollmentId}`; };
export async function taskList(accountId,enrollmentId,signal,request=financialRequest) {
  const data=bindAccount(await request(root(enrollmentId)+'/tasks',{accountId,signal}),accountId);
  if(data.enrollmentId!==enrollmentId||!isGuid(data.availableCourseVersionId)||!Array.isArray(data.items)||data.items.some(t=>!isGuid(t.id)||t.courseVersionId!==data.availableCourseVersionId))throw new FinancialError('response');return data;
}
export async function attemptHistory(accountId,enrollmentId,taskId,page=1,signal,request=financialRequest) {
  if(taskId&&!isGuid(taskId))throw new FinancialError('validation');
  const data=bindAccount(await request(root(enrollmentId)+`/submissions?page=${page}`+(taskId?`&taskId=${taskId}`:''),{accountId,signal}),accountId);
  if(data.enrollmentId!==enrollmentId||!Array.isArray(data.items)||!Number.isInteger(data.totalCount))throw new FinancialError('response');return data;
}
function validateAttempt(data,accountId,enrollmentId) {
  bindAccount(data,accountId);if(data.enrollmentId!==enrollmentId||!isGuid(data.id)||!isGuid(data.courseVersionId)||!data.draftToken||!['inProgress','awaitingReview','approved','rejected'].includes(data.status))throw new FinancialError('response');return data;
}
export async function attemptDetail(accountId,enrollmentId,id,signal,request=financialRequest) {
  if(!isGuid(id))throw new FinancialError('validation');const data=validateAttempt(await request(root(enrollmentId)+`/submissions/${id}`,{accountId,signal}),accountId,enrollmentId);if(data.id!==id)throw new FinancialError('response');return data;
}
export async function createAttempt(accountId,enrollmentId,taskId,versionId,requestId,signal,request=financialRequest) {
  if(![taskId,versionId,requestId].every(isGuid))throw new FinancialError('validation');
  const data=validateAttempt(await request(root(enrollmentId)+`/tasks/${taskId}/submissions`,{method:'POST',accountId,signal,body:{requestId,expectedCourseVersionId:versionId}}),accountId,enrollmentId);
  if(data.courseTaskId!==taskId||data.courseVersionId!==versionId)throw new FinancialError('response');return data;
}
export async function mutateAttempt(accountId,enrollmentId,attempt,kind,extra={},signal,request=financialRequest) {
  if(!['draft','submit','remove'].includes(kind)||!isGuid(attempt.id)||!isGuid(attempt.courseVersionId))throw new FinancialError('validation');
  const body={expectedTaskVersionId:attempt.courseVersionId,expectedDraftToken:attempt.draftToken,...(kind==='draft'?{answerText:extra.answerText,workUrl:extra.workUrl}:{})};
  if(kind==='remove'&&!isGuid(extra.attachmentId))throw new FinancialError('validation');
  const suffix=kind==='remove'?`attachments/${extra.attachmentId}`:kind;
  const data=validateAttempt(await request(root(enrollmentId)+`/submissions/${attempt.id}/${suffix}`,{method:kind==='draft'?'PUT':kind==='remove'?'DELETE':'POST',accountId,body,signal}),accountId,enrollmentId);
  if(data.id!==attempt.id||data.courseVersionId!==attempt.courseVersionId)throw new FinancialError('response');return data;
}
export function validateSubmissionFile(file,count=0) {
  if(count>=5||!file?.size||file.size>10*1024*1024||!['pdf','png','jpg','jpeg','webp','txt','docx'].includes(file.name.split('.').pop()?.toLowerCase()))throw new FinancialError('invalid_attachment',400);
}
export async function uploadAttemptFile(accountId,enrollmentId,attempt,file,uploadId,signal,fetcher=fetch) {
  validateSubmissionFile(file,attempt.attachments.length);if(!isGuid(uploadId))throw new FinancialError('validation');
  const mime={pdf:'application/pdf',png:'image/png',jpg:'image/jpeg',jpeg:'image/jpeg',webp:'image/webp',txt:'text/plain',docx:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'};
  const type=mime[file.name.split('.').pop().toLowerCase()];const form=new FormData();form.append('uploadId',uploadId);form.append('expectedTaskVersionId',attempt.courseVersionId);form.append('expectedDraftToken',attempt.draftToken);
  form.append('file',new Blob([file],{type}),file.name);
  const response=await fetcher(apiBase+root(enrollmentId)+`/submissions/${attempt.id}/attachments`,{method:'POST',credentials:'include',signal:signal?AbortSignal.any([signal,AbortSignal.timeout(60000)]):AbortSignal.timeout(60000),
    headers:{'X-Requested-With':'XMLHttpRequest','X-Esham-Account-Id':accountId},body:form});
  const data=await response.json().catch(()=>null);if(!response.ok)throw new FinancialError(response.status===401?'unauthorized':data?.code||'request',response.status);
  return validateAttempt(data,accountId,enrollmentId);
}
export function submissionFileUrl(path,enrollmentId,base=apiBase) {
  const prefix=root(enrollmentId);const id='[0-9a-f-]{36}';
  if(typeof path!=='string'||!new RegExp(`^${prefix}/(?:tasks|submissions)/${id}/attachments/${id}/content$`,'i').test(path))throw new FinancialError('response');return base+path;
}
export function submissionMessage(error,language) {
  const copy={submission_disabled:['التسليم معطّل في هذه البيئة.','Submission changes are disabled in this environment.'],draft_conflict:['تغيّرت المسودة؛ حدّثها قبل الحفظ.','The draft changed. Reload before saving.'],publication_changed:['تم تحديث الدورة؛ المسودة السابقة للقراءة فقط.','The course was updated; the previous draft is read-only.'],attempt_pending:['توجد محاولة قيد التنفيذ أو المراجعة.','An editable or pending attempt already exists.'],submission_locked:['هذه المحاولة مقفلة.','This attempt is locked.'],upload_conflict:['تعارض مع هوية الرفع. لا تعِد إنشاء الطلب تلقائيًا.','Upload identity conflict. Do not automatically create another request.'],invalid_attachment:['ملف غير صالح. الحد خمسة ملفات، 10 MiB للملف. DOC غير مدعوم.','Invalid file. Maximum five files, 10 MiB each. DOC is unsupported.'],empty_submission:['أضف إجابة أو رابطًا صالحًا أو ملفًا قبل التسليم.','Add an answer, valid work URL or file before submitting.']};
  return (copy[error?.code]||['تعذّر تحميل أو حفظ التسليم. حدّث الحالة وأعد المحاولة.','Unable to load or save the submission. Refresh its state before retrying.'])[language==='ar'?0:1];
}
