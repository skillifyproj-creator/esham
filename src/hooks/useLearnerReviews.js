import { useEffect, useState } from "react";
import { courses } from "../data/courses";

const KEY = "esham-learner-reviews-v1";

export function validReview(review) {
  return (
    review &&
    courses.some((course) => course.id === review.courseId) &&
    Number.isInteger(review.rating) &&
    review.rating >= 1 &&
    review.rating <= 5 &&
    typeof review.text === "string" &&
    Array.from(review.text.trim()).length >= 25 &&
    Array.from(review.text.trim()).length <= 2000 &&
    Number.isFinite(Date.parse(review.createdAt)) &&
    Number.isFinite(Date.parse(review.updatedAt))
  );
}

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));

    if (!Array.isArray(saved)) return [];

    const seen = new Set();

    return saved
      .filter(validReview)
      .filter((review) => {
        if (seen.has(review.courseId)) return false;

        seen.add(review.courseId);
        return true;
      });
  } catch {
    return [];
  }
}

export function useLearnerReviews() {
  const [reviews, setReviews] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(reviews));
    } catch {
      // تبقى المراجعات متاحة أثناء الجلسة.
    }
  }, [reviews]);

  function saveReview(courseId, rating, text) {
    const now = new Date().toISOString();

    const record = {
      courseId,
      rating,
      text: text.trim(),
      createdAt: now,
      updatedAt: now,
    };

    if (!validReview(record)) return false;

    setReviews((previous) => {
      const old = previous.find(
        (review) => review.courseId === courseId,
      );

      const next = {
        ...record,
        createdAt: old?.createdAt ?? now,
      };

      return [
        ...previous.filter(
          (review) => review.courseId !== courseId,
        ),
        next,
      ];
    });

    return true;
  }

  function deleteReview(courseId) {
    setReviews((previous) =>
      previous.filter(
        (review) => review.courseId !== courseId,
      ),
    );
  }

  return {
    reviews,
    saveReview,
    deleteReview,
  };
}