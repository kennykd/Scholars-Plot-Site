import prisma from "@/lib/prisma";
import { getAnalyticsByUserId, updateAnalyticsByUserId } from "@/lib/services/analyticService";
import { updateTaskById } from "@/lib/services/taskService";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    task: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    taskReminder: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/services/analyticService", () => ({
  getAnalyticsByUserId: jest.fn(),
  updateAnalyticsByUserId: jest.fn(),
}));

jest.mock("@/lib/services/weightService", () => ({
  incrementTasksSinceLast: jest.fn(),
  shouldRunAdapter: jest.fn(),
}));

const baseTask = {
  task_id: 42,
  project_id: null,
  task_name: "Physics study",
  task_description: null,
  task_deadline: new Date("2026-06-20T12:00:00.000Z"),
  task_priority: 3,
  task_status: "Pending",
  task_completed_at: null,
  task_created_at: new Date("2026-06-01T12:00:00.000Z"),
  estimated_minutes: null,
  confidence_score: null,
  grade_weight_percent: null,
  ai_priority_score: null,
  ai_analyzed_at: null,
  task_users: [{ user_id: "user-1" }],
};

const analytics = {
  completionStats: {
    early: 1,
    onTime: 0,
    late: 0,
    pending: 3,
  },
  timeByTask: [],
  productivityByDay: [],
  streak: 0,
  totalFocusMinutes: 0,
  totalTasksCompleted: 4,
};

describe("updateTaskById status analytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-10T12:00:00.000Z"));
    (getAnalyticsByUserId as jest.Mock).mockResolvedValue(analytics);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("returns becameCompleted and records completion analytics only on transition into Completed", async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue(baseTask);
    const updatedTask = {
      ...baseTask,
      task_status: "Completed",
      task_completed_at: new Date("2026-06-10T12:00:00.000Z"),
    };
    (prisma.task.update as jest.Mock).mockResolvedValue(updatedTask);

    const result = await updateTaskById(42, "user-1", { status: "Completed" });

    expect(result).toEqual({ task: updatedTask, becameCompleted: true });
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          task_status: "Completed",
          task_completed_at: new Date("2026-06-10T12:00:00.000Z"),
        }),
      }),
    );
    expect(updateAnalyticsByUserId).toHaveBeenCalledWith("user-1", {
      tasks_pending: 2,
      total_tasks_completed: 5,
      tasks_completed_early: 2,
      tasks_completed_on_time: 0,
      tasks_completed_late: 0,
      streak_activity: true,
    });
  });

  it("returns false and skips analytics for Pending to In_Progress", async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue(baseTask);
    const updatedTask = { ...baseTask, task_status: "In_Progress" };
    (prisma.task.update as jest.Mock).mockResolvedValue(updatedTask);

    const result = await updateTaskById(42, "user-1", { status: "In_Progress" });

    expect(result).toEqual({ task: updatedTask, becameCompleted: false });
    expect(getAnalyticsByUserId).not.toHaveBeenCalled();
    expect(updateAnalyticsByUserId).not.toHaveBeenCalled();
  });

  it("clears completion time and reverses analytics when leaving Completed", async () => {
    const completedTask = {
      ...baseTask,
      task_status: "Completed",
      task_completed_at: new Date("2026-06-08T12:00:00.000Z"),
    };
    (prisma.task.findUnique as jest.Mock).mockResolvedValue(completedTask);
    const updatedTask = {
      ...completedTask,
      task_status: "In_Progress",
      task_completed_at: null,
    };
    (prisma.task.update as jest.Mock).mockResolvedValue(updatedTask);

    const result = await updateTaskById(42, "user-1", { status: "In_Progress" });

    expect(result).toEqual({ task: updatedTask, becameCompleted: false });
    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          task_status: "In_Progress",
          task_completed_at: null,
        }),
      }),
    );
    expect(updateAnalyticsByUserId).toHaveBeenCalledWith("user-1", {
      tasks_pending: 4,
      total_tasks_completed: 3,
      tasks_completed_early: 0,
      tasks_completed_on_time: 0,
      tasks_completed_late: 0,
    });
  });

  it("does not double-count repeated Completed updates", async () => {
    const completedTask = {
      ...baseTask,
      task_status: "Completed",
      task_completed_at: new Date("2026-06-08T12:00:00.000Z"),
    };
    (prisma.task.findUnique as jest.Mock).mockResolvedValue(completedTask);
    (prisma.task.update as jest.Mock).mockResolvedValue(completedTask);

    const result = await updateTaskById(42, "user-1", { status: "Completed" });

    expect(result).toEqual({ task: completedTask, becameCompleted: false });
    expect(updateAnalyticsByUserId).not.toHaveBeenCalled();
  });
});
