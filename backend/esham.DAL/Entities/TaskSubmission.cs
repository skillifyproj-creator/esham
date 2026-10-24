namespace esham.DAL.Entities;

public sealed class TaskSubmission
{
    public Guid Id { get; set; } = Guid.NewGuid();
    public Guid EnrollmentId { get; set; }
    public Guid CourseTaskId { get; set; }
    public int AttemptNumber { get; set; } = 1;
    public string? AnswerText { get; set; }
    public string? WorkUrl { get; set; }
    public string Status { get; set; } = "inProgress";
    public DateTimeOffset CreatedAt { get; set; } = DateTimeOffset.UtcNow;
    public DateTimeOffset? SubmittedAt { get; set; }
    public Enrollment Enrollment { get; set; } = null!;
    public CourseTask CourseTask { get; set; } = null!;
    public ICollection<SubmissionAttachment> Attachments { get; set; } = new List<SubmissionAttachment>();
    public ICollection<TaskSubmissionReview> Reviews { get; set; } = new List<TaskSubmissionReview>();
}
