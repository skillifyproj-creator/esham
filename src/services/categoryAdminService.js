/** Demo service boundary for the future Category Admin API. */
export function getCategoryAdminCourses(courses, admin) {
  const allowed = new Set(admin?.categoryIds || []);
  return courses.filter(course => allowed.has(course.categoryId));
}
export function getCategoryAdminCourse(courses, admin, courseId) {
  return getCategoryAdminCourses(courses, admin).find(course => course.id === courseId) || null;
}
export function getCategoryAdminActivities(items, admin) {
  const allowed = new Set(admin?.categoryIds || []);
  return items.filter(item => allowed.has(item.categoryId));
}
export function getCategoryAdminNotifications(items, admin) {
  const allowed = new Set(admin?.categoryIds || []);
  return items.filter(item => item.recipientId === admin?.id && allowed.has(item.categoryId));
}
export function getCategoryAdminDashboard(courses, activities, admin) {
  const list = getCategoryAdminCourses(courses, admin);
  const recentActivities = getCategoryAdminActivities(activities, admin).sort((a,b)=>b.createdAt.localeCompare(a.createdAt)).slice(0,5);
  return {pending:list.filter(c=>c.status==='pending').length,approved:list.filter(c=>c.status==='approved').length,rejected:list.filter(c=>c.status==='rejected').length,changesRequested:list.filter(c=>c.status==='changes_requested').length,recentActivities,waitingCourses:list.filter(c=>c.status==='pending')};
}
const decisions={approve:{status:'approved',action:'تم قبول كورس'},request_changes:{status:'changes_requested',action:'تم طلب تعديلات'},reject:{status:'rejected',action:'تم رفض كورس'}};
export function reviewCourse(courses,courseId,reviewer,decision,comment,now=new Date().toISOString()) {
  const outcome=decisions[decision]; if(!outcome) throw new Error('قرار المراجعة غير صالح');
  if(decision!=='approve'&&!comment?.trim()) throw new Error('ملاحظة المراجعة مطلوبة');
  let review=null;
  const nextCourses=courses.map(course=>{if(course.id!==courseId||!reviewer.categoryIds.includes(course.categoryId))return course;review={id:crypto.randomUUID(),courseId,reviewerId:reviewer.id,decision,comment:comment?.trim()||'',createdAt:now};return {...course,status:outcome.status,reviewerId:reviewer.id,reviewComment:review.comment,rejectionReason:decision==='reject'?review.comment:course.rejectionReason,reviewedAt:now,updatedAt:now};});
  if(!review)throw new Error('الكورس غير موجود ضمن التصنيفات المسندة');
  return {courses:nextCourses,review,action:outcome.action};
}
export const markNotificationAsRead=(items,id)=>items.map(item=>item.id===id?{...item,isRead:true}:item);
export const markAllNotificationsAsRead=(items,admin)=>items.map(item=>item.recipientId===admin.id&&admin.categoryIds.includes(item.categoryId)?{...item,isRead:true}:item);