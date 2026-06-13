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

  it("saves track rules directly and uploads per-track attachments", async () => {
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
        const trackId = payload.tracks[0].client_track_id;
        return {
          ok: true,
          json: async () => ({
            studySessions: [{ study_session_id: 11 }, { study_session_id: 12 }],
            createdByTrack: {
              [trackId]: [11, 12],
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

    fireEvent.change(screen.getByLabelText(/track topic/i), {
      target: { value: "Mechanical Physics" },
    });
    fireEvent.change(screen.getByLabelText(/preferred time/i), {
      target: { value: "15:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: /^mon$/i }));
    fireEvent.click(screen.getByRole("button", { name: /^thu$/i }));

    const file = new File(["formula sheet"], "mechanics.pdf", {
      type: "application/pdf",
    });
    const trackFileInput = container.querySelector(
      'input[aria-label="Track attachments"]',
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
    expect(payload.tracks).toHaveLength(1);
    expect(payload.tracks[0]).toEqual(
      expect.objectContaining({
        title: "Mechanical Physics",
        weekdays: expect.arrayContaining([1, 4]),
        time: "15:00",
      }),
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/study/attachment",
        expect.objectContaining({ method: "POST" }),
      );
    });
    expect(mockPush).toHaveBeenCalledWith("/tasks/42");
  });

  it("does not save a task-linked planner without selected weekdays", async () => {
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

    expect(toast.error).toHaveBeenCalledWith(
      "Choose at least one weekday for each track",
    );
    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
