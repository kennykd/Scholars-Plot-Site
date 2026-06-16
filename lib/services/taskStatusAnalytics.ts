import type { AnalyticsData, AnalyticsInput, TaskStatus } from "@/types";

type CompletionBucket =
  | "tasks_completed_early"
  | "tasks_completed_on_time"
  | "tasks_completed_late";

interface TaskStatusAnalyticsUpdateInput {
  currentAnalytics: AnalyticsData;
  previousStatus: TaskStatus;
  nextStatus: TaskStatus;
  deadline: Date;
  completionDate: Date;
  previousCompletedAt: Date | null;
}

function clampNonNegative(value: number) {
  return Math.max(0, value);
}

function completionBucket(completedAt: Date, deadline: Date): CompletionBucket {
  const completedTime = completedAt.getTime();
  const deadlineTime = deadline.getTime();

  if (completedTime < deadlineTime) return "tasks_completed_early";
  if (completedTime > deadlineTime) return "tasks_completed_late";
  return "tasks_completed_on_time";
}

export function isCompletionStatusTransition(
  previousStatus: TaskStatus,
  nextStatus: TaskStatus | undefined,
) {
  return (
    nextStatus !== undefined &&
    previousStatus !== nextStatus &&
    (previousStatus === "Completed" || nextStatus === "Completed")
  );
}

export function getTaskStatusAnalyticsUpdate({
  currentAnalytics,
  previousStatus,
  nextStatus,
  deadline,
  completionDate,
  previousCompletedAt,
}: TaskStatusAnalyticsUpdateInput): Partial<AnalyticsInput> | null {
  if (!isCompletionStatusTransition(previousStatus, nextStatus)) {
    return null;
  }

  const update: Partial<AnalyticsInput> = {
    tasks_pending: currentAnalytics.completionStats.pending,
    total_tasks_completed: currentAnalytics.totalTasksCompleted,
    tasks_completed_early: currentAnalytics.completionStats.early,
    tasks_completed_on_time: currentAnalytics.completionStats.onTime,
    tasks_completed_late: currentAnalytics.completionStats.late,
  };

  if (nextStatus === "Completed") {
    const bucket = completionBucket(completionDate, deadline);
    update.tasks_pending = clampNonNegative(currentAnalytics.completionStats.pending - 1);
    update.total_tasks_completed = currentAnalytics.totalTasksCompleted + 1;
    update[bucket] = (update[bucket] ?? 0) + 1;
    update.streak_activity = true;
    return update;
  }

  if (previousStatus === "Completed") {
    const bucket = completionBucket(previousCompletedAt ?? completionDate, deadline);
    update.tasks_pending = currentAnalytics.completionStats.pending + 1;
    update.total_tasks_completed = clampNonNegative(currentAnalytics.totalTasksCompleted - 1);
    update[bucket] = clampNonNegative((update[bucket] ?? 0) - 1);
    return update;
  }

  return null;
}
