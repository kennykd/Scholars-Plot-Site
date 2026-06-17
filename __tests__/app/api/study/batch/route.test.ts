import { POST } from "@/app/api/study/batch/route";
import { getSession } from "@/lib/firebase/auth";
import { ensureUserRecordForSession } from "@/lib/services/userService";
import { createStudySessionsForTask } from "@/lib/services/studySessionService";
import { TaskServiceError } from "@/lib/services/taskService";
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

jest.mock("@/lib/services/studySessionService", () => {
  class StudySessionServiceError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = "StudySessionServiceError";
    }
  }

  return {
    createStudySessionsForTask: jest.fn(),
    StudySessionServiceError,
  };
});

jest.mock("@/lib/services/taskService", () => {
  class TaskServiceError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
      this.name = "TaskServiceError";
    }
  }

  return { TaskServiceError };
});

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockEnsureUserRecordForSession = ensureUserRecordForSession as jest.MockedFunction<typeof ensureUserRecordForSession>;
const mockCreateStudySessionsForTask = createStudySessionsForTask as jest.MockedFunction<typeof createStudySessionsForTask>;

type GetSessionResolved = Awaited<ReturnType<typeof getSession>>;
type EnsureUserRecordResolved = Awaited<ReturnType<typeof ensureUserRecordForSession>>;
type CreateStudySessionsResolved = Awaited<ReturnType<typeof createStudySessionsForTask>>;

interface StandardResponse {
  message?: string;
  studySessions?: Array<{ study_session_id: number; study_session_name: string }>;
  createdByPlan?: Record<string, number[]>;
}

const validPlan = {
  client_plan_id: "plan-1",
  title: "Mechanical Physics",
  start_date: "2099-03-23",
  repeat_enabled: true,
  repeat_every: 1,
  repeat_unit: "weeks",
  time: "15:00",
  focus_minutes: 25,
  break_minutes: 5,
  total_pomodoros: 2,
  notes: "Practice force diagrams",
  description_as_checklist: false,
};

function request(body: Record<string, unknown>): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

describe("POST /api/study/batch", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockEnsureUserRecordForSession.mockResolvedValue({
      id: "user-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    } as EnsureUserRecordResolved);
  });

  it("returns 401 when the user is not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await POST(request({ task_id: 42, plans: [validPlan] }));
    const body = await response.json() as StandardResponse;

    expect(response.status).toBe(401);
    expect(body.message).toMatch(/not authenticated/i);
    expect(mockCreateStudySessionsForTask).not.toHaveBeenCalled();
  });

  it("rejects an empty plan list", async () => {
    mockGetSession.mockResolvedValue({ id: "user-1" } as GetSessionResolved);

    const response = await POST(request({ task_id: 42, plans: [] }));
    const body = await response.json() as StandardResponse;

    expect(response.status).toBe(400);
    expect(body.message).toMatch(/validation failed/i);
    expect(mockCreateStudySessionsForTask).not.toHaveBeenCalled();
  });

  it("returns task access errors from the service", async () => {
    mockGetSession.mockResolvedValue({
      id: "user-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    } as GetSessionResolved);

    mockCreateStudySessionsForTask.mockRejectedValue(
      new TaskServiceError(403, "You do not have access to this task"),
    );

    const response = await POST(request({ task_id: 42, plans: [validPlan] }));
    const body = await response.json() as StandardResponse;

    expect(response.status).toBe(403);
    expect(body.message).toBe("You do not have access to this task");
  });

  it("creates linked sessions from plan rules for the authenticated user", async () => {
    mockGetSession.mockResolvedValue({
      id: "user-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    } as GetSessionResolved);

    mockCreateStudySessionsForTask.mockResolvedValue({
      studySessions: [
        { study_session_id: 1, study_session_name: "Mechanical Physics" },
      ],
      createdByPlan: { "plan-1": [1] },
    } as unknown as CreateStudySessionsResolved);

    const response = await POST(request({ task_id: 42, plans: [validPlan] }));
    const body = await response.json() as StandardResponse;

    expect(response.status).toBe(201);
    expect(mockEnsureUserRecordForSession).toHaveBeenCalledWith({
      id: "user-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    });

    expect(
      mockEnsureUserRecordForSession.mock.invocationCallOrder[0],
    ).toBeLessThan(mockCreateStudySessionsForTask.mock.invocationCallOrder[0]);

    expect(mockCreateStudySessionsForTask).toHaveBeenCalledWith(
      "user-1",
      42,
      [
        expect.objectContaining({
          title: "Mechanical Physics",
          start_date: "2099-03-23",
          repeat_enabled: true,
          repeat_every: 1,
          repeat_unit: "weeks",
        }),
      ],
      { reminderEnabled: false, reminders: [] },
    );
    expect(body.studySessions).toHaveLength(1);
    expect(body.createdByPlan).toEqual({ "plan-1": [1] });
  });

  it("passes batch reminder settings to the study session service", async () => {
    mockGetSession.mockResolvedValue({
      id: "user-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    } as GetSessionResolved);

    mockCreateStudySessionsForTask.mockResolvedValue({
      studySessions: [
        { study_session_id: 1, study_session_name: "Mechanical Physics" },
      ],
      createdByPlan: { "plan-1": [1] },
    } as unknown as CreateStudySessionsResolved);

    const response = await POST(
      request({
        task_id: 42,
        plans: [validPlan],
        reminder_enabled: true,
        reminders: [15, 5, 0],
      }),
    );

    expect(response.status).toBe(201);
    expect(mockCreateStudySessionsForTask).toHaveBeenCalledWith(
      "user-1",
      42,
      [expect.objectContaining({ repeat_enabled: true, repeat_every: 1, repeat_unit: "weeks" })],
      { reminderEnabled: true, reminders: [15, 5, 0] },
    );
  });
});