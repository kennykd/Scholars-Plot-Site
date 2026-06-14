import { getTaskStatusAnalyticsUpdate } from "@/lib/services/taskStatusAnalytics";
import type { AnalyticsData } from "@/types";

function analytics(overrides: Partial<AnalyticsData> = {}): AnalyticsData {
  return {
    completionStats: {
      early: 2,
      onTime: 1,
      late: 0,
      pending: 4,
      ...overrides.completionStats,
    },
    timeByTask: [],
    productivityByDay: [],
    streak: 0,
    totalFocusMinutes: 0,
    totalTasksCompleted: 5,
    ...overrides,
  };
}

describe("task status analytics updates", () => {
  it("returns no update for non-completion status transitions", () => {
    const update = getTaskStatusAnalyticsUpdate({
      currentAnalytics: analytics(),
      previousStatus: "Pending",
      nextStatus: "In_Progress",
      deadline: new Date("2026-06-20T12:00:00.000Z"),
      completionDate: new Date("2026-06-10T12:00:00.000Z"),
      previousCompletedAt: null,
    });

    expect(update).toBeNull();
  });

  it("increments the correct bucket and streak activity when entering Completed", () => {
    const update = getTaskStatusAnalyticsUpdate({
      currentAnalytics: analytics({
        completionStats: { early: 2, onTime: 1, late: 3, pending: 4 },
        totalTasksCompleted: 9,
      }),
      previousStatus: "In_Progress",
      nextStatus: "Completed",
      deadline: new Date("2026-06-10T12:00:00.000Z"),
      completionDate: new Date("2026-06-11T12:00:00.000Z"),
      previousCompletedAt: null,
    });

    expect(update).toEqual({
      tasks_pending: 3,
      total_tasks_completed: 10,
      tasks_completed_early: 2,
      tasks_completed_on_time: 1,
      tasks_completed_late: 4,
      streak_activity: true,
    });
  });

  it("reverses the original bucket when leaving Completed", () => {
    const update = getTaskStatusAnalyticsUpdate({
      currentAnalytics: analytics({
        completionStats: { early: 2, onTime: 1, late: 3, pending: 0 },
        totalTasksCompleted: 9,
      }),
      previousStatus: "Completed",
      nextStatus: "Pending",
      deadline: new Date("2026-06-10T12:00:00.000Z"),
      completionDate: new Date("2026-06-12T12:00:00.000Z"),
      previousCompletedAt: new Date("2026-06-08T12:00:00.000Z"),
    });

    expect(update).toEqual({
      tasks_pending: 1,
      total_tasks_completed: 8,
      tasks_completed_early: 1,
      tasks_completed_on_time: 1,
      tasks_completed_late: 3,
    });
  });
});
