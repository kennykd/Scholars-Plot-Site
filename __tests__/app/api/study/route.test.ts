import { POST } from "@/app/api/study/route";
import { getSession } from "@/lib/firebase/auth";
import { ensureUserRecordForSession } from "@/lib/services/userService";
import { createStudySessionForUser } from "@/lib/services/studySessionService";
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
    }
  }

  return {
    getStudySessionsForUser: jest.fn(),
    createStudySessionForUser: jest.fn(),
    StudySessionServiceError,
  };
});

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockEnsureUserRecordForSession = ensureUserRecordForSession as jest.MockedFunction<typeof ensureUserRecordForSession>;
const mockCreateStudySessionForUser = createStudySessionForUser as jest.MockedFunction<typeof createStudySessionForUser>;

type GetSessionResolved = Awaited<ReturnType<typeof getSession>>;
type EnsureUserRecordResolved = Awaited<ReturnType<typeof ensureUserRecordForSession>>;
type CreateStudySessionResolved = Awaited<ReturnType<typeof createStudySessionForUser>>;

function request(body: Record<string, unknown>): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

interface ValidationErrorBody {
  errors: {
    task_id?: string[];
  };
}

const validPayload = {
  study_session_name: "Biology review",
  study_session_description: "Chapter 6",
  focus_minutes: 25,
  break_minutes: 5,
  total_pomodoros: 2,
  total_minutes: 60,
  checklist_json: null,
  reminder_enabled: true,
  reminders: [15, 5, 0],
  study_session_scheduled_at: "2099-06-20T15:00:00.000Z",
};

describe("POST /api/study", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("ensures the Firebase session user exists before creating a study session", async () => {
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

    mockCreateStudySessionForUser.mockResolvedValue({
      studySession: { study_session_id: 7, study_session_name: "Biology review" },
      sessionIds: [7],
    } as CreateStudySessionResolved);

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
    ).toBeLessThan(mockCreateStudySessionForUser.mock.invocationCallOrder[0]);

    expect(mockCreateStudySessionForUser).toHaveBeenCalledWith(
      "uid-1",
      expect.objectContaining({ study_session_name: "Biology review" }),
    );
  });

  it("creates a standalone study session that is not linked to a task", async () => {
    mockGetSession.mockResolvedValue({
      id: "uid-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    } as GetSessionResolved);

    mockEnsureUserRecordForSession.mockResolvedValue({ id: "uid-1" } as EnsureUserRecordResolved);

    mockCreateStudySessionForUser.mockResolvedValue({
      studySession: { study_session_id: 8 },
      sessionIds: [8],
    } as CreateStudySessionResolved);

    const response = await POST(request({ ...validPayload, task_id: null }));

    expect(response.status).toBe(201);
    expect(mockCreateStudySessionForUser).toHaveBeenCalledWith(
      "uid-1",
      expect.objectContaining({ task_id: null }),
    );
  });

  it("rejects repeat creation when no task is linked", async () => {
    mockGetSession.mockResolvedValue({
      id: "uid-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    } as GetSessionResolved);

    const response = await POST(request({
      ...validPayload,
      task_id: null,
      repeat_enabled: true,
      repeat_every: 1,
      repeat_unit: "weeks",
    }));
    const body = await response.json() as ValidationErrorBody;

    expect(response.status).toBe(400);
    expect(body.errors.task_id).toContain(
      "Choose a task before repeating a study session",
    );
    expect(mockCreateStudySessionForUser).not.toHaveBeenCalled();
  });

  it("passes task-linked repeat fields through to the service", async () => {
    mockGetSession.mockResolvedValue({
      id: "uid-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    } as GetSessionResolved);

    mockEnsureUserRecordForSession.mockResolvedValue({ id: "uid-1" } as EnsureUserRecordResolved);

    mockCreateStudySessionForUser.mockResolvedValue({
      studySession: { study_session_id: 9 },
      sessionIds: [9],
    } as CreateStudySessionResolved);

    const response = await POST(request({
      ...validPayload,
      task_id: 42,
      repeat_enabled: true,
      repeat_every: 2,
      repeat_unit: "weeks",
    }));

    expect(response.status).toBe(201);
    expect(mockCreateStudySessionForUser).toHaveBeenCalledWith(
      "uid-1",
      expect.objectContaining({
        task_id: 42,
        repeat_enabled: true,
        repeat_every: 2,
        repeat_unit: "weeks",
      }),
    );
  });
});