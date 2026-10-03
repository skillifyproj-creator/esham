// مكافأة الإكمال منفصلة عن تكلفة التسجيل course.points.
export const pointsPolicy = {
  courseReward: 20,
};

// لاحقًا تأتي هذه السجلات من الباك بعد اعتماد المدرّب.
// شكل السجل:
// { id, courseId, points, approvedAt }

export const approvedCourseAwards = [];