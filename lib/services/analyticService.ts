import prisma from "@/lib/prisma";
import { encrypt, decrypt } from "../crypto";
import { AnalyticsInput, AnalyticsData } from "@/types";
import { startOfWeek, endOfWeek, eachDayOfInterval, format } from "date-fns";

type AnalyticsSource = {
  tasks_completed_early?: string | null;
  tasksCompletedEarly?: string | number | null;
  tasks_completed_on_time?: string | null;
  tasksCompletedOnTime?: string | number | null;
  tasks_completed_late?: string | null;
  tasksCompletedLate?: string | number | null;
  tasks_pending?: string | null;
  total_focus_minutes?: string | null;
  total_tasks_completed?: string | null;
  streak?: string | null;
};

function decryptToNumber(encryptedText: string | number | null | undefined): number {
  if (!encryptedText) return 0;

  if (typeof encryptedText === "number") {
    return Number.isFinite(encryptedText) ? encryptedText : 0;
  }

  if (typeof encryptedText !== "string" || !encryptedText.includes(":")) {
    const parsed = parseInt(encryptedText, 10);
    return isNaN(parsed) ? 0 : parsed;
  }

  try {
    const decrypted = decrypt(encryptedText);
    const num = parseInt(decrypted, 10);
    return isNaN(num) ? 0 : num;
  } catch {
    return 0;
  }
}

export async function transformToAnalyticsData(
  dbAnalytics: AnalyticsSource | null | undefined,
  userId: string
): Promise<AnalyticsData> {
  const now = new Date();
  const startOfCurrentWeek = startOfWeek(now, { weekStartsOn: 1 });
  const endOfCurrentWeek = endOfWeek(now, { weekStartsOn: 1 });

  const [
    totalPendingCount,
    completedSessions,
    completedTasksThisWeek,
    completedSessionsThisWeek
  ] = await Promise.all([
    prisma.task.count({
      where: {
        task_users: { some: { user_id: userId } },
        task_status: { in: ["Pending", "In_Progress"] },
      },
    }),
    prisma.studySessionUser.findMany({
      where: {
        user_id: userId,
        status: "completed",
        task_id: { not: null },
      },
      select: {
        actual_duration: true,
        study_session: { select: { focus_minutes: true } },
        task: { select: { task_name: true } }
      }
    }),
    prisma.task.findMany({
      where: {
        task_users: { some: { user_id: userId } },
        task_status: "Completed",
        task_completed_at: { gte: startOfCurrentWeek, lte: endOfCurrentWeek }
      },
      select: { task_completed_at: true }
    }),
    prisma.studySessionUser.findMany({
      where: {
        user_id: userId,
        status: "completed",
        completed_at: { gte: startOfCurrentWeek, lte: endOfCurrentWeek }
      },
      select: { completed_at: true }
    })
  ]);

  const taskTimeMap: Record<string, number> = {};
  let computedTotalFocusMinutes = 0;

  for (const row of completedSessions) {
    const name = row.task?.task_name || "Unnamed Linked Task";
    const durationInMinutes = row.actual_duration
      ? Math.round(Number(row.actual_duration) / 60)
      : (row.study_session?.focus_minutes ?? 0);

    taskTimeMap[name] = (taskTimeMap[name] || 0) + durationInMinutes;
    computedTotalFocusMinutes += durationInMinutes;
  }

  const timeByTask = Object.entries(taskTimeMap)
    .map(([taskName, minutes]) => ({ taskName, minutes }))
    .sort((a, b) => b.minutes - a.minutes)
    .slice(0, 6);

  const weekDays = eachDayOfInterval({ start: startOfCurrentWeek, end: endOfCurrentWeek });
  const productivityByDay = weekDays.map((date) => {
    const dayLabel = format(date, "EEE");
    const tasksCount = completedTasksThisWeek.filter((t) => t.task_completed_at && format(new Date(t.task_completed_at), "EEE") === dayLabel).length;
    const sessionsCount = completedSessionsThisWeek.filter((s) => s.completed_at && format(new Date(s.completed_at), "EEE") === dayLabel).length;

    return { day: dayLabel, tasksCompleted: tasksCount, sessionsCompleted: sessionsCount };
  });

  const earlyVal = dbAnalytics?.tasks_completed_early ?? dbAnalytics?.tasksCompletedEarly;
  const onTimeVal = dbAnalytics?.tasks_completed_on_time ?? dbAnalytics?.tasksCompletedOnTime;
  const lateVal = dbAnalytics?.tasks_completed_late ?? dbAnalytics?.tasksCompletedLate;
  const streakVal = dbAnalytics?.streak;

  return {
    completionStats: {
      early: decryptToNumber(earlyVal),
      onTime: decryptToNumber(onTimeVal),
      late: decryptToNumber(lateVal),
      pending: totalPendingCount,
    },
    timeByTask,
    productivityByDay,
    streak: decryptToNumber(streakVal),
    totalFocusMinutes: computedTotalFocusMinutes,

    // Reads from encrypted DB field (the accumulated all-time count)
    totalTasksCompleted: decryptToNumber(dbAnalytics?.total_tasks_completed),
  };
}

