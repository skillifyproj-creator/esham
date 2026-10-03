import { useEffect, useState } from "react";
import { learnerNotifications } from "../data/learnerNotifications";

const KEY = "esham-notification-read-v1";

function load() {
  try {
    const saved = JSON.parse(localStorage.getItem(KEY));

    if (Array.isArray(saved)) {
      return saved.filter((id) => typeof id === "string");
    }
  } catch {
    // نستخدم الحالة التجريبية الافتراضية.
  }

  return learnerNotifications
    .filter((item) => item.read)
    .map((item) => item.id);
}

export function useLearnerNotifications() {
  const [readIds, setReadIds] = useState(load);

  useEffect(() => {
    try {
      localStorage.setItem(KEY, JSON.stringify(readIds));
    } catch {
      // تبقى حالة القراءة متاحة أثناء الجلسة.
    }
  }, [readIds]);

  const read = new Set(readIds);

  const notifications = learnerNotifications.map((item) => ({
    ...item,
    read: read.has(item.id),
  }));

  function markRead(id) {
    if (!learnerNotifications.some((item) => item.id === id)) {
      return;
    }

    setReadIds((previous) => [
      ...new Set([...previous, id]),
    ]);
  }

  function markAll() {
    setReadIds(
      learnerNotifications.map((item) => item.id),
    );
  }

  return {
    notifications,
    markRead,
    markAll,
  };
}
