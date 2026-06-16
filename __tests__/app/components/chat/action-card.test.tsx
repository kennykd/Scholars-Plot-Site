import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ActionCard } from "@/app/components/chat/action-card";

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

function mockFetch() {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ success: true }),
  })) as jest.Mock;
}

describe("ActionCard", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockFetch();
  });

  it("confirms a task draft through /api/task and patches the saved action status", async () => {
    render(
      <ActionCard
        messageId={11}
        conversationId={7}
        actionType="CREATE_TASK_DRAFT"
        initialStatus="pending"
        payload={{
          title: "Physics lab report",
          description: "Write analysis",
          deadline: "2026-06-20T12:00:00.000Z",
          priority: 4,
          reasoning: "Due soon.",
        }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /apply/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/task",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
    const taskCall = (global.fetch as jest.Mock).mock.calls.find(
      ([url]) => url === "/api/task",
    );
    expect(JSON.parse(taskCall[1].body)).toEqual({
      title: "Physics lab report",
      description: "Write analysis",
      deadline: "2026-06-20T12:00:00.000Z",
      priority: 4,
    });
    expect(global.fetch).toHaveBeenCalledWith("/api/chat/7", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message_id: 11,
        action_status: "confirmed",
      }),
    });
    expect(screen.getAllByText(/done/i).length).toBeGreaterThan(0);
  });

  it("confirms a study-track draft through /api/study/batch", async () => {
    const plans = [
      {
        client_plan_id: "chat-plan-4-0",
        title: "Review circuit diagrams",
        start_date: "2026-06-18",
        repeat_enabled: false,
        repeat_every: 1,
        repeat_unit: "weeks",
        time: "14:00",
        focus_minutes: 25,
        break_minutes: 5,
        total_pomodoros: 2,
        notes: "Work through practice problems.",
        description_as_checklist: true,
      },
    ];

    render(
      <ActionCard
        messageId={12}
        conversationId={7}
        actionType="CREATE_STUDY_TRACK_DRAFT"
        initialStatus="pending"
        payload={{
          task_id: 4,
          task_title: "Circuits exam",
          plans,
          warnings: ["Keep the session short."],
          reasoning: "Fits your availability.",
        }}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /apply/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/study/batch",
        expect.objectContaining({
          method: "POST",
          headers: { "Content-Type": "application/json" },
        }),
      );
    });
    const studyCall = (global.fetch as jest.Mock).mock.calls.find(
      ([url]) => url === "/api/study/batch",
    );
    expect(JSON.parse(studyCall[1].body)).toEqual({
      task_id: 4,
      plans,
    });
  });
});
