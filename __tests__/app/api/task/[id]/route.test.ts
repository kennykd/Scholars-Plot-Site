import { PATCH } from "@/app/api/task/[id]/route";
import { getSession } from "@/lib/firebase/auth";
import { runWeightAdapter } from "@/lib/services/aiService";
import { ensureUserRecordForSession } from "@/lib/services/userService";
import {
  updateTaskById,
  recordTaskCompletion,
} from "@/lib/services/taskService";
import { NextRequest } from "next/server";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init: { status?: number } = {}) => ({
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

jest.mock("@/lib/services/prismaErrors", () => ({
  foreignKeyRepairMessage: jest.fn(() => "Repair your account"),
  isPrismaForeignKeyError: jest.fn(
    (error: { code?: string }) => error?.code === "P2003",
  ),
}));

jest.mock("@/lib/services/aiService", () => ({
  runWeightAdapter: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/lib/services/taskService", () => {
  class TaskServiceError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = "TaskServiceError";
    }
  }

  return {
    TaskServiceError,
    updateTaskById: jest.fn(),
    recordTaskCompletion: jest.fn(),
    serializeTask: jest.fn((task) => task),
    getTaskById: jest.fn(),
    deleteTaskById: jest.fn(),
  };
});

// Use explicitly typed Jest mock references
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockRunWeightAdapter = runWeightAdapter as jest.MockedFunction<typeof runWeightAdapter>;
const mockEnsureUserRecordForSession = ensureUserRecordForSession as jest.MockedFunction<typeof ensureUserRecordForSession>;
const mockUpdateTaskById = updateTaskById as jest.MockedFunction<typeof updateTaskById>;

// 1. Type the request helper properly using Partial<NextRequest>
function createMockRequest(body: unknown): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

// 2. Extract and type the context parameter matching Next.js App Router route signatures
interface RouteContext {
  params: Promise<{ id: string }>;
}

function createMockContext(id = "42"): RouteContext {
  return {
    params: Promise.resolve({ id }),
  };
}

describe("PATCH /api/task/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    // 3. Cast internal return mock values cleanly without naked 'as any'
    mockGetSession.mockResolvedValue({ id: "user-1" } as ReturnType<typeof getSession> extends Promise<infer U> ? U : never);
    mockEnsureUserRecordForSession.mockResolvedValue({ id: "user-1" } as ReturnType<typeof ensureUserRecordForSession> extends Promise<infer U> ? U : never);

    // If runWeightAdapter returns void/Promise<void>, we don't need a cast
    mockRunWeightAdapter.mockResolvedValue(undefined as never);
  });

  it("does NOT run completion side-effects when the task did not transition to Completed", async () => {
    // 4. Extract the exact return type structure required by your actual updateTaskById function
    mockUpdateTaskById.mockResolvedValue({
      task: { task_id: 42 },
      becameCompleted: false,
    } as ReturnType<typeof updateTaskById> extends Promise<infer U> ? U : never);

    const response = await PATCH(
      createMockRequest({ title: "New name" }),
      createMockContext(),
    );

    // Explicitly casting response json output to expected structure 
    const body = (await response.json()) as { task: { task_id: number } };

    expect(response.status).toBe(200);

    expect(mockUpdateTaskById).toHaveBeenCalledWith(42, "user-1", {
      title: "New name",
    });

    expect(recordTaskCompletion).not.toHaveBeenCalled();
    expect(mockRunWeightAdapter).not.toHaveBeenCalled();

    expect(body.task).toEqual({ task_id: 42 });
  });
});