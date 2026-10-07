import { useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { getInstructorCourseWorkspace } from "../../data/instructorCourseWorkspace";
import Icon from "../../components/Icon";
import { usePreferences } from "../../context/PreferencesContext";
import "../../styles/instructor.css";

const copy = {
  ar: {
    courses: "دوراتي", courseFallback: "اسم الدورة", sectionFallback: "اسم القسم",
    title: "إعداد التسجيل",
    subtitle: "جهّز الكاميرا والميكروفون وطريقة عرض المحتوى قبل بدء التسجيل.",
    preview: "معاينة الكاميرا", cameraOff: "الكاميرا غير متصلة",
    camera: "الكاميرا", cameraDevice: "اختيار جهاز الكاميرا", defaultCamera: "الكاميرا الافتراضية",
    notConnected: "غير متصلة", microphone: "الميكروفون", micDevice: "اختيار جهاز الميكروفون",
    defaultMic: "الميكروفون الافتراضي", audioLevel: "مستوى الصوت", screen: "مشاركة الشاشة",
    screenToggle: "مشاركة الشاشة أثناء التسجيل",
    screenDescription: "يمكنك عرض الشاشة مع ظهور الكاميرا حسب التخطيط المختار.",
    layout: "شكل الفيديو", layoutHelp: "اختر كيف سيظهر محتوى التسجيل أثناء الفيديو.", cameraOnly: "الكاميرا فقط", screenOnly: "الشاشة فقط",
    screenCamera: "الشاشة مع الكاميرا",
    cameraDescription: "يظهر الفيديو من الكاميرا فقط بدون مشاركة الشاشة.",
    screenDescriptionLayout: "يظهر محتوى شاشتك بالكامل أثناء التسجيل.",
    screenCameraDescription: "تظهر الشاشة مع نافذة صغيرة لعرض الكاميرا فوقها.",
    start: "ابدأ التسجيل", back: "العودة",
    screenPreview: "معاينة الشاشة", layouts: "خيارات طريقة العرض",
  },
  en: {
    courses: "My courses", courseFallback: "Course name", sectionFallback: "Section name",
    title: "Recording setup",
    subtitle: "Prepare your camera, microphone, and content layout before recording.",
    preview: "Camera preview", cameraOff: "Camera not connected",
    camera: "Camera", cameraDevice: "Select camera device", defaultCamera: "Default camera",
    notConnected: "Not connected", microphone: "Microphone", micDevice: "Select microphone device",
    defaultMic: "Default microphone", audioLevel: "Audio level", screen: "Screen sharing",
    screenToggle: "Share screen while recording",
    screenDescription: "Show your screen with the camera according to the selected layout.",
    layout: "Video layout", layoutHelp: "Choose how the recording content will appear in the video.", cameraOnly: "Camera only", screenOnly: "Screen only",
    screenCamera: "Screen + camera",
    cameraDescription: "The video shows only the camera without screen sharing.",
    screenDescriptionLayout: "Your full screen content appears during recording.",
    screenCameraDescription: "The screen appears with a small camera window over it.",
    start: "Start recording", back: "Back",
    screenPreview: "Screen preview", layouts: "Layout options",
  },
};

const layoutOptions = [
  { id: "camera", label: "cameraOnly", description: "cameraDescription" },
  { id: "screen", label: "screenOnly", description: "screenDescriptionLayout" },
  { id: "screen-camera", label: "screenCamera", description: "screenCameraDescription" },
];

export default function InstructorVideoRecordingSetupPage() {
  const { courseId, sectionId, lessonId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = usePreferences();
  const t = copy[language] || copy.ar;
  const [screenSharing, setScreenSharing] = useState(false);
  const [selectedLayout, setSelectedLayout] = useState("screen-camera");
  const workspace = getInstructorCourseWorkspace(courseId);
  const course = workspace?.course;
  const section = (workspace?.sections || []).find((item) => String(item.id) === String(sectionId));
  const courseTitle = course && String(course.id) === String(courseId)
    ? course.title[language] || course.title.ar
    : t.courseFallback;
  const sectionTitle = section?.title?.[language] || section?.title?.ar || t.sectionFallback;
  const sourcePath = `/instructor/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}/video`;
  const recordingPath = `${sourcePath}/recording`;
  const isRtl = language === "ar";

  if (!workspace || !section || (lessonId !== 'new' && !section.lessons.some(lesson => String(lesson.id) === String(lessonId)))) return <main className="container instructor-detail-page"><h1>{language === 'ar' ? 'لم يتم العثور على الدرس أو القسم' : 'Lesson or section not found'}</h1><button type="button" className="button" onClick={() => navigate('/instructor/courses')}>{language === 'ar' ? 'العودة إلى دوراتي' : 'Back to my courses'}</button></main>;
  return (<main className="instructor-video-setup-page instructor-detail-page" dir={isRtl ? "rtl" : "ltr"}>
      <p className="instructor-media-demo-note" role="note">{language === 'ar' ? 'معاينة لمسار الفيديو: التسجيل والتشغيل والقص محاكاة للتصميم، ولا يُنشأ أو يُرفع أو يُعدّل ملف فيديو فعليًا.' : 'Video workflow preview: recording, playback and trimming are simulated. No video file is created, uploaded or edited.'}</p>
      <div className="container">
        <nav className="instructor-video-setup-breadcrumb" aria-label={isRtl ? "مسار التنقل" : "Breadcrumb"}>
          <span>{t.courses}</span><span>/</span><span>{courseTitle}</span><span>/</span>
          <span>{sectionTitle}</span><span>/</span><strong>{t.title}</strong>
        </nav>
        <header className="instructor-video-setup-header">
          <h1>{t.title}</h1><p>{t.subtitle}</p>
        </header>

        <div className="instructor-video-setup-workspace">
          <section className="instructor-video-setup-preview-panel" aria-label={t.preview}>
            <div className="instructor-video-setup-preview-stage">
              <div className="instructor-video-setup-preview-status">
                <span className="instructor-video-setup-status-dot" />{t.notConnected}
              </div>
              <div className="instructor-video-setup-preview-placeholder">
                <span className="instructor-video-setup-subject" aria-hidden="true"><i /><b /></span>
                <strong>{t.preview}</strong><small>{t.cameraOff}</small>
              </div>
            </div>
          </section>

          <aside className="instructor-video-setup-settings">
            <section className="instructor-video-setup-setting">
              <div className="instructor-video-setup-setting-heading"><Icon name="camera" size={17} /><h2>{t.camera}</h2></div>
              <div className="instructor-video-setup-device-field" role="group" aria-label={t.cameraDevice}>
                <span>{t.defaultCamera}</span><small><i />{t.notConnected}</small>
              </div>
            </section>

            <section className="instructor-video-setup-setting">
              <div className="instructor-video-setup-setting-heading"><h2>{t.microphone}</h2></div>
              <div className="instructor-video-setup-device-field" role="group" aria-label={t.micDevice}>
                <span>{t.defaultMic}</span><small><i />{t.notConnected}</small>
              </div>
              <div className="instructor-video-setup-meter-label"><span>{t.audioLevel}</span><span>{t.notConnected}</span></div>
              <div className="instructor-video-setup-meter" aria-hidden="true">
                {Array.from({ length: 18 }, (_, index) => <i key={index} className={index < 6 ? "is-active" : ""} />)}
              </div>
            </section>

            <section className="instructor-video-setup-setting">
              <div className="instructor-video-setup-setting-heading"><h2>{t.screen}</h2></div>
              <label className="instructor-video-setup-toggle-row">
                <span>{t.screenToggle}</span>
                <input type="checkbox" checked={screenSharing} onChange={(event) => setScreenSharing(event.target.checked)} />
                <i aria-hidden="true" />
              </label>
              <p className="instructor-video-setup-help">{t.screenDescription}</p>
            </section>
          </aside>
        </div>

        <section className="instructor-video-setup-layout-section">
          <h2>{t.layout}</h2>
          <p className="instructor-video-setup-layout-help">{t.layoutHelp}</p>
          <div className="instructor-video-setup-layout-options" role="group" aria-label={t.layout}>
            {layoutOptions.map((option) => {
              const description = t[option.description];
              return (
                <button
                  type="button"
                  key={option.id}
                  className={`instructor-video-setup-layout-option${selectedLayout === option.id ? " is-selected" : ""}`}
                  aria-pressed={selectedLayout === option.id}
                  aria-label={`${t[option.label]}. ${description}`}
                  onClick={() => setSelectedLayout(option.id)}
                >
                  <span className={`instructor-video-setup-layout-visual is-${option.id}`} aria-hidden="true">
                    {option.id === "camera" && (
                      <><i className="video-layout-avatar-head" /><b className="video-layout-avatar-body" /></>
                    )}
                    {option.id === "screen" && (
                      <span className="video-layout-content">
                        <i /><i /><b />
                      </span>
                    )}
                    {option.id === "screen-camera" && (
                      <>
                        <span className="video-layout-content"><i /><i /><b /></span>
                        <span className="video-layout-pip"><i /><b /></span>
                      </>
                    )}
                  </span>
                  <strong>{t[option.label]}</strong>
                  <span className="instructor-video-setup-layout-tooltip" role="tooltip">{description}</span>
                  {selectedLayout === option.id && <span className="instructor-video-setup-layout-check" aria-hidden="true">✓</span>}
                </button>
              );
            })}
          </div>
        </section>

        <footer className="instructor-video-setup-actions">
          <button type="button" className="instructor-button instructor-button-outline" onClick={() => navigate(sourcePath, { state: location.state })}>{t.back}</button>
          <button type="button" className="instructor-button" onClick={() => navigate(recordingPath, { state: { ...location.state, selectedLayout, screenSharing } })}>{t.start}</button>
        </footer>
      </div>
    </main>
  );
}