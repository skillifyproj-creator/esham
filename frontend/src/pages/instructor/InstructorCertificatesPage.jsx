import { Link } from 'react-router';
import { usePreferences } from '../../context/PreferencesContext';
import { instructorDemo } from '../../data/instructorDemo';
import Icon from '../../components/Icon';
import '../../styles/instructor-certificates.css';

export default function InstructorCertificatesPage() {
  const { language } = usePreferences();
  const t = (ar, en) => language === 'ar' ? ar : en;
  const requirements = [
    { title: t('إكمال الدروس', 'Complete lessons'), text: t('إكمال جميع دروس الدورة.', 'Complete every lesson in the course.') },
    { title: t('اعتماد المهام', 'Approve tasks'), text: t('مراجعة واعتماد جميع المهام المطلوبة.', 'Review and approve all required tasks.') },
    { title: t('شهادة باسم المتعلّم', 'A personalized certificate'), text: t('تتضمن اسم المتعلّم والدورة والمدرّب.', 'Includes the learner, course and instructor names.') },
  ];

  return <main className="instructor-certificates" dir={language === 'ar' ? 'rtl' : 'ltr'}>
    <div className="instructor-certificates-container">
      <Link className="instructor-certificates-back" to="/instructor/courses"><span aria-hidden="true">{language === 'ar' ? '→' : '←'}</span>{t('العودة إلى دوراتي', 'Back to my courses')}</Link>
      <header className="instructor-certificates-header">
        <span className="instructor-certificates-heading-icon" aria-hidden="true"><Icon name="award" size={30}/></span>
        <div><span className="instructor-certificates-eyebrow">{t('إنجازات التعلّم', 'Learning achievements')}</span>
          <h1>{t('شهادات المتعلّمين', 'Learner certificates')}</h1>
          <p>{t('راجع متطلبات شهادات دوراتك، وساعد المتعلّمين على إكمال رحلتهم.', 'Review your course certificate requirements and help learners complete their journey.')}</p>
        </div>
      </header>

      <section className="instructor-certificates-policy" aria-labelledby="certificate-policy-title">
        <div className="instructor-certificates-policy-heading">
          <h2 id="certificate-policy-title">{t('تصدرها منصة إسهام', 'Issued by Esham')}</h2>
          <p>{t('تتاح الشهادة بعد إكمال الدروس واعتماد المهام المطلوبة. لا يمكن تجاوز شرط الإكمال.', 'Certificates become available after lessons are completed and required tasks are approved. Completion requirements cannot be bypassed.')}</p>
        </div>
        <div className="instructor-certificates-steps">
          {requirements.map((item, index) => <div className="instructor-certificates-step" key={item.title}>
            <span aria-hidden="true">{String(index + 1).padStart(2, '0')}</span>
            <div><h3>{item.title}</h3><p>{item.text}</p></div>
          </div>)}
        </div>
      </section>

      <section className="instructor-certificates-courses" aria-labelledby="certificate-courses-title">
        <div className="instructor-certificates-section-heading"><h2 id="certificate-courses-title">{t('دوراتك ومتطلبات الشهادة', 'Your courses and certificate requirements')}</h2>
          <span>{instructorDemo.courses.length} {t('دورات', 'courses')}</span>
        </div>
        <div className="instructor-certificates-grid">
          {instructorDemo.courses.map(course => <article className="instructor-certificate-course" key={course.id}>
            <span className="instructor-certificate-course-icon" aria-hidden="true"><Icon name="book" size={24}/></span>
            <h3>{course.title[language]}</h3>
            <p>{t('راجع الدروس والمهام المطلوبة للحصول على شهادة هذه الدورة.', 'Review the lessons and tasks required to earn this course certificate.')}</p>
            <Link to={`/instructor/courses/${course.id}/curriculum`} aria-label={`${t('متطلبات الدورة', 'Course requirements')}: ${course.title[language]}`}>
              {t('متطلبات الدورة', 'Course requirements')}<span aria-hidden="true">{language === 'ar' ? '←' : '→'}</span>
            </Link>
          </article>)}
        </div>
      </section>
    </div>
  </main>;
}
