import WorkspaceNavigation from '../shared/WorkspaceNavigation';
import { usePreferences } from '../../context/PreferencesContext';
import instructorCopy from '../../i18n/instructorCopy';
import { instructorDemo } from '../../data/instructorDemo';

export default function InstructorNavigation() {
  const { language } = usePreferences();
  const c = instructorCopy[language];
  const links = [
    { to: '/instructor', label: c.dashboard, icon: 'grid', end: true },
    { to: '/instructor/courses', label: c.myCourses, icon: 'book' },
    { to: '/instructor/courses/new', label: c.createCourse, icon: 'plus' },
    { to: '/instructor/submissions', label: language === 'ar' ? 'تسليمات المتعلّمين' : 'Learner submissions', icon: 'check' },
    { to: '/instructor/performance', label: c.performance, icon: 'chart' },
    { to: '/instructor/feedback', label: c.feedback, icon: 'star' },
  ];
  return <WorkspaceNavigation role="instructor" name={instructorDemo.instructor.name[language]} links={links} activityLabel={language === 'ar' ? 'إدارة التعليم' : 'Teaching tools'}/>;
}
