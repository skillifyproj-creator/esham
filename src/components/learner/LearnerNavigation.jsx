import WorkspaceNavigation from '../shared/WorkspaceNavigation';
import { usePreferences } from '../../context/PreferencesContext';
import { learnerCopy } from '../../i18n/learnerCopy';
import { learnerDemo } from '../../data/learnerDemo';

export default function LearnerNavigation() {
  const { language } = usePreferences();
  const c = learnerCopy[language];
  const t = (ar, en) => language === 'ar' ? ar : en;
  const links = [
    { to: '/learner', label: c.dashboard, icon: 'grid', end: true },
    { to: '/learner/courses', label: c.myCourses, icon: 'book' },
    { to: '/learner/tasks', label: c.tasks, icon: 'lesson' },
    { to: '/learner/progress', label: t('تقدّم التعلّم', 'Learning progress'), icon: 'chart' },
    { to: '/learner/reviews', label: t('التقييمات', 'Reviews'), icon: 'star' },
  ];
  return <WorkspaceNavigation role="learner" name={learnerDemo.name[language]} links={links} activityLabel={t('نشاطي', 'My activity')}/>;
}
