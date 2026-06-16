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

jest.mock("@/lib/services/prismaErrors", () => ({
  foreignKeyRepairMessage: jest.fn(() => "Repair your account"),
  isPrismaForeignKeyError: jest.fn((error) => error?.code === "P2003"),
}));

jest.mock("@/lib/services/aiService", () => ({
  runWeightAdapter: jest.fn(() => Promise.resolve()),
}));

jest.mock("@/lib/services/taskService", () => {
  class TaskServiceError extends Error {
    constructor(status, message) {
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

import { PATCH } from "@/app/api/task/[id]/route";
import { getSession } from "@/lib/firebase/auth";
import { runWeightAdapter } from "@/lib/services/aiService";
import { ensureUserRecordForSession } from "@/lib/services/userService";
import {
  updateTaskById,
  recordTaskCompletion,
} from "@/lib/services/taskService";

function request(body) {
  return { json: async () => body };
}

function context(id = "42") {
  return { params: Promise.resolve({ id }) };
}

describe("PATCH /api/task/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSession.mockResolvedValue({ id: "user-1" });
    ensureUserRecordForSession.mockResolvedValue({ id: "user-1" });
    runWeightAdapter.mockReturnValue(Promise.resolve());
  });

  it("does NOT run completion side-effects when the task did not transition to Completed", async () => {
    updateTaskById.mockResolvedValue({
      task: { task_id: 42 },
      becameCompleted: false,
    });

    const response = await PATCH(request({ title: "New name" }), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateTaskById).toHaveBeenCalledWith(42, "user-1", {
      title: "New name",
    });
    expect(recordTaskCompletion).not.toHaveBeenCalled();
    expect(runWeightAdapter).not.toHaveBeenCalled();
    expect(body.task).toEqual({ task_id: 42 });
  });

  it("ensures the Firebase session user exists before updating a task", async () => {
    updateTaskById.mockResolvedValue({
      task: { task_id: 42 },
      becameCompleted: false,
    });

    const response = await PATCH(request({ status: "In_Progress" }), context());

    expect(response.status).toBe(200);
    expect(ensureUserRecordForSession).toHaveBeenCalledWith({ id: "user-1" });
    expect(
      ensureUserRecordForSession.mock.invocationCallOrder[0],
    ).toBeLessThan(updateTaskById.mock.invocationCallOrder[0]);
  });

  it("returns the account repair message for Prisma foreign key failures", async () => {
    updateTaskById.mockRejectedValue({ code: "P2003" });

    const response = await PATCH(request({ status: "Completed" }), context());
    const body = await response.json();

    expect(response.status).toBe(409);
    expect(body.message).toBe("Repair your account");
  });

  it("preserves a non-completed status on update (regression: no force-complete)", async () => {
    updateTaskById.mockResolvedValue({
      task: { task_id: 42, task_status: "In_Progress" },
      becameCompleted: false,
    });

    const response = await PATCH(
      request({ status: "In_Progress" }),
      context(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateTaskById).toHaveBeenCalledWith(42, "user-1", {
      status: "In_Progress",
    });
    expect(recordTaskCompletion).not.toHaveBeenCalled();
    expect(body.task.task_status).toBe("In_Progress");
  });

  it("runs completion side-effects only when the task transitions to Completed", async () => {
    updateTaskById.mockResolvedValue({
      task: { task_id: 42 },
      becameCompleted: true,
    });
    recordTaskCompletion.mockResolvedValue(false);

    const response = await PATCH(request({ status: "Completed" }), context());

    expect(response.status).toBe(200);
    expect(recordTaskCompletion).toHaveBeenCalledWith("user-1");
    expect(runWeightAdapter).not.toHaveBeenCalled();
  });

  it("triggers the weight adapter when completion reports it should adapt", async () => {
    updateTaskById.mockResolvedValue({
      task: { task_id: 42 },
      becameCompleted: true,
    });
    recordTaskCompletion.mockResolvedValue(true);

    await PATCH(request({ status: "Completed" }), context());

    expect(runWeightAdapter).toHaveBeenCalledWith("user-1");
  });
});
