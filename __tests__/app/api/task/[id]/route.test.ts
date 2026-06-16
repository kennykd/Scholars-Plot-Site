import { PATCH } from "@/app/api/task/[id]/route";
import { getSession } from "@/lib/firebase/auth";
import { runWeightAdapter } from "@/lib/services/aiService";
import { ensureUserRecordForSession } from "@/lib/services/userService";
import {
  updateTaskById,
  recordTaskCompletion,
} from "@/lib/services/taskService";

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

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockRunWeightAdapter =
  runWeightAdapter as jest.MockedFunction<typeof runWeightAdapter>;
const mockEnsureUserRecordForSession =
  ensureUserRecordForSession as jest.MockedFunction<
    typeof ensureUserRecordForSession
  >;
const mockUpdateTaskById =
  updateTaskById as jest.MockedFunction<typeof updateTaskById>;
const mockRecordTaskCompletion =
  recordTaskCompletion as jest.MockedFunction<typeof recordTaskCompletion>;

function request(body: unknown) {
  return {
    json: async () => body,
  };
}

function context(id = "42") {
  return {
    params: Promise.resolve({ id }),
  };
}

describe("PATCH /api/task/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetSession.mockResolvedValue({ id: "user-1" } as any);
    mockEnsureUserRecordForSession.mockResolvedValue({ id: "user-1" } as any);

    mockRunWeightAdapter.mockResolvedValue({} as any);
  });

  it("does NOT run completion side-effects when the task did not transition to Completed", async () => {
    mockUpdateTaskById.mockResolvedValue({
      task: { task_id: 42 },
      becameCompleted: false,
    } as any);

    const response = await PATCH(
      request({ title: "New name" }) as any,
      context() as any,
    );

    const body = await response.json();

    expect(response.status).toBe(200);

    expect(mockUpdateTaskById).toHaveBeenCalledWith(42, "user-1", {
      title: "New name",
    });

    expect(mockRecordTaskCompletion).not.toHaveBeenCalled();
    expect(mockRunWeightAdapter).not.toHaveBeenCalled();

    expect(body.task).toEqual({ task_id: 42 });
  });
});