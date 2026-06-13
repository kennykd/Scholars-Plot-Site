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

jest.mock("@/lib/services/studySessionService", () => {
  class StudySessionServiceError extends Error {
    constructor(status, message) {
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
    constructor(status, message) {
      super(message);
      this.status = status;
      this.name = "TaskServiceError";
    }
  }

  return { TaskServiceError };
});

import { POST } from "./route";
import { getSession } from "@/lib/firebase/auth";
import { createStudySessionsForTask } from "@/lib/services/studySessionService";
import { TaskServiceError } from "@/lib/services/taskService";

const validPlan = {
  client_plan_id: "plan-1",
  title: "Mechanical Physics",
  start_date: "2099-03-23",
  repeat: "weekly",
  time: "15:00",
  focus_minutes: 25,
  break_minutes: 5,
  total_pomodoros: 2,
  notes: "Practice force diagrams",
  description_as_checklist: false,
};

function request(body) {
  return {
    json: async () => body,
  };
}

describe("POST /api/study/batch", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns 401 when the user is not authenticated", async () => {
    getSession.mockResolvedValue(null);

    const response = await POST(request({ task_id: 42, plans: [validPlan] }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.message).toMatch(/not authenticated/i);
    expect(createStudySessionsForTask).not.toHaveBeenCalled();
  });

  it("rejects an empty plan list", async () => {
    getSession.mockResolvedValue({ id: "user-1" });

    const response = await POST(request({ task_id: 42, plans: [] }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toMatch(/validation failed/i);
    expect(createStudySessionsForTask).not.toHaveBeenCalled();
  });

  it("returns task access errors from the service", async () => {
    getSession.mockResolvedValue({ id: "user-1" });
    createStudySessionsForTask.mockRejectedValue(
      new TaskServiceError(403, "You do not have access to this task"),
    );

    const response = await POST(request({ task_id: 42, plans: [validPlan] }));
    const body = await response.json();

    expect(response.status).toBe(403);
    expect(body.message).toBe("You do not have access to this task");
  });

  it("creates linked sessions from plan rules for the authenticated user", async () => {
    getSession.mockResolvedValue({ id: "user-1" });
    createStudySessionsForTask.mockResolvedValue({
      studySessions: [
        { study_session_id: 1, study_session_name: "Mechanical Physics" },
      ],
      createdByPlan: { "plan-1": [1] },
    });

    const response = await POST(request({ task_id: 42, plans: [validPlan] }));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(createStudySessionsForTask).toHaveBeenCalledWith(
      "user-1",
      42,
      [
        expect.objectContaining({
          title: "Mechanical Physics",
          start_date: "2099-03-23",
          repeat: "weekly",
        }),
      ],
      { reminderEnabled: false, reminders: [] },
    );
    expect(body.studySessions).toHaveLength(1);
    expect(body.createdByPlan).toEqual({ "plan-1": [1] });
  });

  it("passes batch reminder settings to the study session service", async () => {
    getSession.mockResolvedValue({ id: "user-1" });
    createStudySessionsForTask.mockResolvedValue({
      studySessions: [
        { study_session_id: 1, study_session_name: "Mechanical Physics" },
      ],
      createdByPlan: { "plan-1": [1] },
    });

    const response = await POST(
      request({
        task_id: 42,
        plans: [validPlan],
        reminder_enabled: true,
        reminders: [15, 5, 0],
      }),
    );

    expect(response.status).toBe(201);
    expect(createStudySessionsForTask).toHaveBeenCalledWith(
      "user-1",
      42,
      [expect.objectContaining({ repeat: "weekly" })],
      { reminderEnabled: true, reminders: [15, 5, 0] },
    );
  });
});
