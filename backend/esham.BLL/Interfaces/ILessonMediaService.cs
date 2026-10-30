using esham.BLL.DTOs;
using esham.BLL.DTOs.Courses;
namespace esham.BLL.Interfaces;

public interface ILessonMediaService
{
    Task<ServiceResult<List<LessonMediaResponse>>> NormalizeAsync(Guid courseId, Guid sectionId, Guid lessonId, CourseActor actor, CancellationToken ct = default);
    Task<ServiceResult<List<LessonMediaResponse>>> GetAsync(Guid courseId, Guid sectionId, Guid lessonId, CourseActor actor, CancellationToken ct = default);
    Task<ServiceResult<LessonMediaResponse>> UploadAsync(Guid courseId, Guid sectionId, Guid lessonId, CourseActor actor, VideoUploadRequest request, Stream input, CancellationToken ct = default);
    Task<ServiceResult<bool>> DetachAsync(Guid courseId, Guid sectionId, Guid lessonId, Guid attachmentId, CourseActor actor, CancellationToken ct = default);
    Task<ServiceResult<(Stream Stream, string ContentType)>> OpenAsync(Guid courseId, Guid sectionId, Guid lessonId, Guid attachmentId, CourseActor actor, CancellationToken ct = default);
}
