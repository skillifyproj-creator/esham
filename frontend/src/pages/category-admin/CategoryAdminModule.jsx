import CourseReviewActivityPage from '../shared/CourseReviewActivityPage';
import { Navigate, Outlet } from 'react-router';
import { useAccountSession } from '../../context/AccountSessionContext';
import { usePreferences } from '../../context/PreferencesContext';
import AdminWorkspace from '../../components/admin/AdminWorkspace';
import AccountNotificationsPage from '../shared/NotificationsPage';
import { CourseReviewQueue, CourseReviewAdminDetail } from '../shared/CourseReviewAdminPages';
import '../../styles/category-admin.css';
export function CategoryAdminProvider() {
 const account=useAccountSession(),{language}=usePreferences();
 if(account.status==='anonymous')return <Navigate to="/login" replace/>;
 if(account.status!=='authenticated')return <p role="status">{language==='ar'?'جارٍ التحقق من الحساب…':'Checking account…'}</p>;
 if(!account.session.profile.roles?.includes('CategoryAdmin'))return <p role="alert">{language==='ar'?'هذه الصفحة لمدير التصنيف فقط.':'CategoryAdmin membership is required.'}</p>;
 return <Outlet/>;
}
export function CategoryAdminLayout() {
 const {session}=useAccountSession();
 return <AdminWorkspace variant="ca" links={[
 {to:'/category-admin',label:'dashboard',icon:'grid',end:true},{to:'/category-admin/courses',label:'courses',icon:'book'},
 {to:'/category-admin/activity',label:'activity',icon:'history'},{to:'/category-admin/notifications',label:'notifications',icon:'bell'},
 {to:'/category-admin/moderation',label:'moderation',icon:'shield'}
 ]} profileName={session?.profile?.name||'—'} profileRole="CategoryAdmin" notificationTo="/category-admin/notifications"/>;
}
export function Dashboard(){return <CourseReviewQueue pendingOnly/>}
export function CoursesPage(){return <CourseReviewQueue/>}
export function ReviewPage(){return <CourseReviewAdminDetail/>}
export function ActivityPage(){return <CourseReviewActivityPage/>}
export function NotificationsPage(){return <AccountNotificationsPage role="category-admin"/>}
