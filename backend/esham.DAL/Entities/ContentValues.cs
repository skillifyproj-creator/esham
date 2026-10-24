namespace esham.DAL.Entities;

// Values embedded in JSON columns, not additional database entities.
public sealed record LocalizedText(string? Ar = null, string? En = null);

public sealed record ScreeningFinding(
    double TimeSeconds,
    string Category,
    double? Similarity = null,
    bool RequiresReview = true,
    bool IsUncertain = false);

public static class CourseReviewStatuses
{
    public const string Draft = "draft";
    public const string Pending = "pending";
    public const string Approved = "approved";
    public const string Rejected = "rejected";
    public const string ChangesRequested = "changes_requested";
}

public static class CourseSafetyStatuses
{
    public const string Active = "active";
    public const string Suspended = "suspended";
    public const string Archived = "archived";
}
