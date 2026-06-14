import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import StudyNewPage from "./page";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

let mockSearchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
  useSearchParams: jest.fn(() => mockSearchParams),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }) => (
    <button
      type="button"
      onClick={() => onSelect?.(new Date("2099-03-20T00:00:00.000Z"))}
    >
      Select date
    </button>
  ),
}));

describe("StudyNewPage", () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    mockSearchParams = new URLSearchParams();
    localStorage.clear();
    useRouter.mockReturnValue({ push: mockPush });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ studySession: { id: 1 } }),
    });
  });

  afterEach(() => {
    delete global.fetch;
  });

  it("renders the study session form", () => {
    render(<StudyNewPage />);

    expect(
      screen.getByRole("heading", { name: /new study session/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/biology chapter 6 review/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create session/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByText("AI can read: .pdf, .jpg, .jpeg, .png, .webp, .gif"),
    ).toBeInTheDocument();
    expect(screen.getByText("POMODOROS")).toBeInTheDocument();
    expect(
      screen.queryByText(/How many Pomodoro sessions/i),
    ).not.toBeInTheDocument();
  });

  it("shows an error if title is missing", () => {
    render(<StudyNewPage />);

    fireEvent.click(screen.getByRole("button", { name: /create session/i }));

    expect(toast.error).toHaveBeenCalledWith("Session title is required");
  });

  it("shows an error if date or time is missing", () => {
    render(<StudyNewPage />);

    fireEvent.change(screen.getByPlaceholderText(/biology chapter 6 review/i), {
      target: { value: "Final Exam Prep" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create session/i }));

    expect(toast.error).toHaveBeenCalledWith(
      "Pick a date and time for the session",
    );
  });

  it("creates a session and redirects to /study", async () => {
    const { container } = render(<StudyNewPage />);

    fireEvent.change(screen.getByPlaceholderText(/biology chapter 6 review/i), {
      target: { value: "Final Exam Prep" },
    });

    fireEvent.click(screen.getByRole("button", { name: /pick a date/i }));
    fireEvent.click(screen.getByRole("button", { name: /select date/i }));

    const timeInput = container.querySelector('input[type="time"]');
    fireEvent.change(timeInput, { target: { value: "14:00" } });

    fireEvent.click(screen.getByRole("button", { name: /create session/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Study session created");
      expect(mockPush).toHaveBeenCalledWith("/study");
    });
  });

  it("adds a file attachment", async () => {
    const { container } = render(<StudyNewPage />);
    const file = new File(["data"], "syllabus.pdf", {
      type: "application/pdf",
    });

    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("syllabus.pdf")).toBeInTheDocument();
  });

  it("loads task context when opened from a task", async () => {
    mockSearchParams = new URLSearchParams("taskId=42");
    global.fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        task: {
          id: 42,
          title: "Physics Final",
          description: "Mechanics and medical physics",
          deadline: "2099-03-31T23:59:00.000Z",
          priority: 4,
          status: "Pending",
          createdAt: "2099-03-01T00:00:00.000Z",
          completedAt: null,
        },
      }),
    });

    render(<StudyNewPage />);

    expect(await screen.findByText("Physics Final")).toBeInTheDocument();
    expect(
      screen.getByRole("heading", { name: /plan study sessions/i }),
    ).toBeInTheDocument();
  });

  it("saves session plans directly and uploads per-session attachments", async () => {
    mockSearchParams = new URLSearchParams("taskId=42");
    global.fetch = jest.fn(async (url, init) => {
      if (url === "/api/task/42") {
        return {
          ok: true,
          json: async () => ({
            task: {
              id: 42,
              title: "Physics Final",
              description: "Mechanics and medical physics",
              deadline: "2099-03-31T23:59:00.000Z",
              priority: 4,
              status: "Pending",
              createdAt: "2099-03-01T00:00:00.000Z",
              completedAt: null,
            },
          }),
        };
      }

      if (url === "/api/study/batch") {
        const payload = JSON.parse(init.body);
        const planId = payload.plans[0].client_plan_id;
        return {
          ok: true,
          json: async () => ({
            studySessions: [{ study_session_id: 11 }, { study_session_id: 12 }],
            createdByPlan: {
              [planId]: [11, 12],
            },
          }),
        };
      }

      if (url === "/api/study/attachment") {
        return {
          ok: true,
          json: async () => ({ attachment: { id: 9 } }),
        };
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    const { container } = render(<StudyNewPage />);

    await screen.findByText("Physics Final");

    expect(
      screen.queryByRole("button", { name: /generate preview/i }),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/generated sessions/i)).not.toBeInTheDocument();
    expect(screen.getByText("Study Sessions")).toBeInTheDocument();
    expect(screen.getByText(/REPEAT/i)).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Mon" })).not.toBeInTheDocument();

    fireEvent.change(screen.getByLabelText(/session topic/i), {
      target: { value: "Mechanical Physics" },
    });
    fireEvent.change(screen.getByLabelText(/preferred time/i), {
      target: { value: "15:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /on task day/i }));
    fireEvent.click(screen.getByLabelText(/enable reminder/i));

    const file = new File(["formula sheet"], "mechanics.pdf", {
      type: "application/pdf",
    });
    const trackFileInput = container.querySelector(
      'input[aria-label="Session attachments"]',
    );
    fireEvent.change(trackFileInput, { target: { files: [file] } });

    fireEvent.click(screen.getByRole("button", { name: /create sessions/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/study/batch",
        expect.objectContaining({ method: "POST" }),
      );
    });

    const batchCall = global.fetch.mock.calls.find(
      ([url]) => url === "/api/study/batch",
    );
    const payload = JSON.parse(batchCall[1].body);
    expect(payload.task_id).toBe(42);
    expect(payload.sessions).toBeUndefined();
    expect(payload.plans).toHaveLength(1);
    expect(payload.plans[0]).toEqual(
      expect.objectContaining({
        title: "Mechanical Physics",
        start_date: "2099-03-31",
        repeat: "none",
        time: "15:00",
      }),
    );
    expect(payload.plans[0].dates).toBeUndefined();
    expect(payload.plans[0].weekdays).toBeUndefined();
    expect(payload.reminder_enabled).toBe(true);
    expect(payload.reminders).toEqual([15, 5, 0]);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/study/attachment",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(mockPush).toHaveBeenCalledWith("/tasks/42");
  });

  it("does not save a task-linked planner without a start date", async () => {
    mockSearchParams = new URLSearchParams("taskId=42");
    global.fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          task: {
            id: 42,
            title: "Physics Final",
            description: "Mechanics and medical physics",
            deadline: "2099-03-31T23:59:00.000Z",
            priority: 4,
            status: "Pending",
            createdAt: "2099-03-01T00:00:00.000Z",
            completedAt: null,
          },
        }),
      });

    render(<StudyNewPage />);

    await screen.findByText("Physics Final");
    fireEvent.click(screen.getByRole("button", { name: /create sessions/i }));

    expect(
      await screen.findByText(/choose a start date/i),
    ).toBeInTheDocument();
    expect(toast.error).not.toHaveBeenCalledWith(
      "Choose at least one weekday for each session",
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });

  it("previews and applies AI generated study tracks", async () => {
    mockSearchParams = new URLSearchParams("taskId=42");
    global.fetch = jest.fn(async (url) => {
      if (url === "/api/task/42") {
        return {
          ok: true,
          json: async () => ({
            task: {
              id: 42,
              title: "Physics Final",
              description: "Mechanics and medical physics",
              deadline: "2099-03-31T23:59:00.000Z",
              priority: 4,
              status: "Pending",
              createdAt: "2099-03-01T00:00:00.000Z",
              completedAt: null,
            },
          }),
        };
      }

      if (url === "/api/ai/study-track-draft") {
        return {
          ok: true,
          json: async () => ({
            draft: {
              tracks: [
                {
                  title: "AI Mechanics Review",
                  start_date: "2099-03-22",
                  repeat: "weekly",
                  time: "16:00",
                  focus_minutes: 30,
                  break_minutes: 5,
                  total_pomodoros: 2,
                  notes: "Review force diagrams and formula sheets.",
                  description_as_checklist: true,
                },
              ],
              warnings: [],
              reasoning: "The draft spaces mechanics review before the deadline.",
              skippedAttachments: [],
            },
          }),
        };
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(<StudyNewPage />);

    expect(await screen.findByText("Physics Final")).toBeInTheDocument();
    expect(
      screen.getByText("AI can read: .pdf, .jpg, .jpeg, .png, .webp, .gif"),
    ).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ai suggestions/i }));

    expect(await screen.findByText(/ai mechanics review/i)).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /apply study plan/i }));

    expect(screen.getByLabelText(/session topic/i)).toHaveValue(
      "AI Mechanics Review",
    );
    expect(screen.getByLabelText(/preferred time/i)).toHaveValue("16:00");
    expect(screen.getByLabelText(/start date/i)).toHaveValue("2099-03-22");
    expect(
      screen.getByPlaceholderText(/optional notes for this session/i),
    ).toHaveValue("Review force diagrams and formula sheets.");
  });

  it("shows the specific study-track AI error message from the route", async () => {
    mockSearchParams = new URLSearchParams("taskId=42");
    global.fetch = jest.fn(async (url) => {
      if (url === "/api/task/42") {
        return {
          ok: true,
          json: async () => ({
            task: {
              id: 42,
              title: "Physics Final",
              description: "Mechanics and medical physics",
              deadline: "2099-03-31T23:59:00.000Z",
              priority: 4,
              status: "Pending",
              createdAt: "2099-03-01T00:00:00.000Z",
              completedAt: null,
            },
          }),
        };
      }

      if (url === "/api/ai/study-track-draft") {
        return {
          ok: false,
          json: async () => ({
            code: "AI_TIMEOUT",
            message:
              "AI suggestions took too long to generate. Try again with fewer or smaller attachments.",
          }),
        };
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(<StudyNewPage />);

    expect(await screen.findByText("Physics Final")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /ai suggestions/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "AI suggestions took too long to generate. Try again with fewer or smaller attachments.",
      );
    });
    expect(screen.queryByRole("button", { name: /apply study plan/i })).not.toBeInTheDocument();
    expect(screen.queryByText(/AI Mechanics Review/i)).not.toBeInTheDocument();
  });
});
