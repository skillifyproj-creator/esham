using esham.BLL.DTOs.Reviews;
using esham.BLL.Services;
using esham.DAL.Data;
using Microsoft.EntityFrameworkCore;
namespace esham.PL.Endpoints;
public static class LearnerReviewEndpoints
{
    public static IEndpointRouteBuilder MapLearnerReviewEndpoints(this IEndpointRouteBuilder routes){
        routes.MapGet("/api/admin/learner-reviews",async(HttpContext c,LearnerReviewService s,int? page,CancellationToken ct)=>(await s.AdminListAsync(c.User,page??1,ct)).ToHttp()).RequireAuthorization().AddEndpointFilter<FinancialResponseFilter>();
        var read=routes.MapGroup("/me").RequireAuthorization().AddEndpointFilter<FinancialResponseFilter>();
        read.MapGet("/reviews",async(HttpContext c,LearnerReviewService s,int? page,int? pageSize,CancellationToken ct)=>(await s.ListAsync(c.User,page??1,pageSize??20,ct)).ToHttp());
        read.MapGet("/enrollments/{id:guid}/review",async(Guid id,HttpContext c,LearnerReviewService s,CancellationToken ct)=>(await s.GetAsync(c.User,id,ct)).ToHttp());
        var write=read.MapGroup("").AddEndpointFilter<AdminMutationFilter>().AddEndpointFilter<EnrollmentAccountFilter>();
        write.MapPut("/enrollments/{id:guid}/review",async(Guid id,ReviewWrite input,HttpContext c,LearnerReviewService s,CancellationToken ct)=>(await s.WriteAsync(c.User,id,input,ct)).ToHttp());
        write.MapDelete("/enrollments/{id:guid}/review",async(Guid id,[Microsoft.AspNetCore.Mvc.FromBody] ReviewRemove input,HttpContext c,LearnerReviewService s,CancellationToken ct)=>(await s.RemoveAsync(c.User,id,input,ct:ct)).ToHttp());
        var instructor=routes.MapGroup("/api/instructor/reviews").RequireAuthorization().AddEndpointFilter<FinancialResponseFilter>().AddEndpointFilter<AdminMutationFilter>().AddEndpointFilter<EnrollmentAccountFilter>();
        async Task<IResult> Reply(Guid id,ReplyWrite input,HttpContext c,LearnerReviewService s,AppDbContext db,bool remove,CancellationToken ct){var enrollment=await db.CourseReviews.AsNoTracking().Where(x=>x.Id==id).Select(x=>(Guid?)x.EnrollmentId).SingleOrDefaultAsync(ct);return enrollment==null?Results.NotFound():(await s.ReplyAsync(c.User,enrollment.Value,input,remove,ct)).ToHttp();}
        instructor.MapPut("/{id:guid}/reply",async(Guid id,ReplyWrite input,HttpContext c,LearnerReviewService s,AppDbContext db,CancellationToken ct)=>await Reply(id,input,c,s,db,false,ct));
        instructor.MapDelete("/{id:guid}/reply",async(Guid id,[Microsoft.AspNetCore.Mvc.FromBody] ReplyWrite input,HttpContext c,LearnerReviewService s,AppDbContext db,CancellationToken ct)=>await Reply(id,input,c,s,db,true,ct));
        routes.MapDelete("/api/admin/enrollments/{id:guid}/review",async(Guid id,[Microsoft.AspNetCore.Mvc.FromBody] ReviewRemove input,HttpContext c,LearnerReviewService s,CancellationToken ct)=>(await s.RemoveAsync(c.User,id,input,true,ct)).ToHttp()).RequireAuthorization().AddEndpointFilter<AdminMutationFilter>().AddEndpointFilter<EnrollmentAccountFilter>().AddEndpointFilter<FinancialResponseFilter>();
        routes.MapGet("/api/courses/public/{id:guid}/reviews",async(Guid id,AppDbContext db,int? page,int? pageSize,CancellationToken ct)=>{
            var p=page??1;var size=pageSize??20;if(p<1||size<1||size>100||(long)(p-1)*size>int.MaxValue)return Results.BadRequest();
            if(!await db.Courses.AnyAsync(x=>x.Id==id&&x.SafetyStatus=="active"&&x.PublishedVersion!=null&&x.PublishedVersion.ReviewStatus=="approved"&&EducationalCategories.Visible(db).Any(cat=>cat.Id==x.PublishedVersion.CategoryId),ct))return Results.NotFound();
            var q=db.CourseReviews.AsNoTracking().Where(x=>x.Enrollment.CourseId==id);
            var items=await q.OrderByDescending(x=>x.CreatedAt).ThenBy(x=>x.Id).Skip((p-1)*size).Take(size).Select(x=>new{x.Id,x.Rating,x.Comment,x.InstructorReply,x.CreatedAt,x.UpdatedAt,x.RepliedAt,x.CourseVersionId}).ToListAsync(ct);
            return Results.Ok(new{items,page=p,pageSize=size,totalCount=await q.CountAsync(ct),averageRating=await q.AverageAsync(x=>(double?)x.Rating,ct)});
        }).AllowAnonymous();
        return routes;
    }
}
