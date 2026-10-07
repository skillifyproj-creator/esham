import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { getInstructorCourseWorkspace } from "../../data/instructorCourseWorkspace";
import Icon from "../../components/Icon";
import { usePreferences } from "../../context/PreferencesContext";
import "../../styles/instructor.css";

const copy = {
  ar: {
    courses: "دوراتي", courseFallback: "اسم الدورة", sectionFallback: "اسم القسم",
    context: "تسجيل الفيديو", title: "تسجيل الفيديو", running: "جاري التسجيل", paused: "متوقف مؤقتًا",
    camera: "الكاميرا", microphone: "الميكروفون", screen: "مشاركة الشاشة",
    cameraOn: "مفعلة", cameraOff: "متوقفة", micOn: "مفعّل", micOff: "متوقف",
    screenOn: "مفعلة", screenOff: "متوقفة", pause: "إيقاف مؤقت", resume: "متابعة التسجيل",
    stop: "إنهاء التسجيل", openBoard: "السبورة", closeBoard: "إغلاق السبورة",
    boardPlaceholder: "السبورة ستظهر هنا أثناء التسجيل.", screenPlaceholder: "محتوى الشاشة",
    cameraPlaceholder: "معاينة الكاميرا", layoutCamera: "الكاميرا فقط", layoutScreen: "الشاشة فقط",
    layoutCombined: "الشاشة مع الكاميرا", layoutSide: "الشاشة والكاميرا جنبًا إلى جنب",
    layoutBoard: "السبورة مع الكاميرا", status: "حالة التسجيل", audio: "مستوى الصوت",
    tools: "أدوات", shareFile: "مشاركة ملف", annotate: "الكتابة والتعليقات",
    filePicker: "اختر ملفًا للمشاركة", sharedFile: "الملف المشترك", removeFile: "إزالة الملف",
    annotationTools: "أدوات الكتابة والتعليقات", pen: "قلم / رسم حر", text: "نص",
    arrow: "سهم", shape: "شكل", highlight: "تمييز", eraser: "ممحاة",
    changeLayout: "تغيير شكل الفيديو", layout: "شكل الفيديو", closeTools: "إغلاق قائمة الأدوات",
  },
  en: {
    courses: "My courses", courseFallback: "Course name", sectionFallback: "Section name",
    context: "Video recording", title: "Record video", running: "Recording", paused: "Paused",
    camera: "Camera", microphone: "Microphone", screen: "Screen sharing",
    cameraOn: "On", cameraOff: "Off", micOn: "On", micOff: "Off",
    screenOn: "On", screenOff: "Off", pause: "Pause", resume: "Resume recording",
    stop: "Stop recording", openBoard: "Whiteboard", closeBoard: "Close whiteboard",
    boardPlaceholder: "The whiteboard will appear here during recording.", screenPlaceholder: "Screen content",
    cameraPlaceholder: "Camera preview", layoutCamera: "Camera only", layoutScreen: "Screen only",
    layoutCombined: "Screen + camera", layoutSide: "Screen and camera side by side",
    layoutBoard: "Whiteboard + camera", status: "Recording status", audio: "Audio level",
    tools: "Tools", shareFile: "Share a file", annotate: "Writing and annotations",
    filePicker: "Choose a file to share", sharedFile: "Shared file", removeFile: "Remove file",
    annotationTools: "Writing and annotation tools", pen: "Pen / free draw", text: "Text",
    arrow: "Arrow", shape: "Shape", highlight: "Highlight", eraser: "Eraser",
    changeLayout: "Change video layout", layout: "Video layout", closeTools: "Close tools menu",
  },
};

