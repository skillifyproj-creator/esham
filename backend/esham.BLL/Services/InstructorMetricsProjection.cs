using esham.DAL.Data;
using Microsoft.EntityFrameworkCore;
namespace esham.BLL.Services;

// Constant-count grouped queries. Never loads the instructor's full enrollment/evidence graph.
internal sealed class InstructorMetricsProjection(AppDbContext db)
{
    public async Task<object> ReadAsync(string account,Guid? courseId,string period,CancellationToken ct,int sectionPage=1){
        var now=DateTimeOffset.UtcNow;var since=period=="all"?DateTimeOffset.MinValue:now.AddDays(period=="7d"?-7:period=="30d"?-30:-90);
        var owned=db.Courses.AsNoTracking().Where(x=>x.OwnerUserId==account&&(!courseId.HasValue||x.Id==courseId));
        var cohort=db.Enrollments.AsNoTracking().Where(x=>owned.Any(c=>c.Id==x.CourseId)&&x.EnrolledAt>=since);
        var totals=await cohort.GroupBy(x=>1).Select(g=>new{Enrolled=g.Count(),Completed=g.Count(x=>x.Status=="completed"||x.CompletedAt!=null),Unique=g.Select(x=>x.LearnerUserId).Distinct().Count(),Weekly=g.Count(x=>x.EnrolledAt>=now.AddDays(-7)),
            Ambiguous=g.Count(x=>(x.Status=="completed"||x.CompletedAt!=null)&&(x.Status!="completed"||x.CompletedAt==null||x.Certificate==null||x.Certificate.CourseVersionId==null)),Started=g.Count(x=>x.Status=="completed"||x.CompletedAt!=null||x.LastOpenedAt!=null||x.LessonProgressRecords.Any(p=>p.Lesson.CourseSection.CourseVersion.CourseId==x.CourseId&&p.Lesson.CourseSection.CourseVersion.ReviewStatus=="approved")||x.TaskSubmissions.Any(t=>t.SubmittedAt!=null&&t.CourseTask.CourseVersion.CourseId==x.CourseId))}).SingleOrDefaultAsync(ct);
        var ratings=await db.CourseReviews.AsNoTracking().Where(x=>owned.Any(c=>c.Id==x.Enrollment.CourseId)&&x.CreatedAt>=since).GroupBy(x=>x.Rating).Select(g=>new{Rating=g.Key,Count=g.Count()}).ToListAsync(ct);
        var count=ratings.Sum(x=>x.Count);var average=count==0?0:Math.Round(ratings.Sum(x=>(long)x.Rating*x.Count)/(double)count,1);
        var points=await db.PointTransactions.Where(x=>x.UserId==account&&x.TransactionType=="teaching"&&x.CreatedAt>=since&&x.Enrollment!=null&&owned.Any(c=>c.Id==x.Enrollment.CourseId)).SumAsync(x=>(long?)x.Amount,ct)??0;
        var chartStart=new DateTimeOffset(now.Year,now.Month,1,0,0,0,TimeSpan.Zero).AddMonths(-5);
        var months=await cohort.Where(x=>x.EnrolledAt>=chartStart).GroupBy(x=>new{x.EnrolledAt.Year,x.EnrolledAt.Month}).Select(g=>new{g.Key.Year,g.Key.Month,Count=g.Count()}).ToListAsync(ct);
        var completionMonths=await cohort.Where(x=>x.CompletedAt>=chartStart).GroupBy(x=>new{x.CompletedAt!.Value.Year,x.CompletedAt.Value.Month}).Select(g=>new{g.Key.Year,g.Key.Month,Count=g.Count()}).ToListAsync(ct);
        var performance=Enumerable.Range(0,6).Select(i=>{var start=new DateTimeOffset(now.Year,now.Month,1,0,0,0,TimeSpan.Zero).AddMonths(i-5);return new{Id=start.ToString("yyyy-MM"),Label=new{Ar=start.ToString("yyyy-MM"),En=start.ToString("yyyy-MM")},Learners=months.Where(x=>x.Year==start.Year&&x.Month==start.Month).Sum(x=>x.Count),Completions=completionMonths.Where(x=>x.Year==start.Year&&x.Month==start.Month).Sum(x=>x.Count)};});
        var sectionsQuery=db.CourseSections.AsNoTracking().Where(x=>owned.Any(c=>c.PublishedVersionId==x.CourseVersionId));
        var sections=await sectionsQuery.OrderBy(x=>x.CourseVersionId).ThenBy(x=>x.SortOrder).ThenBy(x=>x.Id).Skip((sectionPage-1)*50).Take(50).Select(x=>new{x.Id,x.TitleAr,x.TitleEn,x.CourseVersion.CourseId,Lessons=x.Lessons.Count}).ToListAsync(ct);
        var sectionIds=sections.Select(x=>x.Id).ToArray();
        var required=db.Lessons.Where(x=>sectionIds.Contains(x.CourseSectionId));
        var earned=from lesson in required from e in cohort where e.CourseId==lesson.CourseSection.CourseVersion.CourseId
            where e.Status=="completed"||e.CompletedAt!=null||e.LessonProgressRecords.Any(p=>p.IsCompleted&&p.Lesson.LogicalLessonId==lesson.LogicalLessonId&&p.Lesson.CourseSection.CourseVersion.CourseId==e.CourseId&&p.Lesson.CourseSection.CourseVersion.ReviewStatus=="approved")
            select new{lesson.CourseSectionId,e.Id,lesson.LogicalLessonId};
        var earnedCounts=await earned.Distinct().GroupBy(x=>x.CourseSectionId).Select(g=>new{Id=g.Key,Count=g.Count()}).ToDictionaryAsync(x=>x.Id,x=>x.Count,ct);
        var cohorts=await cohort.GroupBy(x=>x.CourseId).Select(g=>new{Id=g.Key,Count=g.Count()}).ToDictionaryAsync(x=>x.Id,x=>x.Count,ct);
        var sectionMetrics=sections.Select(x=>new{x.Id,x.TitleAr,x.TitleEn,CompletionRate=x.Lessons==0||cohorts.GetValueOrDefault(x.CourseId)==0?0:Math.Round(100d*earnedCounts.GetValueOrDefault(x.Id)/(cohorts[x.CourseId]*(double)x.Lessons),1)});
        var submissions=db.TaskSubmissions.Where(x=>owned.Any(c=>c.Id==x.Enrollment.CourseId)&&x.SubmittedAt!=null&&x.SubmittedAt>=since&&x.Status!="inProgress"&&x.CourseTask.CourseVersion.CourseId==x.Enrollment.CourseId&&x.CourseTask.CourseVersion.ReviewStatus=="approved");
        var taskCounts=await submissions.GroupBy(x=>x.Status).Select(g=>new{Status=g.Key,Count=g.Count()}).ToListAsync(ct);
        var course=courseId.HasValue?await owned.Select(x=>new{Id=x.Id,TitleAr=(x.PublishedVersion??x.DraftVersion)!.TitleAr,TitleEn=(x.PublishedVersion??x.DraftVersion)!.TitleEn,Status=(x.DraftVersion??x.PublishedVersion)!.ReviewStatus}).SingleOrDefaultAsync(ct):null;
        return new{AccountId=account,CapturedAt=now,Course=course,Period=period,PeriodSemantics="Enrollment cohort; reviews and ledger by event time",Learners=new{Enrolled=totals?.Enrolled??0,Started=totals?.Started??0,Completed=totals?.Completed??0,InProgress=Math.Max(0,(totals?.Started??0)-(totals?.Completed??0)),AmbiguousHistorical=totals?.Ambiguous??0},
            Ratings=new{Average=average,Total=count,Distribution=Enumerable.Range(1,5).ToDictionary(x=>x.ToString(),x=>ratings.Where(r=>r.Rating==x).Sum(r=>r.Count))},Sections=sectionMetrics,SectionsPage=sectionPage,SectionsTotalCount=await sectionsQuery.CountAsync(ct),EarnedPoints=points,Performance=performance,
            Stats=new{Learners=totals?.Unique??0,LearnerGrowthPercent=(double?)null,Rating=average,RatingCount=count,WeeklyJoinRate=totals?.Weekly??0,AverageWatchHours=(double?)null,OverallCompletionRate=totals?.Enrolled>0?Math.Round(100d*totals.Completed/totals.Enrolled,1):0},
            TaskStats=new{AwaitingReview=taskCounts.Where(x=>x.Status=="awaitingReview").Sum(x=>x.Count),ApprovedAttempts=taskCounts.Where(x=>x.Status=="approved").Sum(x=>x.Count)},SubmissionCount=taskCounts.Sum(x=>x.Count)};
    }
}
