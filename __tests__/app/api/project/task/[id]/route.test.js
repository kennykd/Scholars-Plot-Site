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
    deleteProjectTaskById: jest.fn(),
    updateProjectTaskById: jest.fn(),
    ProjectServiceError,
  };
});

import { PATCH } from "@/app/api/project/task/[id]/route";
import { getSession } from "@/lib/firebase/auth";
import { ensureUserRecordForSession } from "@/lib/services/userService";
import { updateProjectTaskById } from "@/lib/services/projectService";

function request(body) {
  return {
    json: async () => body,
  };
}

function context(id = "42") {
  return {
    params: Promise.resolve({ id }),
  };
}

describe("PATCH /api/project/task/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSession.mockResolvedValue({ id: "owner-1" });
    ensureUserRecordForSession.mockResolvedValue({ id: "owner-1" });
    updateProjectTaskById.mockResolvedValue({
      task_id: 42,
      task_name: "Updated draft",
      task_deadline: new Date("2099-08-15T10:30:00.000Z"),
    });
  });

  it("accepts and forwards a project task deadline update", async () => {
    const response = await PATCH(
      request({
        title: "Updated draft",
        deadline: "2099-08-15T10:30:00.000Z",
      }),
      context(),
    );

    expect(response.status).toBe(200);
    expect(updateProjectTaskById).toHaveBeenCalledWith(
      42,
      "owner-1",
      expect.objectContaining({
        title: "Updated draft",
        deadline: new Date("2099-08-15T10:30:00.000Z"),
      }),
    );
  });
});