export async function getAnalyticsByUserId(userId: string): Promise<AnalyticsData> {
  let analytics = await prisma.analytics.findUnique({
    where: { user_id: userId },
  });

  if (!analytics) {
    analytics = await createAnalytics(userId);
  }

  return await transformToAnalyticsData(analytics, userId);
}

export async function createAnalytics(userId: string, data?: Partial<AnalyticsInput>) {
  const existing = await prisma.analytics.findUnique({ where: { user_id: userId } });
  if (existing) return existing;

  return await prisma.analytics.create({
    data: {
      user_id: userId,
      tasks_completed_early: encrypt(String(data?.tasks_completed_early ?? 0)),
      tasks_completed_on_time: encrypt(String(data?.tasks_completed_on_time ?? 0)),
      tasks_completed_late: encrypt(String(data?.tasks_completed_late ?? 0)),
      tasks_pending: encrypt(String(data?.tasks_pending ?? 0)),
      total_focus_minutes: encrypt(String(data?.total_focus_minutes ?? 0)),
      total_tasks_completed: encrypt(String(data?.total_tasks_completed ?? 0)),
      streak: encrypt(String(data?.streak ?? 0)),
      last_completion_date: null,
    },
  });
}

export async function updateAnalyticsByUserId(userId: string, data: Partial<AnalyticsInput>) {
  let current = await prisma.analytics.findUnique({
    where: { user_id: userId }
  });

  if (!current) {
    current = await createAnalytics(userId, data);
  }

  const currentEarly = decryptToNumber(current.tasks_completed_early);
  const currentOnTime = decryptToNumber(current.tasks_completed_on_time);
  const currentLate = decryptToNumber(current.tasks_completed_late);

  let currentStreak = decryptToNumber(current.streak);
  let nextCompletionDate = current.last_completion_date;

  const isCompletingTask = data.streak_activity === true;

  if (data.streak !== undefined) {
    currentStreak = data.streak;
  } else if (isCompletingTask) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const lastCompleted = current.last_completion_date ? new Date(current.last_completion_date) : null;
    nextCompletionDate = new Date();

    if (!lastCompleted) {
      currentStreak = 1;
    } else {
      lastCompleted.setHours(0, 0, 0, 0);
      const diffTime = today.getTime() - lastCompleted.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      if (diffDays === 1) {
        currentStreak += 1;
      } else if (diffDays > 1) {
        currentStreak = 1;
      }
    }
  }

  // Write all fields including total_tasks_completed and tasks_pending
  const updatedAnalytics = await prisma.analytics.update({
    where: { analytics_id: current.analytics_id },
    data: {
      tasks_completed_early: encrypt(String(data.tasks_completed_early !== undefined ? data.tasks_completed_early : currentEarly)),
      tasks_completed_on_time: encrypt(String(data.tasks_completed_on_time !== undefined ? data.tasks_completed_on_time : currentOnTime)),
      tasks_completed_late: encrypt(String(data.tasks_completed_late !== undefined ? data.tasks_completed_late : currentLate)),
      streak: encrypt(String(currentStreak)),
      last_completion_date: nextCompletionDate,
      ...(data.total_tasks_completed !== undefined && {
        total_tasks_completed: encrypt(String(data.total_tasks_completed)),
      }),
      ...(data.tasks_pending !== undefined && {
        tasks_pending: encrypt(String(data.tasks_pending)),
      }),
    },
  });

  // Pass the freshly updated DB row into transform so it reads the new values
  return await transformToAnalyticsData(updatedAnalytics, userId);
}
