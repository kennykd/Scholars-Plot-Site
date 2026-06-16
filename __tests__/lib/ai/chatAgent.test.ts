import { runChatAgent } from "@/lib/ai/chatAgent";
import { geminiFlash } from "@/lib/gemini";
import {
  generateStudyTrackDraft,
  generateTaskDraft,
} from "@/lib/services/aiService";
import type { ChatContext } from "@/lib/services/chatService";

jest.mock("@/lib/gemini", () => ({
  geminiFlash: {
    generateContent: jest.fn(),
  },
}));

// chatAgent imports FunctionCallingConfigMode (a runtime enum value) directly from
// "@google/genai", whose published entry point is ESM that Jest cannot parse. Mock the
// package so the module graph loads without pulling in the real ESM build.
jest.mock("@google/genai", () => ({
  FunctionCallingConfigMode: { AUTO: "AUTO", ANY: "ANY", NONE: "NONE" },
}));

jest.mock("@/lib/services/aiService", () => ({
  generateTaskDraft: jest.fn(),
  generateStudyTrackDraft: jest.fn(),
}));

const baseContext: ChatContext = {
  meta: {
    current_datetime: "2099-03-20T08:00:00.000+07:00",
    timezone: "Asia/Jakarta",
    day_of_week: "Friday",
  },
  pending_tasks: [
    {
      task_id: 42,
      task_name: "Physics Final",
      task_description: "Mechanics and medical physics",
      task_deadline: "2099-03-31T23:59:00.000Z",
      hours_until_deadline: 280,
      estimated_minutes: 180,
      ai_priority_score: 91,
      grade_weight_percent: 40,
      task_priority: 4,
      task_status: "Pending",
    },
  ],
  availability: [
    {
      day_of_week: 1,
      day_name: "Monday",
      start_time: "15:00",
      end_time: "17:00",
      available_minutes: 120,
    },
  ],
  study_preferences: {
    focus_minutes: 25,
    break_minutes: 5,
    total_pomodoros: 2,
    total_minutes: 60,
  },
  scheduled_sessions: [],
  active_overload_warning: null,
  formula_weights: {
    w_impact: 3,
    w_ease: 2,
    w_urgency: 4,
  },
  behavior_profile: null,
};

describe("runChatAgent", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("returns normal text when Gemini does not call a draft tool", async () => {
    (geminiFlash.generateContent as jest.Mock).mockResolvedValue({
      text: "Focus on Physics Final first.",
      functionCalls: undefined,
    });

    const result = await runChatAgent("What should I do?", [], baseContext);

    expect(result).toEqual({
      text: "Focus on Physics Final first.",
      action: null,
      rawResponse: "Focus on Physics Final first.",
    });
    expect(geminiFlash.generateContent).toHaveBeenCalledWith(
      expect.objectContaining({
        config: expect.objectContaining({
          tools: expect.any(Array),
          toolConfig: expect.objectContaining({
            functionCallingConfig: expect.objectContaining({
              mode: "AUTO",
            }),
          }),
        }),
      }),
    );
    const call = (geminiFlash.generateContent as jest.Mock).mock.calls[0][0];
    expect(call.config.toolConfig.functionCallingConfig).not.toHaveProperty(
      "allowedFunctionNames",
    );
    expect(generateTaskDraft).not.toHaveBeenCalled();
    expect(generateStudyTrackDraft).not.toHaveBeenCalled();
  });

  it("turns a task draft tool call into a pending task draft action", async () => {
    (geminiFlash.generateContent as jest.Mock).mockResolvedValue({
      text: "",
      functionCalls: [
        {
          name: "create_task_draft",
          args: {
            title: "Lab report",
            description: "Finish the lab writeup",
            deadline: "2099-03-28T16:00:00.000Z",
            priority: 4,
          },
        },
      ],
    });
    (generateTaskDraft as jest.Mock).mockResolvedValue({
      title: "Complete lab report",
      description: "Write methods and results.",
      priority: 4,
      reasoning: "The deadline and scope make this high priority.",
      skippedAttachments: [],
    });

    const result = await runChatAgent("Add a lab report task", [], baseContext);

    expect(generateTaskDraft).toHaveBeenCalledWith({
      title: "Lab report",
      description: "Finish the lab writeup",
      deadline: new Date("2099-03-28T16:00:00.000Z"),
      priority: 4,
    });
    expect(result.action).toEqual({
      type: "CREATE_TASK_DRAFT",
      payload: {
        title: "Complete lab report",
        description: "Write methods and results.",
        deadline: "2099-03-28T16:00:00.000Z",
        priority: 4,
        reasoning: "The deadline and scope make this high priority.",
      },
    });
    expect(result.text).toContain("drafted a task");
  });

  it("turns a study draft tool call into a task-linked study track action", async () => {
    (geminiFlash.generateContent as jest.Mock).mockResolvedValue({
      text: "",
      functionCalls: [
        {
          name: "create_study_track_draft",
          args: { task_id: 42 },
        },
      ],
    });
    (generateStudyTrackDraft as jest.Mock).mockResolvedValue({
      tracks: [
        {
          title: "Mechanics review",
          start_date: "2099-03-24",
          repeat_enabled: false,
          repeat_every: 1,
          repeat_unit: "weeks",
          time: "15:00",
          focus_minutes: 25,
          break_minutes: 5,
          total_pomodoros: 2,
          notes: "Practice force diagrams.",
          description_as_checklist: true,
        },
      ],
      warnings: ["Use active recall."],
      reasoning: "The plan fits availability.",
      skippedAttachments: [],
    });

    const result = await runChatAgent("Make a study plan", [], baseContext);

    expect(generateStudyTrackDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        task: expect.objectContaining({
          id: 42,
          title: "Physics Final",
          description: "Mechanics and medical physics",
          priority: 4,
        }),
        preferences: baseContext.study_preferences,
        availability: [
          { day_of_week: 1, start_time: "15:00", end_time: "17:00" },
        ],
        behaviorProfile: null,
        now: expect.any(Date),
      }),
    );
    expect(result.action).toEqual({
      type: "CREATE_STUDY_TRACK_DRAFT",
      payload: {
        task_id: 42,
        task_title: "Physics Final",
        plans: [
          expect.objectContaining({
            client_plan_id: "chat-plan-42-0",
            title: "Mechanics review",
          }),
        ],
        warnings: ["Use active recall."],
        reasoning: "The plan fits availability.",
      },
    });
  });

  it("asks for clarification when a study draft tool call references an unknown task", async () => {
    (geminiFlash.generateContent as jest.Mock).mockResolvedValue({
      text: "",
      functionCalls: [
        {
          name: "create_study_track_draft",
          args: { task_id: 999 },
        },
      ],
    });

    const result = await runChatAgent("Make a study plan", [], baseContext);

    expect(generateStudyTrackDraft).not.toHaveBeenCalled();
    expect(result.action).toBeNull();
    expect(result.text).toContain("which task");
  });
});
