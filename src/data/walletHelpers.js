/**هذا يحسب الرصيد ويمنع احتساب مكافأة الدورة مرتين */

import { courses } from "./courses";

export function getWalletSnapshot(openingBalance, awards) {
  const seenCourses = new Set();

  const validAwards = awards
    .filter((award) => {
      const exists = courses.some(
        (course) => course.id === award.courseId,
      );

      if (
        !exists ||
        seenCourses.has(award.courseId) ||
        !Number.isFinite(award.points) ||
        award.points <= 0 ||
        !Number.isFinite(Date.parse(award.approvedAt))
      ) {
        return false;
      }

      seenCourses.add(award.courseId);
      return true;
    })
    .map((award) => ({
      ...award,
      course: courses.find(
        (course) => course.id === award.courseId,
      ),
    }))
    .sort(
      (a, b) =>
        Date.parse(b.approvedAt) - Date.parse(a.approvedAt),
    );

  const earned = validAwards.reduce(
    (sum, award) => sum + award.points,
    0,
  );

  return {
    balance: openingBalance + earned,
    earned,
    awards: validAwards,
    approvedCount: validAwards.length,
  };
}