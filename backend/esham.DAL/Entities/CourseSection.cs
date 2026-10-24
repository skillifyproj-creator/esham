namespace esham.DAL.Entities;

public sealed class CourseSection
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid CourseVersionId { get; set; }
    public string? TitleAr { get; set; }
    public string? TitleEn { get; set; }
    public int SortOrder { get; set; }
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset UpdatedAt { get; set; } = DateTimeOffset.UtcNow;

    public CourseVersion CourseVersion { get; set; } = null!;
    public ICollection<Lesson> Lessons { get; set; } = new List<Lesson>();
    public ICollection<CourseTask> DisplayTasks { get; set; } = new List<CourseTask>();
}
