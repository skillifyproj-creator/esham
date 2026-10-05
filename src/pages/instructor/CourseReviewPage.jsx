import { courses } from "../../data/courses";
import PendingFeature from "../../components/shared/PendingFeature";
import { Link } from "react-router";
import Icon from "../../components/Icon";
import InstructorCourseStepper from "../../components/instructor/InstructorCourseStepper";

const courseSections = [
  {
    number: 1,
    title: "أساسيات التصوير ومثلث التعريض",
    lessons: [
      { title: "مقدمة في فن ومفاهيم التصوير الفوتوغرافي", duration: "15 دقيقة", type: "فيديو" },
      { title: "أنواع الكاميرات والعدسات المناسبة للمبتدئين", duration: "12 دقيقة", type: "PDF" },
      { title: "مثلث التعريض الضوئي والتحكم اليدوي", duration: "20 دقيقة", type: "فيديو" },
      { title: "اختبار شامل: قياس مهارات التحكم بالتعريض", duration: "8 دقائق", type: "تاسك" },
    ],
  },
  {
    number: 2,
    title: "فهم الضوء وزوايا السقوط في اللقطة",
    lessons: [
      { title: "فهم سلوك الضوء وزوايا السقوط في اللقطة", duration: "18 دقيقة", type: "فيديو" },
      { title: "مصادر الإضاءة الطبيعية ومعدات الاستوديو", duration: "14 دقيقة", type: "فيديو" },
      { title: "قواعد التكوين الإبداعي وقاعدة الأثلاث", duration: "22 دقيقة", type: "فيديو" },
      { title: "مهمة عملية: التقاط 3 صور فوتوغرافية", duration: "20 دقيقة", type: "تاسك" },
    ],
  },
  {
    number: 3,
    title: "مشاريع تصوير حقيقية وجلسات الاستوديو",
    lessons: [
      { title: "تصوير البورتريه وضبط تفاصيل البشرة", duration: "20 دقيقة", type: "فيديو" },
      { title: "تصوير الطبيعة والمعالم بالضوء الطبيعي", duration: "18 دقيقة", type: "فيديو" },
      { title: "تقنيات التصوير في الإضاءة الخافتة والليلية", duration: "16 دقيقة", type: "فيديو" },
      { title: "المشروع النهائي للدورة: معرض مصغر 5 صور", duration: "مهمة نهائية", type: "مشروع" },
    ],
  },
];

const checklist = [
  "المعلومات الأساسية مكتملة",
  "صورة الغلاف مناسبة ومقاسها صحيح",
  "وصف الدورة مكتمل وواضح",
  "جميع الأقسام والدروس مضافة",
  "محتوى الدروس متوفر",
  "التاسكات العملية مضافة",
  "منهاج الدورة منظم بشكل صحيح",
  "نظام النقاط النهائي محدد",
];

