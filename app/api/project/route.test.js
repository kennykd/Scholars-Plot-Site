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
    createProject: jest.fn(),
    getProjects: jest.fn(),
    ProjectServiceError,
  };
});

import { POST } from "./route";
import { getSession } from "@/lib/firebase/auth";
import { ensureUserRecordForSession } from "@/lib/services/userService";
import { createProject } from "@/lib/services/projectService";

function request(body) {
  return {
    json: async () => body,
  };
}

const session = {
  id: "uid-1",
  email: "student@example.com",
  name: "Student",
  image: null,
};

const validPayload = {
  name: "Capstone",
  description: "Research project",
  deadline: "2099-06-20T16:59:00.000Z",
  priority: 3,
  project_status: "active",
  ownerId: "ignored-client-owner",
};

describe("POST /api/project", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureUserRecordForSession.mockResolvedValue(session);
  });

  it("returns 401 when the user is not authenticated", async () => {
    getSession.mockResolvedValue(null);

    const response = await POST(request(validPayload));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.message).toMatch(/not authenticated/i);
    expect(ensureUserRecordForSession).not.toHaveBeenCalled();
    expect(createProject).not.toHaveBeenCalled();
  });

  it("returns 400 when validation fails", async () => {
    getSession.mockResolvedValue(session);

    const response = await POST(request({ name: "" }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toMatch(/validation failed/i);
    expect(ensureUserRecordForSession).not.toHaveBeenCalled();
    expect(createProject).not.toHaveBeenCalled();
  });

  it("ensures the Firebase session user exists before creating a project", async () => {
    getSession.mockResolvedValue(session);
    createProject.mockResolvedValue({
      project_id: 12,
      project_name: "Capstone",
      project_user: [{ user_id: "uid-1", project_user_role: "owner" }],
      tasks: [],
    });

    const response = await POST(request(validPayload));

    expect(response.status).toBe(201);
    expect(ensureUserRecordForSession).toHaveBeenCalledWith(session);
    expect(
      ensureUserRecordForSession.mock.invocationCallOrder[0],
    ).toBeLessThan(createProject.mock.invocationCallOrder[0]);
    expect(createProject).toHaveBeenCalledWith(
      "uid-1",
      expect.objectContaining({ name: "Capstone" }),
    );
  });

  it("returns the account repair message for Prisma foreign key failures", async () => {
    getSession.mockResolvedValue(session);
    createProject.mockRejectedValue({ code: "P2003" });

    const response = await POST(request(validPayload));
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.message).toMatch(/sign out and back in/i);
  });
});
