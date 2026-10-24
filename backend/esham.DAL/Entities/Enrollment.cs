namespace esham.DAL.Entities;

public sealed class Enrollment
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public string LearnerUserId { get; set; } = string.Empty;
    public Guid CourseId { get; set; }
    public Guid CourseVersionId { get; set; }
    public string Status { get; set; } = "active";
    public DateTimeOffset EnrolledAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? CompletedAt { get; set; }
    public DateTimeOffset? LastOpenedAt { get; set; }
    public ApplicationUser LearnerUser { get; set; } = null!;
    public Course Course { get; set; } = null!;
    public CourseVersion CourseVersion { get; set; } = null!;
    public ICollection<PointTransaction> PointTransactions { get; set; } = new List<PointTransaction>();
    public ICollection<LessonProgress> LessonProgressRecords { get; set; } = new List<LessonProgress>();
    public ICollection<TaskSubmission> TaskSubmissions { get; set; } = new List<TaskSubmission>();
    public CourseReview? CourseReview { get; set; }
    public Certificate? Certificate { get; set; }
}
