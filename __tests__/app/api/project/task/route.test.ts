import { POST } from "@/app/api/project/task/route";
import { getSession } from "@/lib/firebase/auth";
import { ensureUserRecordForSession } from "@/lib/services/userService";
import { createProjectTask } from "@/lib/services/projectService";
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
    createProjectTask: jest.fn(),
    ProjectServiceError,
  };
});

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockEnsureUserRecordForSession = ensureUserRecordForSession as jest.MockedFunction<typeof ensureUserRecordForSession>;
const mockCreateProjectTask = createProjectTask as jest.MockedFunction<typeof createProjectTask>;

type GetSessionResolved = Awaited<ReturnType<typeof getSession>>;
type EnsureUserRecordResolved = Awaited<ReturnType<typeof ensureUserRecordForSession>>;
type CreateProjectTaskResolved = Awaited<ReturnType<typeof createProjectTask>>;

function request(body: Record<string, unknown>): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

describe("POST /api/project/task", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetSession.mockResolvedValue({ id: "owner-1" } as GetSessionResolved);
    mockEnsureUserRecordForSession.mockResolvedValue({ id: "owner-1" } as EnsureUserRecordResolved);

    mockCreateProjectTask.mockResolvedValue({
      task_id: 42,
      task_name: "Draft section",
      task_deadline: new Date("2099-06-20T16:59:00.000Z"),
    } as CreateProjectTaskResolved);
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
    expect(mockCreateProjectTask).toHaveBeenCalledWith(
      "owner-1",
      expect.objectContaining({
        deadline: new Date("2099-06-20T16:59:00.000Z"),
      }),
    );
  });
});