export default function CourseReviewPage() {
  return (
    <div className="instructor-review-page instructor-detail-page">
      <div className="container">
        <div className="instructor-review-header">
          <div>
            <h1>المراجعة النهائية قبل الإرسال</h1>
            <p>
              راجع تفاصيل دورتك ومحتواها قبل إرسالها إلى فريق التدقيق
              والاعتماد الأكاديمي.
            </p>
          </div>

          <div className="instructor-review-header-actions">
            <Link
              to="/instructor/courses/new/curriculum"
              className="instructor-review-back-button"
            >
              <Icon name="arrow-left" size={15} />
              العودة لتحرير المنهج
            </Link>

            <PendingFeature

              className="instructor-review-submit-button"
            >
              إرسال الدورة للمراجعة
              <Icon name="arrow-left" size={15} />
            </PendingFeature>
          </div>
        </div>

        <InstructorCourseStepper currentStep={3} />

        <div className="instructor-review-layout">
          {/* Main Preview */}
          <main className="instructor-review-content">
            <section className="instructor-review-preview-status">
              <div>
                <Icon name="eye" size={17} />
                <div>
                  <strong>وضع المعاينة للمتعلم (Learner View)</strong>
                  <span>
                    هكذا ستظهر الدورة للمتعلمين بعد اعتمادها على منصة إسهام.
                  </span>
                </div>
              </div>

              <span>معاينة نهائية</span>
            </section>

            <section className="instructor-course-preview-card">
              <div className="instructor-course-preview-cover">
                <img
                  src={courses.find(course => course.id === 6)?.image}
                  alt="التصوير الفوتوغرافي للمبتدئين"
                />

                <span className="instructor-preview-course-badge">
                  التصوير الفوتوغرافي
                </span>

                <span className="instructor-preview-points">
                  <Icon name="star" size={13} />
                  20 نقطة مكتسبة
                </span>
              </div>

              <div className="instructor-course-preview-body">
                <div className="instructor-preview-title-row">
                  <div>
                    <span className="instructor-preview-category">
                      المستوى الأكاديمي
                    </span>

                    <h2>التصوير الفوتوغرافي للمبتدئين</h2>

                    <h3>
                      التحكم اليدوي، الإضاءة، والتكوين البصري
                    </h3>
                  </div>

                  <Link to="/instructor/courses/new"  className="instructor-preview-edit">
                    <Icon name="edit" size={14} />
                    تعديل
                  </Link>
                </div>

                <div className="instructor-preview-stats">
                  <div>
                    <span>المستوى الأكاديمي</span>
                    <strong>مبتدئ</strong>
                  </div>

                  <div>
                    <span>مدة الدورة</span>
                    <strong>3 ساعات و20 دقيقة</strong>
                  </div>

                  <div>
                    <span>الدروس والأنشطة</span>
                    <strong>12 درسًا</strong>
                  </div>

                  <div>
                    <span>النقاط المكتسبة</span>
                    <strong>20 نقطة</strong>
                  </div>
                </div>

                <div className="instructor-preview-tags">
                  <span>التصوير الفوتوغرافي</span>
                  <span>الإضاءة</span>
                  <span>التكوين البصري</span>
                  <span>التصوير اليدوي</span>
                </div>
              </div>
            </section>

            <section className="instructor-review-section">
              <div className="instructor-review-section-heading">
                <div>
                  <Icon name="lesson" size={17} />
                  <h2>عن الدورة التدريبية</h2>
                </div>

                <Link to="/instructor/courses/new" >
                  <Icon name="edit" size={13} />
                  تعديل الوصف
                </Link>
              </div>

              <p>
                صممت هذه الدورة خصيصًا للمصورين المبتدئين وهواة التصوير الذين
                يرغبون في الانتقال من وضعية التصوير التلقائي إلى التحكم اليدوي
                الكامل. ستتعلم خلال الدورة أساسيات التصوير الفوتوغرافي، فهم
                الإضاءة، اختيار الإعدادات المناسبة، وبناء تكوين بصري متوازن.
              </p>

              <p>
                سنستكشف معًا كيفية قراءة الضوء، اختيار سرعة الغالق وفتحة
                العدسة وحساسية ISO، بالإضافة إلى تطبيقات عملية تساعدك على
                تطوير مهاراتك في التصوير.
              </p>
            </section>

            <section className="instructor-review-section">
              <div className="instructor-review-section-heading">
                <div>
                  <Icon name="check" size={17} />
                  <h2>ماذا سيتعلم الطالب في هذه الدورة؟</h2>
                </div>

                <Link to="/instructor/courses/new" >
                  <Icon name="edit" size={13} />
                  تعديل المخرجات
                </Link>
              </div>

              <div className="instructor-learning-outcomes">
                <article>
                  <Icon name="check" size={15} />
                  <span>
                    فهم مثلث التعريض الضوئي ISO وفتحة العدسة وسرعة الغالق.
                  </span>
                </article>

                <article>
                  <Icon name="check" size={15} />
                  <span>
                    إتقان التكوين البصري وتطبيق قواعد الأثلاث والخطوط الإرشادية.
                  </span>
                </article>

                <article>
                  <Icon name="check" size={15} />
                  <span>
                    التعامل مع مصادر الإضاءة الطبيعية والصناعية في الاستوديو.
                  </span>
                </article>

                <article>
                  <Icon name="check" size={15} />
                  <span>
                    تطبيق المهارات عمليًا من خلال مهام ومشاريع تصوير حقيقية.
                  </span>
                </article>
              </div>
            </section>

            <section className="instructor-review-section instructor-curriculum-preview">
              <div className="instructor-review-section-heading">
                <div>
                  <Icon name="book" size={17} />
                  <h2>منهاج ومحتوى الدورة</h2>
                </div>

                <Link to="/instructor/courses/new/curriculum" >
                  <Icon name="edit" size={13} />
                  تعديل المنهج
                </Link>
              </div>

              <div className="instructor-curriculum-summary">
                3 أقسام رئيسية · 12 درسًا · 3 مهام عملية · 3 ساعات و20 دقيقة
              </div>

              <div className="instructor-review-sections">
                {courseSections.map((section) => (
                  <article
                    className="instructor-review-course-section"
                    key={section.number}
                  >
                    <div className="instructor-review-section-title">
                      <div>
                        <span>{section.number}</span>
                        <div>
                          <strong>
                            القسم {section.number}: {section.title}
                          </strong>
                          <small>{section.lessons.length} دروس</small>
                        </div>
                      </div>

                      <Icon name="chevron-down" size={16} />
                    </div>

                    <div className="instructor-review-lessons">
                      {section.lessons.map((lesson, index) => (
                        <div
                          className="instructor-review-lesson"
                          key={lesson.title}
                        >
                          <div>
                            <span>{index + 1}</span>
                            <strong>{lesson.title}</strong>
                          </div>

                          <div className="instructor-review-lesson-meta">
                            <small>{lesson.type}</small>
                            <span>{lesson.duration}</span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </article>
                ))}
              </div>
            </section>

            <section className="instructor-review-instructor-card">
              <div className="instructor-review-instructor-avatar">
                <Icon name="user" size={25} />
              </div>

              <div>
                <span>المدرب</span>
                <h3>أحمد خالد</h3>
                <p>
                  مدرب تصوير فوتوغرافي بخبرة عملية في تدريب المبتدئين وصناعة
                  المحتوى البصري.
                </p>
              </div>
            </section>
          </main>

          {/* Sidebar */}
          <aside className="instructor-review-sidebar">
            <section className="instructor-readiness-card">
              <div className="instructor-readiness-heading">
                <div>
                  <Icon name="check" size={17} />
                  <h2>تدقيق الجاهزية للنشر</h2>
                </div>

                <strong>100% مكتمل</strong>
              </div>

              <div className="instructor-readiness-list">
                {checklist.map((item) => (
                  <div key={item}>
                    <Icon name="check" size={14} />
                    <span>{item}</span>
                  </div>
                ))}
              </div>

              <div className="instructor-readiness-note">
                <Icon name="info" size={16} />
                <p>
                  دورتك جاهزة للإرسال. بعد الإرسال سيقوم فريق التدقيق بمراجعة
                  المحتوى واعتماده خلال 24–48 ساعة.
                </p>
              </div>
            </section>

            <section className="instructor-review-points-card">
              <div>
                <Icon name="award" size={20} />
                <span>نقاط النظام المكتسبة</span>
              </div>

              <strong>20 نقطة استحقاق</strong>

              <p>
                تحصل على النقاط عند اعتماد الدورة ونشرها على المنصة.
              </p>
            </section>

            <section className="instructor-final-submit-card">
              <div>
                <Icon name="arrow-left" size={18} />
                <div>
                  <h2>إرسال الدورة للمراجعة والتدقيق</h2>
                  <p>
                    تأكدت من أن جميع بيانات الدورة ومحتواها جاهزة للإرسال.
                  </p>
                </div>
              </div>

              <PendingFeature >
                تأكيد الإرسال للتدقيق
                <Icon name="arrow-left" size={15} />
              </PendingFeature>

              <Link to="/instructor/courses/new/curriculum">
                العودة للتعديل
              </Link>
            </section>
          </aside>
        </div>
      </div>
    </div>
  );
}
