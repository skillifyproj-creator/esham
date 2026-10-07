import VideoSafetyStatus from '../../components/shared/VideoSafetyStatus';
﻿import { Link, useLocation, useNavigate, useParams } from "react-router";
import { getInstructorCourseWorkspace } from "../../data/instructorCourseWorkspace";
import Icon from "../../components/Icon";
import { usePreferences } from "../../context/PreferencesContext";
import "../../styles/instructor.css";

const copy = {
  ar: {
    courses: "دوراتي", courseFallback: "اسم الدورة", sectionFallback: "اسم القسم",
    lessonFallback: "إضافة فيديو للدرس", title: "إضافة فيديو للدرس",
    subtitle: "اختر طريقة إضافة الفيديو إلى هذا الدرس.", record: "تسجيل فيديو جديد",
    recordDescription: "سجّل الفيديو مباشرة من داخل المنصة باستخدام كاميرا جهازك وميكروفونه.",
    start: "ابدأ التسجيل", upload: "رفع فيديو من جهازك",
    uploadDescription: "اختر فيديو جاهزًا من جهازك أو اسحبه إلى هنا.",
    drag: "اسحب الفيديو هنا", or: "أو اختره من جهازك", choose: "اختيار فيديو",
    formats: "MP4 · WebM · MOV", max: "الحد الأقصى 2 GB",
    info: "الصيغ المدعومة: MP4, WebM, MOV • الجودة الموصى بها: 1080p • الحد الأقصى لحجم الملف: 2 GB",
  },
  en: {
    courses: "My courses", courseFallback: "Course name", sectionFallback: "Section name",
    lessonFallback: "Add lesson video", title: "Add a video to the lesson",
    subtitle: "Choose how to add a video to this lesson.", record: "Record a new video",
    recordDescription: "Record directly in the platform using your device camera and microphone.",
    start: "Start recording", upload: "Upload a video from your device",
    uploadDescription: "Choose a ready video from your device or drag it here.",
    drag: "Drag the video here", or: "or choose it from your device", choose: "Choose video",
    formats: "MP4 · WebM · MOV", max: "Maximum size 2 GB",
    info: "Supported formats: MP4, WebM, MOV • Recommended quality: 1080p • Maximum file size: 2 GB",
  },
};

export default function InstructorVideoSourcePage() {
  const { courseId, sectionId, lessonId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = usePreferences();
  const t = copy[language] || copy.ar;
  const workspace = getInstructorCourseWorkspace(courseId);
  const course = workspace?.course;
  const section = (workspace?.sections || []).find((item) => String(item.id) === String(sectionId));
  const lesson = section?.lessons.find((item) => String(item.id) === String(lessonId));
  const courseTitle = course && String(course.id) === String(courseId)
    ? course.title[language] || course.title.ar
    : t.courseFallback;
  const sectionTitle = section?.title?.[language] || section?.title?.ar || t.sectionFallback;
  const lessonTitle = lesson?.title?.[language] || lesson?.title?.ar || t.lessonFallback;
  const basePath = `/instructor/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}/video`;

  if (!workspace || !section || (lessonId !== 'new' && !section.lessons.some(lesson => String(lesson.id) === String(lessonId)))) return <main className="container instructor-detail-page"><h1>{language === 'ar' ? 'لم يتم العثور على الدرس أو القسم' : 'Lesson or section not found'}</h1><button type="button" className="button" onClick={() => navigate('/instructor/courses')}>{language === 'ar' ? 'العودة إلى دوراتي' : 'Back to my courses'}</button></main>;
  return (<main className="instructor-video-source-page instructor-detail-page">
      <p className="instructor-media-demo-note" role="note">{language === 'ar' ? 'معاينة لمسار الفيديو: التسجيل والتشغيل والقص محاكاة للتصميم، ولا يُنشأ أو يُرفع أو يُعدّل ملف فيديو فعليًا.' : 'Video workflow preview: recording, playback and trimming are simulated. No video file is created, uploaded or edited.'}</p>
      <div className="container">
        <nav className="instructor-video-source-breadcrumb" aria-label={language === "ar" ? "مسار التنقل" : "Breadcrumb"}>
          <Link to="/instructor/courses">{t.courses}</Link><span>/</span>
          <Link to={`/instructor/courses/${courseId}/curriculum`}>{courseTitle}</Link><span>/</span>
          <span>{sectionTitle}</span><span>/</span><strong>{lessonTitle}</strong>
        </nav>
        <header className="instructor-video-source-header">
          <h1>{t.title}</h1><p>{t.subtitle}</p><VideoSafetyStatus/>
        </header>
        <section className="instructor-video-source-options" aria-label={t.title}>
          <article className="instructor-video-source-card">
            <div className="instructor-video-source-preview" aria-hidden="true">
              <span><Icon name="camera" size={30} /></span>
            </div>
            <div className="instructor-video-source-card-copy">
              <h2>{t.record}</h2><p>{t.recordDescription}</p>
            </div>
            <button type="button" className="instructor-button" onClick={() => navigate(`${basePath}/record`, { state: location.state })}>{t.start}</button>
          </article>
          <article className="instructor-video-source-card">
            <div className="instructor-video-source-card-copy">
              <h2>{t.upload}</h2><p>{t.uploadDescription}</p>
            </div>
            <label className="instructor-video-source-dropzone">
              <Icon name="cloud" size={28} />
              <strong>{t.drag}</strong><span>{t.or}</span>
              <span className="instructor-button instructor-video-source-file-button">{t.choose}</span>
              <input type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const encoding = file.name.split(".").pop()?.toUpperCase() || "VIDEO"; const size = file.size >= 1024 ** 3 ? `${(file.size / 1024 ** 3).toFixed(1)} GB` : `${Math.max(1, Math.round(file.size / 1024 ** 2))} MB`; const lessonDraft = location.state?.lessonDraft || {}; const video = { ...lessonDraft.video, name: file.name, size, encoding, duration: lessonDraft.video?.duration || "15:32", quality: lessonDraft.video?.quality || "1080p" }; navigate(`${basePath}/preview`, { state: { ...location.state, lessonDraft, video, videoUrl: file.name } }); }} />
            </label>
            <div className="instructor-video-source-file-limits"><span>{t.formats}</span><span>{t.max}</span></div>
          </article>
        </section>
        <aside className="instructor-video-source-info"><Icon name="info" size={17} /><p>{t.info}</p></aside>
      </div>
    </main>
  );
}
