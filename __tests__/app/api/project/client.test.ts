import {
  createProjectTaskApi,
  serializeProject,
  serializeProjectTask,
  updateProjectApi,
  updateProjectTaskApi,
} from "@/app/api/project/client";

describe("project API client", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({
        task: {
          task_id: 42,
          project_id: 12,
          task_name: "Draft section",
          task_description: null,
          task_deadline: "2099-06-20T16:59:00.000Z",
          task_priority: 3,
          task_status: "Pending",
          task_created_at: "2026-06-01T12:00:00.000Z",
          task_completed_at: null,
          task_users: [],
        },
        project: {
          project_id: 12,
          project_name: "Capstone",
          project_description: null,
          project_deadline: "2099-06-30T16:59:00.000Z",
          project_status: "active",
          project_priority: 3,
          project_created_at: "2026-06-01T12:00:00.000Z",
          project_user: [],
          tasks: [],
        },
      }),
    })) as jest.Mock;
  });

  it("serializes project task deadlines", () => {
    expect(
      serializeProjectTask({
        task_id: 42,
        project_id: 12,
        task_name: "Draft section",
        task_description: null,
        task_deadline: "2099-06-20T16:59:00.000Z",
        task_priority: 3,
        task_status: "Pending",
        task_created_at: "2026-06-01T12:00:00.000Z",
        task_completed_at: null,
        task_users: [],
      }),
    ).toEqual(expect.objectContaining({ deadline: "2099-06-20T16:59:00.000Z" }));
  });

  it("serializes deadlines for project task lists", () => {
    const project = serializeProject({
      project_id: 12,
      project_name: "Capstone",
      project_description: null,
      project_deadline: "2099-06-30T16:59:00.000Z",
      project_status: "active",
      project_priority: 3,
      project_created_at: "2026-06-01T12:00:00.000Z",
      project_user: [],
      tasks: [
        {
          task_id: 42,
          project_id: 12,
          task_name: "Draft section",
          task_description: null,
          task_deadline: "2099-06-20T16:59:00.000Z",
          task_priority: 3,
          task_status: "Pending",
          task_created_at: "2026-06-01T12:00:00.000Z",
          task_completed_at: null,
          task_users: [],
        },
      ],
    });

    expect(project.tasks[0]).toEqual(
      expect.objectContaining({ deadline: "2099-06-20T16:59:00.000Z" }),
    );
  });

  it("normalizes serialized decimal project priorities to numbers", () => {
    const project = serializeProject({
      project_id: 12,
      project_name: "Capstone",
      project_description: null,
      project_deadline: "2099-06-30T16:59:00.000Z",
      project_status: "active",
      project_priority: "4.5" as unknown as number,
      project_created_at: "2026-06-01T12:00:00.000Z",
      project_user: [],
      tasks: [],
    });

    expect(project.priority).toBe(4.5);
  });

  it("sends deadlines when creating project tasks", async () => {
    await createProjectTaskApi(
      "project-12",
      "Draft section",
      "2099-06-20T16:59:00.000Z",
      3,
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/project/task",
      expect.objectContaining({
        method: "POST",
        body: JSON.stringify({
          projectId: 12,
          title: "Draft section",
          deadline: "2099-06-20T16:59:00.000Z",
          priority: 3,
          status: "Pending",
        }),
      }),
    );
  });

  it("sends deadlines when updating project tasks", async () => {
    await updateProjectTaskApi(
      "proj-task-42",
      { deadline: "2099-08-15T10:30:00.000Z" },
    );

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/project/task/42",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          deadline: "2099-08-15T10:30:00.000Z",
        }),
      }),
    );
  });

  it("sends project deadline updates", async () => {
    await updateProjectApi("project-12", {
      deadline: "2099-07-01T16:59:00.000Z",
      priority: 4,
      project_status: "completed",
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/project/12",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({
          deadline: "2099-07-01T16:59:00.000Z",
          priority: 4,
          project_status: "completed",
        }),
      }),
    );
  });
});
