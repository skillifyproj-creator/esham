import { getInstructorCourseWorkspace } from "../../data/instructorCourseWorkspace";
import { useEffect, useState } from "react";
import { useLocation, useNavigate, useParams } from "react-router";
import { usePreferences } from "../../context/PreferencesContext";
import "../../styles/instructor.css";

const copy = {
  ar: {
    courses: "دوراتي", courseFallback: "اسم الدورة", sectionFallback: "اسم القسم",
    title: "تعديل الفيديو", subtitle: "عدّل بداية ونهاية الفيديو قبل حفظه للدرس.",
    preview: "معاينة الفيديو", play: "تشغيل الفيديو", pause: "إيقاف الفيديو مؤقتًا",
    duration: "15:32", start: "قص البداية", end: "قص النهاية", previewSelection: "معاينة الجزء المحدد",
    startTime: "البداية", endTime: "النهاية", audio: "الصوت", improveAudio: "تحسين مستوى الصوت",
    back: "رجوع للمعاينة", save: "حفظ التعديلات", saved: "تم نقل إعدادات المعاينة إلى نموذج الدرس.",
  },
  en: {
    courses: "My courses", courseFallback: "Course name", sectionFallback: "Section name",
    title: "Edit video", subtitle: "Adjust the beginning and end of the video before saving it to the lesson.",
    preview: "Video preview", play: "Play video", pause: "Pause video",
    duration: "15:32", start: "Trim start", end: "Trim end", previewSelection: "Preview selected segment",
    startTime: "Start", endTime: "End", audio: "Audio", improveAudio: "Improve audio level",
    back: "Back to preview", save: "Save changes", saved: "Preview settings passed to the lesson form.",
  },
};

