import prisma from "@/lib/prisma";
import { getAnalyticsByUserId, updateAnalyticsByUserId } from "@/lib/services/analyticService";
import {
  addProjectMember,
  createProjectTask,
  createProjectInvite,
  createProject,
  ProjectServiceError,
  updateProjectTaskById,
} from "@/lib/services/projectService";

jest.mock("@/lib/prisma", () => {
  const db: Record<string, unknown> = {};

  Object.assign(db, {
    $transaction: jest.fn(async (callback: (client: unknown) => unknown) => callback(db)),
    project: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    projectUser: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    projectInvite: {
      upsert: jest.fn(),
    },
    user: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    task: {
      create: jest.fn(),
      findUnique: jest.fn(),
      update: jest.fn(),
      delete: jest.fn(),
    },
    taskUser: {
      create: jest.fn(),
      deleteMany: jest.fn(),
    },
    attachment: {
      findMany: jest.fn(),
      updateMany: jest.fn(),
    },
  });

  return {
    __esModule: true,
    default: db,
  };
});

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

describe("projectService invites", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a pending invite for a target user id", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      user_id: "student-2",
      user_email: "student2@example.com",
    });
    (prisma.projectUser.findUnique as jest.Mock)
      .mockResolvedValueOnce({ project_user_role: "owner" })
      .mockResolvedValueOnce(null);
    (prisma.projectInvite.upsert as jest.Mock).mockResolvedValue({
      invite_id: 88,
      project_id: 12,
      invited_user: "student-2",
      invited_by: "owner-1",
      status: "pending",
    });

    await createProjectInvite(12, "owner-1", {
      targetUserId: "student-2",
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { user_id: "student-2" },
    });
    expect(prisma.projectInvite.upsert).toHaveBeenCalledWith({
      where: {
        project_id_invited_user: {
          project_id: 12,
          invited_user: "student-2",
        },
      },
      update: {
        invited_by: "owner-1",
        status: "pending",
        created_at: expect.any(Date),
        responded_at: null,
      },
      create: {
        project_id: 12,
        invited_user: "student-2",
        invited_by: "owner-1",
        status: "pending",
      },
    });
  });

  it("falls back to target email for backwards compatible invites", async () => {
    (prisma.user.findUnique as jest.Mock).mockResolvedValue({
      user_id: "student-3",
      user_email: "student3@example.com",
    });
    (prisma.projectUser.findUnique as jest.Mock)
      .mockResolvedValueOnce({ project_user_role: "owner" })
      .mockResolvedValueOnce(null);
    (prisma.projectInvite.upsert as jest.Mock).mockResolvedValue({
      invite_id: 89,
      project_id: 12,
      invited_user: "student-3",
      invited_by: "owner-1",
      status: "pending",
    });

    await createProjectInvite(12, "owner-1", {
      targetUserEmail: "student3@example.com",
    });

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { user_email: "student3@example.com" },
    });
  });
});

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

describe("projectService project task permissions and deadlines", () => {
  const projectTask = {
    task_id: 42,
    project_id: 12,
    task_name: "Draft section",
    task_description: null,
    task_deadline: new Date("2099-06-20T12:00:00.000Z"),
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
    task_users: [],
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (getAnalyticsByUserId as jest.Mock).mockResolvedValue(null);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("creates project tasks with the requested deadline instead of a fallback deadline", async () => {
    const deadline = new Date("2099-07-01T16:59:00.000Z");
    (prisma.project.findUnique as jest.Mock).mockResolvedValue({ project_id: 12 });
    (prisma.projectUser.findUnique as jest.Mock).mockResolvedValue({ project_user_role: "owner" });
    (prisma.task.create as jest.Mock).mockResolvedValue({
      ...projectTask,
      task_deadline: deadline,
      project: {},
    });
    (prisma.task.findUnique as jest.Mock).mockResolvedValue({
      ...projectTask,
      task_deadline: deadline,
    });

    await createProjectTask("owner-1", {
      projectId: 12,
      title: "Draft section",
      description: "Write the draft",
      deadline,
      priority: 3,
      status: "Pending",
    });

    expect(prisma.task.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          task_deadline: deadline,
        }),
      }),
    );
  });

  it("lets owners edit project task details including deadline", async () => {
    const nextDeadline = new Date("2099-08-15T10:30:00.000Z");
    (prisma.task.findUnique as jest.Mock).mockResolvedValue(projectTask);
    (prisma.task.update as jest.Mock).mockResolvedValue({
      ...projectTask,
      task_name: "Updated draft",
      task_deadline: nextDeadline,
    });

    await updateProjectTaskById(42, "owner-1", {
      title: "Updated draft",
      deadline: nextDeadline,
    });

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          task_name: "Updated draft",
          task_deadline: nextDeadline,
        }),
      }),
    );
  });

  it("lets a member claim an unassigned project task only for themselves", async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue({
      ...projectTask,
      project: {
        project_user: [{ project_user_role: "collaborator" }],
      },
      task_users: [],
    });
    (prisma.task.update as jest.Mock).mockResolvedValue(projectTask);

    await updateProjectTaskById(42, "member-1", { assignedTo: "member-1" });

    expect(prisma.taskUser.deleteMany).toHaveBeenCalledWith({ where: { task_id: 42 } });
    expect(prisma.taskUser.create).toHaveBeenCalledWith({
      data: {
        task_id: 42,
        user_id: "member-1",
      },
    });
  });

  it("rejects a member assigning an unassigned project task to someone else", async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue({
      ...projectTask,
      project: {
        project_user: [{ project_user_role: "collaborator" }],
      },
      task_users: [],
    });

    await expect(
      updateProjectTaskById(42, "member-1", { assignedTo: "member-2" }),
    ).rejects.toMatchObject({
      status: 403,
      message: "Members can only claim unassigned tasks for themselves",
    });

    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it("rejects project task detail edits from assigned non-owner members", async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue({
      ...projectTask,
      project: {
        project_user: [{ project_user_role: "collaborator" }],
      },
      task_users: [{ user_id: "member-1" }],
    });

    await expect(
      updateProjectTaskById(42, "member-1", { title: "Member rename" }),
    ).rejects.toMatchObject({
      status: 403,
      message: "Only the project owner can edit project task details",
    });

    expect(prisma.task.update).not.toHaveBeenCalled();
  });

  it("lets assigned members move their own project task status", async () => {
    (prisma.task.findUnique as jest.Mock).mockResolvedValue({
      ...projectTask,
      project: {
        project_user: [{ project_user_role: "collaborator" }],
      },
      task_users: [{ user_id: "member-1" }],
    });
    (prisma.task.update as jest.Mock).mockResolvedValue({
      ...projectTask,
      task_status: "In_Progress",
    });

    await updateProjectTaskById(42, "member-1", { status: "In_Progress" });

    expect(prisma.task.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          task_status: "In_Progress",
        }),
      }),
    );
  });
});
