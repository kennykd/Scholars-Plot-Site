import prisma from "@/lib/prisma";
import { getAnalyticsByUserId, updateAnalyticsByUserId } from "@/lib/services/analyticService";
import {
  addProjectMember,
  createProject,
  ProjectServiceError,
  updateProjectTaskById,
} from "@/lib/services/projectService";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    project: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    projectUser: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    task: {
      findUnique: jest.fn(),
      update: jest.fn(),
    },
    taskUser: {
      deleteMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

jest.mock("@/lib/services/analyticService", () => ({
  getAnalyticsByUserId: jest.fn(),
  updateAnalyticsByUserId: jest.fn(),
}));

const projectInput = {
  name: "Capstone",
  description: "Research project",
  deadline: new Date("2099-06-20T16:59:00.000Z"),
  priority: 3,
  project_status: "active" as const,
};

describe("projectService user validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("creates an owner-only project without validating extra members", async () => {
    (prisma.project.create as jest.Mock).mockResolvedValue({
      project_id: 12,
      project_name: "Capstone",
      project_user: [{ user_id: "owner-1", project_user_role: "owner" }],
      tasks: [],
    });

    await createProject("owner-1", projectInput);

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          project_user: {
            create: [{ user_id: "owner-1", project_user_role: "owner" }],
          },
        }),
      }),
    );
  });

  it("rejects additional project members that do not exist", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { user_id: "member-1" },
    ]);

    await expect(
      createProject("owner-1", {
        ...projectInput,
        members: [
          {
            id: "member-1",
            name: "Ada",
            role: "member",
          },
          {
            id: "missing-member",
            name: "Missing",
            role: "member",
          },
        ],
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Project member does not exist: missing-member",
    });
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it("rejects adding a nonexistent member to an existing project", async () => {
    (prisma.project.findUnique as jest.Mock).mockResolvedValue({
      project_id: 12,
    });
    (prisma.projectUser.findUnique as jest.Mock)
      .mockResolvedValueOnce({ project_user_role: "owner" })
      .mockResolvedValueOnce(null);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

    const promise = addProjectMember(12, "owner-1", {
      id: "missing-member",
      name: "Missing",
      role: "member",
    });

    await expect(promise).rejects.toBeInstanceOf(ProjectServiceError);
    await expect(promise).rejects.toMatchObject({
      status: 400,
      message: "Project member does not exist: missing-member",
    });
    expect(prisma.projectUser.create).not.toHaveBeenCalled();
  });
});

describe("projectService task status analytics", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-10T12:00:00.000Z"));
    (getAnalyticsByUserId as jest.Mock).mockResolvedValue({
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
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("credits the assigned user when a project task is completed by a manager", async () => {
    const existingTask = {
      task_id: 42,
      project_id: 12,
      task_name: "Draft section",
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
      project: {
        project_user: [{ project_user_role: "owner" }],
      },
      task_users: [{ user_id: "assignee-1" }],
    };
    (prisma.task.findUnique as jest.Mock).mockResolvedValue(existingTask);
    (prisma.task.update as jest.Mock).mockResolvedValue({
      ...existingTask,
      task_status: "Completed",
      task_completed_at: new Date("2026-06-10T12:00:00.000Z"),
    });

    await updateProjectTaskById(42, "owner-1", { status: "Completed" });

    expect(getAnalyticsByUserId).toHaveBeenCalledWith("assignee-1");
    expect(getAnalyticsByUserId).not.toHaveBeenCalledWith("owner-1");
    expect(updateAnalyticsByUserId).toHaveBeenCalledWith("assignee-1", {
      tasks_pending: 2,
      total_tasks_completed: 5,
      tasks_completed_early: 2,
      tasks_completed_on_time: 0,
      tasks_completed_late: 0,
      streak_activity: true,
    });
  });
});
