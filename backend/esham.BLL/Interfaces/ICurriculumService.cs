using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
namespace esham.BLL.Interfaces;

public interface ICurriculumService
{
    Task<ServiceResult<CurriculumReadinessResponse>> GetReadinessAsync(Guid courseId, CourseActor actor, CancellationToken ct = default);
    Task<ServiceResult<LessonReadinessResponse>> PreviewLessonReadinessAsync(Guid courseId, Guid sectionId, CourseActor actor, LessonReadinessPreviewRequest request, CancellationToken ct = default);
    Task<ServiceResult<List<SectionResponse>>> EnsureDefaultSectionAsync(Guid courseId, CourseActor actor, CancellationToken ct = default);
    Task<ServiceResult<List<SectionResponse>>> GetSectionsAsync(Guid courseId, CourseActor actor, CancellationToken ct = default);
    Task<ServiceResult<SectionResponse>> SaveSectionAsync(Guid courseId, Guid? sectionId, CourseActor actor, SectionRequest request, CancellationToken ct = default);
    Task<ServiceResult<bool>> DeleteSectionAsync(Guid courseId, Guid sectionId, CourseActor actor, CancellationToken ct = default);
    Task<ServiceResult<List<LessonResponse>>> GetLessonsAsync(Guid courseId, Guid sectionId, CourseActor actor, CancellationToken ct = default);
    Task<ServiceResult<LessonResponse>> SaveLessonAsync(Guid courseId, Guid sectionId, Guid? lessonId, CourseActor actor, LessonRequest request, CancellationToken ct = default);
    Task<ServiceResult<bool>> DeleteLessonAsync(Guid courseId, Guid sectionId, Guid lessonId, CourseActor actor, CancellationToken ct = default);
    Task<ServiceResult<bool>> ReorderAsync(Guid courseId, Guid? sectionId, CourseActor actor, ReorderRequest request, CancellationToken ct = default);
}
