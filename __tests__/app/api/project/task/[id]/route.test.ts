import { PATCH } from "@/app/api/project/task/[id]/route";
import { getSession } from "@/lib/firebase/auth";
import { ensureUserRecordForSession } from "@/lib/services/userService";
import { updateProjectTaskById } from "@/lib/services/projectService";
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
    deleteProjectTaskById: jest.fn(),
    updateProjectTaskById: jest.fn(),
    ProjectServiceError,
  };
});

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockEnsureUserRecordForSession = ensureUserRecordForSession as jest.MockedFunction<typeof ensureUserRecordForSession>;
const mockUpdateProjectTaskById = updateProjectTaskById as jest.MockedFunction<typeof updateProjectTaskById>;

type GetSessionResolved = Awaited<ReturnType<typeof getSession>>;
type EnsureUserRecordResolved = Awaited<ReturnType<typeof ensureUserRecordForSession>>;
type UpdateProjectTaskResolved = Awaited<ReturnType<typeof updateProjectTaskById>>;

function request(body: Record<string, unknown>): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

function context(id = "42"): RouteContext {
  return {
    params: Promise.resolve({ id }),
  };
}

describe("PATCH /api/project/task/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetSession.mockResolvedValue({ id: "owner-1" } as GetSessionResolved);
    mockEnsureUserRecordForSession.mockResolvedValue({ id: "owner-1" } as EnsureUserRecordResolved);

    mockUpdateProjectTaskById.mockResolvedValue({
      task_id: 42,
      task_name: "Updated draft",
      task_deadline: new Date("2099-08-15T10:30:00.000Z"),
    } as UpdateProjectTaskResolved);
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
    expect(mockUpdateProjectTaskById).toHaveBeenCalledWith(
      42,
      "owner-1",
      expect.objectContaining({
        title: "Updated draft",
        deadline: new Date("2099-08-15T10:30:00.000Z"),
      }),
    );
  });
});