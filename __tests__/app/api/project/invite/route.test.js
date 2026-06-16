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

jest.mock("@/lib/services/projectService", () => ({
  getPendingInvitesForUser: jest.fn(),
  createProjectInvite: jest.fn(),
}));

import { POST } from "@/app/api/project/invite/route";
import { getSession } from "@/lib/firebase/auth";
import { ensureUserRecordForSession } from "@/lib/services/userService";
import { createProjectInvite } from "@/lib/services/projectService";

function request(body) {
  return {
    json: async () => body,
  };
}

describe("POST /api/project/invite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSession.mockResolvedValue({
      id: "owner-1",
      email: "owner@example.com",
    });
    ensureUserRecordForSession.mockResolvedValue({
      id: "owner-1",
      email: "owner@example.com",
    });
    createProjectInvite.mockResolvedValue({
      invite_id: 77,
      project_id: 12,
      invited_user: "student-2",
      invited_by: "owner-1",
      status: "pending",
    });
  });

  it("accepts projectId and targetUserId invite payloads", async () => {
    const response = await POST(
      request({
        projectId: 12,
        targetUserId: "student-2",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(body.message).toBe("Invite sent successfully");
    expect(createProjectInvite).toHaveBeenCalledWith(12, "owner-1", {
      targetUserId: "student-2",
      targetUserEmail: undefined,
    });
  });

  it("rejects invite payloads without a target user id or email", async () => {
    const response = await POST(
      request({
        projectId: 12,
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe("Missing or invalid required fields");
    expect(createProjectInvite).not.toHaveBeenCalled();
  });

  it("accepts targetUserEmail invite payloads for backwards compatibility", async () => {
    const response = await POST(
      request({
        projectId: "12",
        targetUserEmail: "student2@example.com",
      }),
    );

    expect(response.status).toBe(201);
    expect(createProjectInvite).toHaveBeenCalledWith(12, "owner-1", {
      targetUserId: undefined,
      targetUserEmail: "student2@example.com",
    });
  });

  it("accepts frontend project id strings", async () => {
    const response = await POST(
      request({
        projectId: "project-12",
        targetUserId: "student-2",
      }),
    );

    expect(response.status).toBe(201);
    expect(createProjectInvite).toHaveBeenCalledWith(12, "owner-1", {
      targetUserId: "student-2",
      targetUserEmail: undefined,
    });
  });
});
