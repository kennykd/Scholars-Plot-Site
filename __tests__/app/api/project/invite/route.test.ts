import { POST } from "@/app/api/project/invite/route";
import { getSession } from "@/lib/firebase/auth";
import { ensureUserRecordForSession } from "@/lib/services/userService";
import { createProjectInvite } from "@/lib/services/projectService";
import { NextRequest } from "next/server";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init: ResponseInit = {}) => ({
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

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockEnsureUserRecordForSession = ensureUserRecordForSession as jest.MockedFunction<typeof ensureUserRecordForSession>;
const mockCreateProjectInvite = createProjectInvite as jest.MockedFunction<typeof createProjectInvite>;

type GetSessionResolved = Awaited<ReturnType<typeof getSession>>;
type EnsureUserRecordResolved = Awaited<ReturnType<typeof ensureUserRecordForSession>>;
type CreateProjectInviteResolved = Awaited<ReturnType<typeof createProjectInvite>>;

interface ExpectedResponseBody {
  message?: string;
}

function request(body: Record<string, unknown>): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

describe("POST /api/project/invite", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetSession.mockResolvedValue({
      id: "owner-1",
      email: "owner@example.com",
    } as GetSessionResolved);

    mockEnsureUserRecordForSession.mockResolvedValue({
      id: "owner-1",
      email: "owner@example.com",
    } as EnsureUserRecordResolved);

    mockCreateProjectInvite.mockResolvedValue({
      invite_id: 77,
      project_id: 12,
      invited_user: "student-2",
      invited_by: "owner-1",
      status: "pending",
    } as CreateProjectInviteResolved);
  });

  it("accepts projectId and targetUserId invite payloads", async () => {
    const response = await POST(
      request({
        projectId: 12,
        targetUserId: "student-2",
      }),
    );
    const body = await response.json() as ExpectedResponseBody;

    expect(response.status).toBe(201);
    expect(body.message).toBe("Invite sent successfully");
    expect(mockCreateProjectInvite).toHaveBeenCalledWith(12, "owner-1", {
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
    const body = await response.json() as ExpectedResponseBody;

    expect(response.status).toBe(400);
    expect(body.message).toBe("Missing or invalid required fields");
    expect(mockCreateProjectInvite).not.toHaveBeenCalled();
  });

  it("accepts targetUserEmail invite payloads for backwards compatibility", async () => {
    const response = await POST(
      request({
        projectId: "12",
        targetUserEmail: "student2@example.com",
      }),
    );

    expect(response.status).toBe(201);
    expect(mockCreateProjectInvite).toHaveBeenCalledWith(12, "owner-1", {
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
    expect(mockCreateProjectInvite).toHaveBeenCalledWith(12, "owner-1", {
      targetUserId: "student-2",
      targetUserEmail: undefined,
    });
  });
});