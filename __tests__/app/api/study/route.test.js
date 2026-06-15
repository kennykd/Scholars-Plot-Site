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

jest.mock("@/lib/services/studySessionService", () => ({
  getStudySessionsForUser: jest.fn(),
  createStudySessionForUser: jest.fn(),
  StudySessionServiceError: class StudySessionServiceError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  },
}));

import { POST } from "@/app/api/study/route";
import { getSession } from "@/lib/firebase/auth";
import { ensureUserRecordForSession } from "@/lib/services/userService";
import { createStudySessionForUser } from "@/lib/services/studySessionService";

function request(body) {
  return {
    json: async () => body,
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
    getSession.mockResolvedValue({
      id: "uid-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    });
    ensureUserRecordForSession.mockResolvedValue({
      id: "uid-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    });
    createStudySessionForUser.mockResolvedValue({
      studySession: { study_session_id: 7, study_session_name: "Biology review" },
      sessionIds: [7],
    });

    const response = await POST(request(validPayload));

    expect(response.status).toBe(201);
    expect(ensureUserRecordForSession).toHaveBeenCalledWith({
      id: "uid-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    });
    expect(
      ensureUserRecordForSession.mock.invocationCallOrder[0],
    ).toBeLessThan(createStudySessionForUser.mock.invocationCallOrder[0]);
    expect(createStudySessionForUser).toHaveBeenCalledWith(
      "uid-1",
      expect.objectContaining({ study_session_name: "Biology review" }),
    );
  });

  it("creates a standalone study session that is not linked to a task", async () => {
    getSession.mockResolvedValue({
      id: "uid-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    });
    ensureUserRecordForSession.mockResolvedValue({ id: "uid-1" });
    createStudySessionForUser.mockResolvedValue({
      studySession: { study_session_id: 8 },
      sessionIds: [8],
    });

    const response = await POST(request({ ...validPayload, task_id: null }));

    expect(response.status).toBe(201);
    expect(createStudySessionForUser).toHaveBeenCalledWith(
      "uid-1",
      expect.objectContaining({ task_id: null }),
    );
  });

  it("rejects repeat creation when no task is linked", async () => {
    getSession.mockResolvedValue({
      id: "uid-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    });

    const response = await POST(request({
      ...validPayload,
      task_id: null,
      repeat_enabled: true,
      repeat_every: 1,
      repeat_unit: "weeks",
    }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.errors.task_id).toContain(
      "Choose a task before repeating a study session",
    );
    expect(createStudySessionForUser).not.toHaveBeenCalled();
  });

  it("passes task-linked repeat fields through to the service", async () => {
    getSession.mockResolvedValue({
      id: "uid-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    });
    ensureUserRecordForSession.mockResolvedValue({ id: "uid-1" });
    createStudySessionForUser.mockResolvedValue({
      studySession: { study_session_id: 9 },
      sessionIds: [9],
    });

    const response = await POST(request({
      ...validPayload,
      task_id: 42,
      repeat_enabled: true,
      repeat_every: 2,
      repeat_unit: "weeks",
    }));

    expect(response.status).toBe(201);
    expect(createStudySessionForUser).toHaveBeenCalledWith(
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