const totalSeconds = 15 * 60 + 32;
const formatTime = (seconds) => `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
const percent = (seconds) => `${(seconds / totalSeconds) * 100}%`;

export default function InstructorVideoEditorPage() {
  const { courseId, sectionId, lessonId } = useParams();
  const navigate = useNavigate();
  const location = useLocation();
  const flowState = location.state || {};
  const { language } = usePreferences();
  const t = copy[language] || copy.ar;
  const [currentTime, setCurrentTime] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(totalSeconds);
  const [isPlaying, setIsPlaying] = useState(false);
  const [isPreviewingSelection, setIsPreviewingSelection] = useState(false);
  const [audioImprovement, setAudioImprovement] = useState(false);
  const [saved, setSaved] = useState(false);
  const workspace = getInstructorCourseWorkspace(courseId);
  const course = workspace?.course;
  const section = (workspace?.sections || []).find((item) => String(item.id) === String(sectionId));
  const courseTitle = course && String(course.id) === String(courseId)
    ? course.title[language] || course.title.ar
    : t.courseFallback;
  const sectionTitle = section?.title?.[language] || section?.title?.ar || t.sectionFallback;
  const basePath = `/instructor/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}/video`;
  const direction = language === "ar" ? "rtl" : "ltr";

  useEffect(() => {
    if (!isPlaying) return undefined;
    const timer = window.setTimeout(() => {
      const limit = isPreviewingSelection ? trimEnd : totalSeconds;
      if (currentTime >= limit - 1) {
        setIsPlaying(false);
        setIsPreviewingSelection(false);
        setCurrentTime(isPreviewingSelection ? trimStart : 0);
      } else {
        setCurrentTime((time) => Math.min(time + 1, limit));
      }
    }, 1000);
    return () => window.clearTimeout(timer);
  }, [currentTime, isPlaying, isPreviewingSelection, trimEnd, trimStart]);

  const setTrimBeginning = () => {
    setTrimStart(Math.min(Math.max(currentTime, 0), trimEnd - 1));
    setSaved(false);
  };
  const setTrimEnding = () => {
    setTrimEnd(Math.max(Math.min(currentTime, totalSeconds), trimStart + 1));
    setSaved(false);
  };
  const previewSelection = () => {
    setCurrentTime(trimStart);
    setIsPreviewingSelection(true);
    setIsPlaying(true);
  };
  const togglePlayback = () => {
    if (!isPlaying) {
      if (currentTime >= totalSeconds || (isPreviewingSelection && currentTime >= trimEnd)) {
        setCurrentTime(isPreviewingSelection ? trimStart : 0);
      }
      setIsPreviewingSelection(false);
    }
    setIsPlaying((playing) => !playing);
  };

  if (!workspace || !section || (lessonId !== 'new' && !section.lessons.some(lesson => String(lesson.id) === String(lessonId)))) return <main className="container instructor-detail-page"><h1>{language === 'ar' ? 'لم يتم العثور على الدرس أو القسم' : 'Lesson or section not found'}</h1><button type="button" className="button" onClick={() => navigate('/instructor/courses')}>{language === 'ar' ? 'العودة إلى دوراتي' : 'Back to my courses'}</button></main>;
  return (<main className="instructor-video-editor-page instructor-detail-page" dir={direction}>
      <p className="instructor-media-demo-note" role="note">{language === 'ar' ? 'معاينة لمسار الفيديو: التسجيل والتشغيل والقص محاكاة للتصميم، ولا يُنشأ أو يُرفع أو يُعدّل ملف فيديو فعليًا.' : 'Video workflow preview: recording, playback and trimming are simulated. No video file is created, uploaded or edited.'}</p>
      <div className="container">
        <nav className="instructor-video-editor-breadcrumb" aria-label={direction === "rtl" ? "مسار التنقل" : "Breadcrumb"}>
          <span>{t.courses}</span><span>/</span><span>{courseTitle}</span><span>/</span>
          <span>{sectionTitle}</span><span>/</span><strong>{t.title}</strong>
        </nav>
        <header className="instructor-video-editor-header">
          <h1>{t.title}</h1><p>{t.subtitle}</p>
        </header>

        <section className="instructor-video-editor-content" aria-label={t.preview}>
          <div className="instructor-video-preview-stage instructor-video-editor-stage">
            <div className="instructor-video-preview-scene" aria-hidden="true">
              <span className="instructor-video-preview-window" /><span className="instructor-video-preview-person"><i /><b /></span>
            </div>
            <button type="button" className="instructor-video-preview-play" onClick={togglePlayback} aria-label={isPlaying ? t.pause : t.play}>
              <span aria-hidden="true">{isPlaying ? "Ⅱ" : "▶"}</span>
            </button>
            <span className="instructor-video-preview-demo-tag">{t.preview}</span>
          </div>

          <section
            className="instructor-video-editor-timeline"
            aria-label={t.duration}
            dir="ltr"
          >
            <div className="instructor-video-editor-timeline-meta">
              <span>{formatTime(trimStart)}</span>
              <strong>{t.duration}</strong>
              <span>{formatTime(trimEnd)}</span>
            </div>

            <div className="instructor-video-editor-track">
              <div className="instructor-video-editor-track-rail" />

              <div
                className="instructor-video-editor-selected"
                style={{
                  left: percent(trimStart),
                  width: `${((trimEnd - trimStart) / totalSeconds) * 100}%`,
                }}
              />

              <div
                className="instructor-video-editor-trim-handle is-start"
                style={{ left: percent(trimStart) }}
                aria-hidden="true"
              />

              <div
                className="instructor-video-editor-trim-handle is-end"
                style={{ left: percent(trimEnd) }}
                aria-hidden="true"
              />

              <div
                className="instructor-video-editor-playhead"
                style={{ left: percent(currentTime) }}
                aria-hidden="true"
              />

              <input
                type="range"
                min={trimStart}
                max={trimEnd}
                value={Math.min(Math.max(currentTime, trimStart), trimEnd)}
                onChange={(event) => {
                  setCurrentTime(Number(event.target.value));
                  setIsPreviewingSelection(false);
                }}
                aria-label={t.preview}
              />
            </div>

            <div className="instructor-video-editor-time-labels" dir="ltr">
              <span>{t.startTime}: {formatTime(trimStart)}</span>
              <span>{t.endTime}: {formatTime(trimEnd)}</span>
            </div>

            <div className="instructor-video-editor-tools">
              <button
                type="button"
                className="instructor-button instructor-button-outline"
                onClick={setTrimBeginning}
              >
                {t.start}
              </button>

              <button
                type="button"
                className="instructor-button instructor-button-outline"
                onClick={setTrimEnding}
              >
                {t.end}
              </button>

              <button
                type="button"
                className="instructor-button"
                onClick={previewSelection}
              >
                {t.previewSelection}
              </button>
            </div>
          </section>
          <section className="instructor-video-editor-audio" aria-labelledby="instructor-video-editor-audio-title">
            <h2 id="instructor-video-editor-audio-title">{t.audio}</h2>
            <label className="instructor-video-editor-audio-toggle">
              <span>{t.improveAudio}</span>
              <input type="checkbox" checked={audioImprovement} onChange={(event) => setAudioImprovement(event.target.checked)} />
              <i aria-hidden="true" />
            </label>
          </section>

          <div className="instructor-video-editor-actions">
            <button type="button" className="instructor-button instructor-button-outline" onClick={() => navigate(`${basePath}/preview`, { state: flowState })}>{t.back}</button>
            <button type="button" className="instructor-button" onClick={() => { setSaved(true); const draft = flowState.lessonDraft || {}; const name = flowState.video?.name || draft.video?.name || "recording.webm"; const video = { ...draft.video, ...flowState.video, name, duration: flowState.video?.duration || formatTime(totalSeconds), quality: flowState.video?.quality || "1080p", encoding: flowState.video?.encoding || "WebM", size: flowState.video?.size || "245 MB", trimStart: formatTime(trimStart), trimEnd: formatTime(trimEnd), audioImprovement }; navigate(`/instructor/courses/${courseId}/sections/${sectionId}/lessons/${lessonId}/edit`, { state: { ...flowState, lessonDraft: { ...draft, contentType: "video", video }, video, videoUrl: flowState.videoUrl || name } }); }}>{t.save}</button>
          </div>
          {saved && <p className="instructor-video-editor-saved" role="status">{t.saved}</p>}
        </section>
      </div>
    </main>
  );
}