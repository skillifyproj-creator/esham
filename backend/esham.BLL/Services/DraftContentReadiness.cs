using esham.BLL.DTOs.Courses;
namespace esham.BLL.Services;

// Content completeness only. Submission task limits and trusted moderation remain separate requirements.
public static class DraftContentReadiness
{
    private static bool Text(string? ar, string? en, int minimum, int maximum) =>
        (ar?.Trim().Length >= minimum || en?.Trim().Length >= minimum) && ar?.Length > maximum != true && en?.Length > maximum != true;
    private static int Percentage(params bool[] flags) => (int)Math.Round(flags.Count(x => x) * 100d / flags.Length, MidpointRounding.AwayFromZero);
    public static LessonReadinessResponse Lesson(LessonRequest lesson, bool hasOwnedAttachedVideo)
    {
        var title = Text(lesson.TitleAr, lesson.TitleEn, 2, 200);
        var content = lesson.ContentType == "article" ? Text(lesson.DescriptionAr, lesson.DescriptionEn, 20, 10000)
            : lesson.ContentType == "video" && hasOwnedAttachedVideo;
        var objectives = lesson.Objectives is { Count: > 0 and <= 50 }
            && lesson.Objectives.All(x => x != null && Text(x.Ar, x.En, 1, 2000));
        var duration = lesson.DurationSeconds is >= 60 and <= 36000 && double.IsFinite(lesson.DurationSeconds.Value);
        return new(title, content, objectives, duration, Percentage(title, content, objectives, duration), title && content && objectives && duration);
    }
    public static SectionReadinessResponse Section(string? titleAr, string? titleEn, IReadOnlyList<LessonResponse> lessons)
    {
        var title = Text(titleAr, titleEn, 1, 200);
        var hasLessons = lessons.Count > 0;
        var ready = hasLessons && lessons.All(x => x.Readiness.IsReady);
        return new(title, hasLessons, ready, Percentage(title, hasLessons, ready), title && hasLessons && ready);
    }
    public static CurriculumReadinessResponse Curriculum(Guid versionId, List<SectionResponse> sections) =>
        new(versionId, sections.Count == 0 ? 0 : (int)Math.Round(sections.Average(x => x.Readiness.Percentage), MidpointRounding.AwayFromZero),
            sections.Count > 0 && sections.All(x => x.Readiness.IsReady), sections.Count(x => x.Readiness.IsReady), sections);
}
