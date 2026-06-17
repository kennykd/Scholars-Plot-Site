import { POST } from "../../../../app/api/task/route";
import { getSession } from "@/lib/firebase/auth";
import { ensureUserRecordForSession } from "@/lib/services/userService";
import { createTask } from "@/lib/services/taskService";
import { runTaskAnalysis } from "@/lib/services/aiService";
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
    createTask: jest.fn(),
    getTasks: jest.fn(),
    serializeTask: jest.fn((task: { task_id: number; task_name: string }) => ({
      id: task.task_id,
      title: task.task_name,
    })),
    TaskServiceError,
  };
});

jest.mock("@/lib/services/aiService", () => ({
  runTaskAnalysis: jest.fn(),
}));

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockEnsureUserRecordForSession = ensureUserRecordForSession as jest.MockedFunction<typeof ensureUserRecordForSession>;
const mockCreateTask = createTask as jest.MockedFunction<typeof createTask>;
const mockRunTaskAnalysis = runTaskAnalysis as jest.MockedFunction<typeof runTaskAnalysis>;

type GetSessionResolved = Awaited<ReturnType<typeof getSession>>;
type EnsureUserRecordResolved = Awaited<ReturnType<typeof ensureUserRecordForSession>>;
type CreateTaskResolved = Awaited<ReturnType<typeof createTask>>;

function request(body: Record<string, unknown>): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

const validPayload = {
  title: "Physics study",
  deadline: "2099-06-20T16:59:00.000Z",
  status: "Pending",
  priority: 3,
};

describe("POST /api/task", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("ensures the Firebase session user exists before creating a task", async () => {
    mockGetSession.mockResolvedValue({
      id: "uid-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    } as GetSessionResolved);

    mockEnsureUserRecordForSession.mockResolvedValue({
      id: "uid-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    } as EnsureUserRecordResolved);

    mockCreateTask.mockResolvedValue({
      task_id: 42,
      task_name: "Physics study",
      task_deadline: new Date(validPayload.deadline),
      task_priority: 3,
      task_status: "Pending",
      task_created_at: new Date(),
      task_completed_at: null,
      project_id: null,
      task_description: null,
    } as unknown as CreateTaskResolved);

    mockRunTaskAnalysis.mockResolvedValue(undefined);

    const response = await POST(request(validPayload));

    expect(response.status).toBe(201);
    expect(mockEnsureUserRecordForSession).toHaveBeenCalledWith({
      id: "uid-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    });

    expect(
      mockEnsureUserRecordForSession.mock.invocationCallOrder[0],
    ).toBeLessThan(mockCreateTask.mock.invocationCallOrder[0]);

    expect(mockCreateTask).toHaveBeenCalledWith(
      "uid-1",
      expect.objectContaining({ title: "Physics study" }),
    );
  });
});