jest.mock("next/server", () => ({
  NextResponse: {
    json: (body, init = {}) => ({
      status: init.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock("@/lib/firebase/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/services/userService", () => ({
  ensureUserRecordForSession: jest.fn(),
}));

jest.mock("@/lib/services/projectService", () => {
  class ProjectServiceError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
      this.name = "ProjectServiceError";
    }
  }

  return {
    createProjectTask: jest.fn(),
    ProjectServiceError,
  };
});

import { POST } from "@/app/api/project/task/route";
import { getSession } from "@/lib/firebase/auth";
import { ensureUserRecordForSession } from "@/lib/services/userService";
import { createProjectTask } from "@/lib/services/projectService";

function request(body) {
  return {
    json: async () => body,
  };
}

describe("POST /api/project/task", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSession.mockResolvedValue({ id: "owner-1" });
    ensureUserRecordForSession.mockResolvedValue({ id: "owner-1" });
    createProjectTask.mockResolvedValue({
      task_id: 42,
      task_name: "Draft section",
      task_deadline: new Date("2099-06-20T16:59:00.000Z"),
    });
  });

  it("accepts and forwards a project task deadline", async () => {
    const response = await POST(
      request({
        projectId: 12,
        title: "Draft section",
        description: "Write the draft",
        deadline: "2099-06-20T16:59:00.000Z",
        priority: 3,
        status: "Pending",
      }),
    );

    expect(response.status).toBe(201);
    expect(createProjectTask).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({
        deadline: new Date("2099-06-20T16:59:00.000Z"),
      }),
    );
  });
});
