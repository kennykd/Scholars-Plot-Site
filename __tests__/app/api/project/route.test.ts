import { POST } from "@/app/api/project/route";
import { getSession } from "@/lib/firebase/auth";
import { ensureUserRecordForSession } from "@/lib/services/userService";
import { createProject } from "@/lib/services/projectService";
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

jest.mock("@/lib/services/projectService", () => {
  class ProjectServiceError extends Error {
    status: number;

    constructor(status: number, message: string) {
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

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockEnsureUserRecordForSession = ensureUserRecordForSession as jest.MockedFunction<typeof ensureUserRecordForSession>;
const mockCreateProject = createProject as jest.MockedFunction<typeof createProject>;

type GetSessionResolved = Awaited<ReturnType<typeof getSession>>;
type EnsureUserRecordResolved = Awaited<ReturnType<typeof ensureUserRecordForSession>>;
type CreateProjectResolved = Awaited<ReturnType<typeof createProject>>;

interface ExpectedResponseBody {
  message?: string;
}

function request(body: Record<string, unknown>): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
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
    mockEnsureUserRecordForSession.mockResolvedValue(session as EnsureUserRecordResolved);
  });

  it("returns 401 when the user is not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await POST(request(validPayload));
    const body = await response.json() as ExpectedResponseBody;

    expect(response.status).toBe(401);
    expect(body.message).toMatch(/not authenticated/i);
    expect(mockEnsureUserRecordForSession).not.toHaveBeenCalled();
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  it("returns 400 when validation fails", async () => {
    mockGetSession.mockResolvedValue(session as GetSessionResolved);

    const response = await POST(request({ name: "" }));
    const body = await response.json() as ExpectedResponseBody;

    expect(response.status).toBe(400);
    expect(body.message).toMatch(/validation failed/i);
    expect(mockEnsureUserRecordForSession).not.toHaveBeenCalled();
    expect(mockCreateProject).not.toHaveBeenCalled();
  });

  it("ensures the Firebase session user exists before creating a project", async () => {
    mockGetSession.mockResolvedValue(session as GetSessionResolved);
    mockCreateProject.mockResolvedValue({
      project_id: 12,
      project_name: "Capstone",
      project_user: [{ user_id: "uid-1", project_user_role: "owner" }],
      tasks: [],
    } as unknown as CreateProjectResolved);

    const response = await POST(request(validPayload));

    expect(response.status).toBe(201);
    expect(mockEnsureUserRecordForSession).toHaveBeenCalledWith(session);

    expect(
      mockEnsureUserRecordForSession.mock.invocationCallOrder[0],
    ).toBeLessThan(mockCreateProject.mock.invocationCallOrder[0]);

    expect(mockCreateProject).toHaveBeenCalledWith(
      "uid-1",
      expect.objectContaining({ name: "Capstone" }),
    );
  });

  it("returns the account repair message for Prisma foreign key failures", async () => {
    mockGetSession.mockResolvedValue(session as GetSessionResolved);
    mockCreateProject.mockRejectedValue({ code: "P2003" });

    const response = await POST(request(validPayload));
    const body = await response.json() as ExpectedResponseBody;

    expect(response.status).toBe(409);
    expect(body.message).toMatch(/sign out and back in/i);
  });
});