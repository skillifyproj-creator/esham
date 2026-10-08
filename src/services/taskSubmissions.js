import { courses } from '../data/courses';
import { learnerDemo } from '../data/learnerDemo';
import { accountId, getAccountWallet } from '../data/pointsLedger';
const KEY = 'esham-assessed-work-v1';
export const TASK_EVENT = 'esham-tasks-updated';
export function courseTasks() {
  const derived = courses.flatMap(course=>course.curriculum.filter(section=>section.task).map(section=>{
    const task=section.task, bilingual=value=>typeof value==='string'?{ar:value,en:value}:value;
    return {...task,id:task.id||`${course.id}:${section.id}`,courseId:course.id,title:bilingual(task.title),description:bilingual(task.description),instructions:bilingual(task.instructions),status:'notStarted',course};
  }));
  return [...derived,...learnerDemo.tasks.filter(task=>!derived.some(item=>item.id===task.id)).map(task=>({...task,course:courses.find(course=>course.id===task.courseId)}))].filter(task=>task.course);
}
export function readTaskSubmissions() {
  try { const list=JSON.parse(localStorage.getItem(KEY)||'[]'); return Array.isArray(list)?list.filter(item=>item?.id&&item?.learnerId&&item?.taskId):[]; } catch {return [];}
}
function write(list) {localStorage.setItem(KEY,JSON.stringify(list));if(typeof window?.dispatchEvent==='function')window.dispatchEvent(new Event(TASK_EVENT));}
export function saveTaskSubmission(profile, taskId, { answer='',link='',files=[],submit=false }) {
  const task=courseTasks().find(task=>task.id===taskId),id=accountId(profile),list=readTaskSubmissions(),existing=list.find(item=>item.learnerId===id&&item.taskId===taskId);
  const enrolled=getAccountWallet(profile).enrollments.some(item=>item.courseId===task?.courseId)||(!profile.id&&learnerDemo.enrollments.some(item=>item.courseId===task?.courseId));
  if(!task||!enrolled||!['learner','both',''].includes(profile.role)||['awaitingReview','completed'].includes(existing?.status))throw new Error('task-locked');
  answer=answer.trim();link=link.trim();
  if(answer.length>5000||link.length>2000||files.length>5||files.some(file=>!file.mediaId))throw new Error('validation');
  if(link&&!['http:','https:'].includes(new URL(link).protocol))throw new Error('validation');
  if(submit&&!answer&&!link&&!files.length)throw new Error('validation');
  const next={...existing,id:`${id}:${taskId}`,learnerId:id,learnerName:profile.name||'Learner',taskId,courseId:task.courseId,answer,link,files,status:submit?'awaitingReview':'inProgress',submittedAt:submit?new Date().toISOString():null};
  write([...list.filter(item=>item.id!==next.id),next]);return next;
}
export function reviewTaskSubmission(profile, id, approved, feedback='') {
  const list=readTaskSubmissions(),record=list.find(item=>item.id===id),course=courses.find(course=>course.id===record?.courseId);
  if(!record||record.status!=='awaitingReview'||!course||course.instructorId!==accountId(profile)||!['instructor','both'].includes(profile.role))throw new Error('scope');
  if(!approved&&!feedback.trim())throw new Error('feedback');
  const next={...record,status:approved?'completed':'inProgress',feedback:feedback.trim(),reviewedAt:new Date().toISOString(),reviewerId:accountId(profile)};
  write(list.map(item=>item.id===id?next:item));return next;
}