const formatTime = (totalSeconds) => {
  const hours = Math.floor(totalSeconds / 3600).toString().padStart(2, "0");
  const minutes = Math.floor((totalSeconds % 3600) / 60).toString().padStart(2, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
};

const layouts = [
  { id: "camera", label: "layoutCamera" },
  { id: "screen", label: "layoutScreen" },
  { id: "screen-camera", label: "layoutCombined" },
  { id: "side-by-side", label: "layoutSide" },
  { id: "whiteboard-camera", label: "layoutBoard" },
];

const annotationTools = ["pen", "text", "arrow", "shape", "highlight", "eraser"];

export default function InstructorVideoRecordingPage() {
  const { courseId, sectionId, lessonId } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const { language } = usePreferences();
  const t = copy[language] || copy.ar;
  const setupState = location.state || {};
  const [selectedLayout, setSelectedLayout] = useState(setupState.selectedLayout || "screen-camera");
  const [cameraEnabled, setCameraEnabled] = useState(true);
  const [microphoneEnabled, setMicrophoneEnabled] = useState(true);
  const [screenSharingEnabled, setScreenSharingEnabled] = useState(Boolean(setupState.screenSharing));
  const [isPaused, setIsPaused] = useState(false);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);
  const [whiteboardOpen, setWhiteboardOpen] = useState(false);
  const [sharedFile, setSharedFile] = useState(null);
  const [selectedAnnotationTool, setSelectedAnnotationTool] = useState("pen");
  const [annotationPanelOpen, setAnnotationPanelOpen] = useState(false);
  const [toolsOpen, setToolsOpen] = useState(false);
  const fileInputRef = useRef(null);

  const workspace = getInstructorCourseWorkspace(courseId);
  const course = workspace?.course;
  const section = (workspace?.sections || []).find((item) => String(item.id) === String(sectionId));
  const courseTitle = course && String(course.id) === String(courseId)
    ? course.title[language] || course.title.ar
    : t.courseFallback;
  const sectionTitle = section?.title?.[language] || section?.title?.ar || t.sectionFallback;
  const basePath = `/instructor/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}/video`;
  const layoutLabels = Object.fromEntries(layouts.map(({ id, label }) => [id, t[label]]));
  const cameraInComposition = cameraEnabled && ["screen-camera", "side-by-side", "whiteboard-camera"].includes(selectedLayout);

  useEffect(() => {
    if (isPaused) return undefined;
    const timerId = window.setInterval(() => setElapsedSeconds((value) => value + 1), 1000);
    return () => window.clearInterval(timerId);
  }, [isPaused]);

  const chooseFile = (event) => {
    const file = event.target.files?.[0];
    if (file) {
      setSharedFile({ name: file.name, type: file.type, extension: file.name.split(".").pop()?.toUpperCase() || "FILE" });
      setWhiteboardOpen(false);
      setAnnotationPanelOpen(false);
      setToolsOpen(false);
    }
  };

  const openWhiteboard = () => {
    setWhiteboardOpen(true);
    setAnnotationPanelOpen(false);
    setToolsOpen(false);
  };

  const toggleScreenSharing = () => {
    setScreenSharingEnabled((enabled) => {
      const next = !enabled;
      if (next && selectedLayout === "camera") setSelectedLayout("screen-camera");
      return next;
    });
    setToolsOpen(false);
  };

  const toggleButton = (key, enabled, onToggle) => {
    return (
      <button
        type="button"
        className={`instructor-video-recording-toggle${enabled ? " is-on" : " is-off"}`}
        aria-label={t[key]}
        aria-pressed={enabled}
        onClick={onToggle}
      >
        {key === "camera" && <Icon name="camera" size={17} />}
        <span>{t[key]}</span>
      </button>
    );
  };

  const renderScreenContent = () => (
    <div className="instructor-video-recording-screen" aria-label={t.screenPlaceholder}>
      <div className="instructor-video-recording-screen-content"><i /><i /><i /><b /></div>
      <span>{t.screenPlaceholder}</span>
    </div>
  );

  const renderCamera = (className = "instructor-video-recording-camera-pip") => (
    <div className={className} aria-label={t.cameraPlaceholder}><i /><b /></div>
  );
  const renderAnnotationToolbar = () => (
    <div className="instructor-video-recording-annotation-toolbar is-contextual" role="toolbar" aria-label={t.annotationTools}>
      {annotationTools.map((tool) => (
        <button type="button" key={tool} className={selectedAnnotationTool === tool ? "is-selected" : ""} aria-pressed={selectedAnnotationTool === tool} onClick={() => setSelectedAnnotationTool(tool)}>
          {t[tool]}
        </button>
      ))}
    </div>
  );

  if (!workspace || !section || (lessonId !== 'new' && !section.lessons.some(lesson => String(lesson.id) === String(lessonId)))) return <main className="container instructor-detail-page"><h1>{language === 'ar' ? 'لم يتم العثور على الدرس أو القسم' : 'Lesson or section not found'}</h1><button type="button" className="button" onClick={() => navigate('/instructor/courses')}>{language === 'ar' ? 'العودة إلى دوراتي' : 'Back to my courses'}</button></main>;
  return (<main className="instructor-video-recording-page instructor-detail-page" dir={language === "ar" ? "rtl" : "ltr"}>
      <p className="instructor-media-demo-note" role="note">{language === 'ar' ? 'معاينة لمسار الفيديو: التسجيل والتشغيل والقص محاكاة للتصميم، ولا يُنشأ أو يُرفع أو يُعدّل ملف فيديو فعليًا.' : 'Video workflow preview: recording, playback and trimming are simulated. No video file is created, uploaded or edited.'}</p>
      <div className="container">
        <nav className="instructor-video-recording-breadcrumb" aria-label={language === "ar" ? "مسار التنقل" : "Breadcrumb"}>
          <span>{t.courses}</span><span>/</span><span>{courseTitle}</span><span>/</span>
          <span>{sectionTitle}</span><span>/</span><strong>{t.context}</strong>
        </nav>
        <header className="instructor-video-recording-header"><h1>{t.title}</h1></header>

        <section className="instructor-video-recording-workspace" aria-label={t.title}>
          <div className="instructor-video-recording-stage">
            <div className="instructor-video-recording-stage-topline">
              <span className={`instructor-video-recording-live${isPaused ? " is-paused" : ""}`} role="status" aria-live="polite"><i />{isPaused ? t.paused : t.running}</span>
              <time className="instructor-video-recording-timer" aria-label={formatTime(elapsedSeconds)}>{formatTime(elapsedSeconds)}</time>
            </div>
            <div className={`instructor-video-recording-composition is-${selectedLayout}`}>
              {whiteboardOpen ? (
                <div className="instructor-video-recording-board" role="region" aria-label={t.openBoard}>
                  <button type="button" className="instructor-video-recording-board-close" onClick={() => setWhiteboardOpen(false)}>{t.closeBoard}</button>
                  <span>{t.boardPlaceholder}</span>
                  {cameraInComposition && renderCamera()}
                  {renderAnnotationToolbar()}

                </div>
              ) : sharedFile ? (
                <div className="instructor-video-recording-file-preview" aria-label={`${t.sharedFile}: ${sharedFile.name}`}>
                  <div className="instructor-video-recording-file-card">
                    <span className="instructor-video-recording-file-mark"><Icon name={sharedFile.type.startsWith("image/") ? "image" : "book"} size={24} /></span>
                    <strong>{sharedFile.name}</strong><small>{sharedFile.extension}</small>
                    <button type="button" onClick={() => setSharedFile(null)}>{t.removeFile}</button>
                  </div>
                  {cameraInComposition && renderCamera()}
                  {renderAnnotationToolbar()}
                </div>
              ) : selectedLayout === "camera" ? (
                cameraEnabled ? renderCamera("instructor-video-recording-camera-only") : <p className="instructor-video-recording-empty">{t.cameraOff}</p>
              ) : selectedLayout === "side-by-side" ? (
                <div className="instructor-video-recording-side-by-side">{renderScreenContent()}{cameraEnabled ? renderCamera("instructor-video-recording-side-camera") : null}</div>
              ) : selectedLayout === "whiteboard-camera" ? (
                <div className="instructor-video-recording-board-preview"><span>{t.boardPlaceholder}</span>{cameraEnabled && renderCamera()}</div>
              ) : (
                <>{renderScreenContent()}{selectedLayout === "screen-camera" && cameraEnabled && renderCamera()}</>
              )}
            </div>
          </div>

          <div className="instructor-video-recording-controls" aria-label={t.title}>
            <div className="instructor-video-recording-control-group instructor-video-recording-primary-controls">
              <button type="button" className="instructor-video-recording-control" onClick={() => setIsPaused((value) => !value)}>
                <span className="instructor-video-recording-control-symbol" aria-hidden="true">{isPaused ? "▶" : "Ⅱ"}</span>{isPaused ? t.resume : t.pause}
              </button>
              <button type="button" className="instructor-video-recording-stop" onClick={() => { const name = setupState.video?.name || "recording.webm"; const video = { ...setupState.video, name, duration: formatTime(elapsedSeconds), size: setupState.video?.size || "245 MB", quality: setupState.video?.quality || "1080p", encoding: setupState.video?.encoding || "WebM" }; navigate(`${basePath}/preview`, { state: { ...setupState, video, videoUrl: setupState.videoUrl || name } }); }}><i aria-hidden="true" />{t.stop}</button>
            </div>
            <div className="instructor-video-recording-control-group instructor-video-recording-device-controls">
              {toggleButton("camera", cameraEnabled, () => setCameraEnabled((value) => !value))}
              <div className="instructor-video-recording-mic-control">
                {toggleButton("microphone", microphoneEnabled, () => setMicrophoneEnabled((value) => !value))}
                <div className="instructor-video-recording-audio" aria-label={t.audio}>{Array.from({ length: 8 }, (_, index) => <i key={index} className={microphoneEnabled && index < 5 ? "is-active" : ""} />)}</div>
              </div>
              {toggleButton("screen", screenSharingEnabled, toggleScreenSharing)}
              <div className="instructor-video-recording-tools-wrap">
                <button type="button" className={`instructor-video-recording-tools-button${toolsOpen ? " is-open" : ""}`} aria-expanded={toolsOpen} aria-controls="instructor-recording-tools-menu" onClick={() => setToolsOpen((value) => !value)}>{t.tools}</button>
                {toolsOpen && (
                  <div className="instructor-video-recording-tools-menu" id="instructor-recording-tools-menu">
                    <button type="button" onClick={() => fileInputRef.current?.click()}>{t.shareFile}</button>
                    <button type="button" className="instructor-video-recording-annotation-toggle" aria-expanded={annotationPanelOpen} onClick={() => setAnnotationPanelOpen((value) => !value)}>{t.annotate}</button>
                    {annotationPanelOpen && !whiteboardOpen && !sharedFile && renderAnnotationToolbar()}

                    <button type="button" onClick={openWhiteboard}>{t.openBoard}</button>
                    <div className="instructor-video-recording-layout-menu">
                      <strong>{t.changeLayout}</strong>
                      <div>
                        {layouts.map(({ id, label }) => (
                          <button type="button" key={id} className={selectedLayout === id ? "is-selected" : ""} aria-pressed={selectedLayout === id} onClick={() => { setSelectedLayout(id); setToolsOpen(false); }}>{t[label]}</button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
              <input ref={fileInputRef} className="instructor-video-recording-file-input" type="file" accept=".pdf,.ppt,.pptx,image/*,.doc,.docx,application/pdf" aria-label={t.filePicker} onChange={chooseFile} />
            </div>
          </div>

          <div className="instructor-video-recording-status-panel" aria-label={t.status}>
            <span>{t.camera}: {cameraEnabled ? t.cameraOn : t.cameraOff}</span>
            <span>{t.microphone}: {microphoneEnabled ? t.micOn : t.micOff}</span>
            <span>{t.screen}: {screenSharingEnabled ? t.screenOn : t.screenOff}</span>
            <span>{t.layout}: {layoutLabels[selectedLayout]}</span>
          </div>
        </section>
      </div>
    </main>
  );
}