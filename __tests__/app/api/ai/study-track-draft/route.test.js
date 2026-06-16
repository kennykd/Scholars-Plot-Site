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

jest.mock("@/lib/services/taskService", () => ({
  getTaskById: jest.fn(),
  TaskServiceError: class TaskServiceError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  },
}));

jest.mock("@/lib/services/scheduleService", () => ({
  getUserAvailability: jest.fn(),
  getUserBehaviorProfile: jest.fn(),
  getUserStudyPreferences: jest.fn(),
}));

jest.mock("@/lib/services/attachmentService", () => ({
  AttachmentServiceError: class AttachmentServiceError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  },
  listTaskAttachments: jest.fn(),
}));

jest.mock("@/lib/services/aiService", () => {
  class AiDraftServiceError extends Error {
    constructor(code, message) {
      super(message);
      this.name = "AiDraftServiceError";
      this.code = code;
    }
  }

  return {
    AI_DRAFT_ERROR_MESSAGES: {
      PROMPT_INJECTION_DETECTED:
        "AI suggestions were blocked because the task text or attachment appears to contain instructions that try to override the AI rules. Please remove those instructions and try again.",
      AI_TIMEOUT:
        "AI suggestions took too long to generate. Try again with fewer or smaller attachments.",
    },
    AiDraftServiceError,
    generateStudyTrackDraft: jest.fn(),
  };
});

import { POST } from "@/app/api/ai/study-track-draft/route";
import { getSession } from "@/lib/firebase/auth";
import { getTaskById } from "@/lib/services/taskService";
import {
  getUserAvailability,
  getUserBehaviorProfile,
  getUserStudyPreferences,
} from "@/lib/services/scheduleService";
import { listTaskAttachments } from "@/lib/services/attachmentService";
import {
  AI_DRAFT_ERROR_MESSAGES,
  AiDraftServiceError,
  generateStudyTrackDraft,
} from "@/lib/services/aiService";

function jsonRequest(body) {
  return {
    json: async () => body,
  };
}

describe("POST /api/ai/study-track-draft", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSession.mockResolvedValue({ id: "user-1", email: "student@example.com" });
    getTaskById.mockResolvedValue({
      task_id: 42,
      task_name: "Physics Final",
      task_description: "Mechanics and medical physics",
      task_deadline: new Date("2099-03-31T23:59:00.000Z"),
      task_priority: 4,
    });
    getUserStudyPreferences.mockResolvedValue({
      focus_minutes: 25,
      break_minutes: 5,
      total_pomodoros: 2,
      total_minutes: 60,
    });
    getUserAvailability.mockResolvedValue([
      { day_of_week: 1, start_time: "15:00", end_time: "17:00" },
    ]);
    getUserBehaviorProfile.mockResolvedValue(null);
    listTaskAttachments.mockResolvedValue([
      {
        fileName: "rubric.pdf",
        fileType: "application/pdf",
        url: "https://signed.example/rubric.pdf",
      },
    ]);
    generateStudyTrackDraft.mockResolvedValue({
      tracks: [
        {
          title: "Mechanics review",
          start_date: "2099-03-22",
          repeat_enabled: false,
          repeat_every: 1,
          repeat_unit: "weeks",
          time: "16:00",
          focus_minutes: 25,
          break_minutes: 5,
          total_pomodoros: 2,
          notes: "Review force diagrams.",
          description_as_checklist: true,
        },
      ],
      warnings: [],
      reasoning: "The session is before the deadline.",
      skippedAttachments: [],
    });
  });

  it("asks Gemini for a task-linked study track draft", async () => {
    const response = await POST(jsonRequest({
      taskId: 42,
      title: "Single mechanics review",
      notes: "Focus on force diagrams",
      scheduledDate: "2099-03-22",
      scheduledTime: "16:00",
      focusMinutes: 30,
      breakMinutes: 10,
      totalPomodoro: 2,
      descriptionAsChecklist: true,
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(generateStudyTrackDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        task: expect.objectContaining({
          id: 42,
          title: "Physics Final",
          priority: 4,
        }),
        session: expect.objectContaining({
          title: "Single mechanics review",
          notes: "Focus on force diagrams",
          scheduled_date: "2099-03-22",
          scheduled_time: "16:00",
          focus_minutes: 30,
          break_minutes: 10,
          total_pomodoros: 2,
          description_as_checklist: true,
        }),
        attachments: [
          expect.objectContaining({
            fileName: "rubric.pdf",
            url: "https://signed.example/rubric.pdf",
          }),
        ],
        now: expect.any(Date),
      }),
    );
    expect(body.draft.tracks[0]).toEqual(
      expect.objectContaining({ title: "Mechanics review" }),
    );
  });

  it("asks Gemini for a standalone study-session draft without taskId", async () => {
    const response = await POST(jsonRequest({
      title: "Independent calculus review",
      notes: "Practice derivatives and integrals",
      scheduledDate: "2099-03-24",
      scheduledTime: "10:30",
      focusMinutes: 40,
      breakMinutes: 10,
      totalPomodoro: 3,
      descriptionAsChecklist: false,
    }));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getTaskById).not.toHaveBeenCalled();
    expect(listTaskAttachments).not.toHaveBeenCalled();
    expect(generateStudyTrackDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        task: null,
        session: expect.objectContaining({
          title: "Independent calculus review",
          notes: "Practice derivatives and integrals",
          scheduled_date: "2099-03-24",
          scheduled_time: "10:30",
          focus_minutes: 40,
          break_minutes: 10,
          total_pomodoros: 3,
          description_as_checklist: false,
        }),
        attachments: [],
        now: expect.any(Date),
      }),
    );
    expect(body.draft.tracks[0]).toEqual(
      expect.objectContaining({ title: "Mechanics review" }),
    );
  });

  it("propagates prompt-injection safety errors as JSON", async () => {
    generateStudyTrackDraft.mockRejectedValue(
      new AiDraftServiceError(
        "PROMPT_INJECTION_DETECTED",
        AI_DRAFT_ERROR_MESSAGES.PROMPT_INJECTION_DETECTED,
      ),
    );

    const response = await POST(jsonRequest({ taskId: 42 }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({
      code: "PROMPT_INJECTION_DETECTED",
      message: AI_DRAFT_ERROR_MESSAGES.PROMPT_INJECTION_DETECTED,
    });
  });

  it("propagates Gemini timeout errors as JSON", async () => {
    generateStudyTrackDraft.mockRejectedValue(
      new AiDraftServiceError("AI_TIMEOUT", AI_DRAFT_ERROR_MESSAGES.AI_TIMEOUT),
    );

    const response = await POST(jsonRequest({ taskId: 42 }));
    const body = await response.json();

    expect(response.status).toBe(504);
    expect(body).toEqual({
      code: "AI_TIMEOUT",
      message: AI_DRAFT_ERROR_MESSAGES.AI_TIMEOUT,
    });
  });
});
