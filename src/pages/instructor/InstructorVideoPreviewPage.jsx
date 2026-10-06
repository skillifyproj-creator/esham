import { useEffect, useRef, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import Icon from "../../components/Icon";
import { usePreferences } from "../../context/PreferencesContext";
import { instructorCurriculumDemo } from "../../data/instructorCurriculumDemo";
import "../../styles/instructor.css";

const copy = {
  ar: {
    courses: "دوراتي", courseFallback: "اسم الدورة", sectionFallback: "اسم القسم",
    title: "معاينة الفيديو", subtitle: "راجع التسجيل قبل المتابعة إلى مرحلة التعديل.",
    preview: "معاينة التسجيل", play: "تشغيل المعاينة", pause: "إيقاف المعاينة مؤقتًا",
    seek: "موضع تشغيل الفيديو", volume: "مستوى الصوت", fullscreen: "ملء الشاشة", exitFullscreen: "إنهاء ملء الشاشة",
    info: "معلومات التسجيل", duration: "مدة الفيديو", quality: "الجودة", format: "الصيغة", size: "حجم الملف",
    success: "تم تسجيل الفيديو بنجاح", demo: "هذه بيانات تجريبية للمعاينة، وسيتم استبدالها ببيانات التسجيل الفعلية لاحقًا.",
    edit: "متابعة إلى التعديل", again: "إعادة التسجيل", save: "حفظ كمسودة", saved: "حُفظت المسودة محليًا لهذه الجلسة.",
  },
  en: {
    courses: "My courses", courseFallback: "Course name", sectionFallback: "Section name",
    title: "Video preview", subtitle: "Review your recording before continuing to editing.",
    preview: "Recording preview", play: "Play preview", pause: "Pause preview",
    seek: "Video playback position", volume: "Volume", fullscreen: "Enter fullscreen", exitFullscreen: "Exit fullscreen",
    info: "Recording information", duration: "Video duration", quality: "Quality", format: "Format", size: "File size",
    success: "Video recorded successfully", demo: "These are demo preview values and will be replaced with recording details when the recording pipeline is available.",
    edit: "Continue to editing", again: "Record again", save: "Save as draft", saved: "Draft saved locally for this session.",
  },
};

const durationSeconds = 15 * 60 + 32;
const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;

export default function InstructorVideoPreviewPage() {
  const { courseId, sectionId, lessonId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const flowState = location.state || {};
  const video = flowState.video || {};
  const { language } = usePreferences();
  const t = copy[language] || copy.ar;
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [volume, setVolume] = useState(75);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [draftSaved, setDraftSaved] = useState(false);
  const playerRef = useRef(null);
  const course = instructorCurriculumDemo.course;
  const section = instructorCurriculumDemo.sections.find((item) => String(item.id) === String(sectionId));
  const courseTitle = course && String(course.id) === String(courseId)
    ? course.title[language] || course.title.ar
    : t.courseFallback;
  const sectionTitle = section?.title?.[language] || section?.title?.ar || t.sectionFallback;
  const basePath = `/instructor/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}/video`;
  const direction = language === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = window.setTimeout(() => {
      if (currentTime >= durationSeconds - 1) {
        setIsPlaying(false);
        setCurrentTime(0);
      } else {
        setCurrentTime(currentTime + 1);
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [currentTime, isPlaying]);

  useEffect(() => {
    const syncFullscreen = () => setIsFullscreen(document.fullscreenElement === playerRef.current);
    document.addEventListener("fullscreenchange", syncFullscreen);
    return () => document.removeEventListener("fullscreenchange", syncFullscreen);
  }, []);

  const toggleFullscreen = async () => {
    if (!playerRef.current) return;
    try {
      if (document.fullscreenElement) await document.exitFullscreen();
      else await playerRef.current.requestFullscreen?.();
    } catch {
      setIsFullscreen(false);
    }
  };

  const togglePlayback = () => {
    if (!isPlaying && currentTime >= durationSeconds - 1) setCurrentTime(0);
    setIsPlaying((playing) => !playing);
  };

  return (
    <main className="instructor-video-preview-page instructor-detail-page" dir={direction}>
      <div className="container">
        <nav className="instructor-video-preview-breadcrumb" aria-label={direction === "rtl" ? "مسار التنقل" : "Breadcrumb"}>
          <span>{t.courses}</span><span>/</span><span>{courseTitle}</span><span>/</span>
          <span>{sectionTitle}</span><span>/</span><strong>{t.title}</strong>
        </nav>
        <header className="instructor-video-preview-header">
          <h1>{t.title}</h1><p>{t.subtitle}</p>
        </header>

        <section className="instructor-video-preview-player" ref={playerRef} aria-label={t.preview}>
          <div className="instructor-video-preview-stage" role="img" aria-label={t.preview}>
            <div className="instructor-video-preview-scene" aria-hidden="true">
              <span className="instructor-video-preview-window" /><span className="instructor-video-preview-person"><i /><b /></span>
            </div>
            <button type="button" className="instructor-video-preview-play" onClick={togglePlayback} aria-label={isPlaying ? t.pause : t.play}>
              <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
            </button>
            <span className="instructor-video-preview-demo-tag">{t.preview}</span>
          </div>
          <div className="instructor-video-preview-controls" dir="ltr">
            <div className="instructor-video-preview-progress-row">
              <input type="range" min="0" max={durationSeconds} value={currentTime} onChange={(event) => setCurrentTime(Number(event.target.value))} aria-label={t.seek} style={{ "--preview-progress": `${(currentTime / durationSeconds) * 100}%` }} />
            </div>
            <div className="instructor-video-preview-control-row">
              <button type="button" className="instructor-video-preview-control-play" onClick={togglePlayback} aria-label={isPlaying ? t.pause : t.play} title={isPlaying ? t.pause : t.play}>
                <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
              </button>
              <span className="instructor-video-preview-time">{formatTime(currentTime)} / {formatTime(durationSeconds)}</span>
              <label className="instructor-video-preview-volume" aria-label={t.volume}>
                <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 9v6h4l5 4V5L8 9H4Z" /><path d="M16 9a5 5 0 0 1 0 6m2-9a9 9 0 0 1 0 12" /></svg>
                <input type="range" min="0" max="100" value={volume} onChange={(event) => setVolume(Number(event.target.value))} aria-label={t.volume} style={{ "--volume-level": `${volume}%` }} />
              </label>
              <button type="button" className="instructor-video-preview-fullscreen" onClick={toggleFullscreen} aria-label={isFullscreen ? t.exitFullscreen : t.fullscreen} title={isFullscreen ? t.exitFullscreen : t.fullscreen}>⛶</button>
            </div>
          </div>
        </section>

        <section className="instructor-video-preview-summary" aria-labelledby="instructor-video-preview-info-title">
          <div className="instructor-video-preview-summary-heading">
            <h2 id="instructor-video-preview-info-title">{t.info}</h2>
            <p><span aria-hidden="true" />{t.success}</p>
          </div>
          <dl className="instructor-video-preview-details">
            <div><dt>{t.duration}</dt><dd>{video.duration || "15:32"}</dd></div>
            <div><dt>{t.quality}</dt><dd>{video.quality || "1080p"}</dd></div>
            <div><dt>{t.format}</dt><dd>{video.encoding || "WebM"}</dd></div>
            <div><dt>{t.size}</dt><dd>{video.size || "245 MB"}</dd></div>
          </dl>
          <p className="instructor-video-preview-demo-note">{t.demo}</p>
        </section>

        <div className="instructor-video-preview-actions">
          <button type="button" className="instructor-button instructor-button-outline" onClick={() => navigate(`${basePath}/recording`, { state: flowState })}>{t.again}</button>
          <button type="button" className="instructor-button instructor-video-preview-save" onClick={() => setDraftSaved(true)}><Icon name="save" size={16} />{t.save}</button>
          <button type="button" className="instructor-button" onClick={() => navigate(`${basePath}/edit`, { state: flowState })}>{t.edit}</button>
        </div>
        {draftSaved && <p className="instructor-video-preview-saved" role="status"><Icon name="check" size={15} />{t.saved}</p>}
      </div>
    </main>
  );
}