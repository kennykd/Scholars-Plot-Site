import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import StudySessionPage from "./page";
import { useParams } from "next/navigation";
import { toast } from "sonner";
import { mockStudySessions } from "@/lib/mock-data";

jest.mock("next/navigation", () => ({
  useParams: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const STORAGE_KEY = "scholarsPlot.studySessions";
const baseStudySession = mockStudySessions[0];

const makeStoredSession = (overrides = {}) => ({
  id: baseStudySession.id,
  title: baseStudySession.taskTitle ?? "Study Session",
  notes: "",
  attachments: [],
  scheduledAt: (baseStudySession.scheduledAt ?? new Date()).toISOString(),
  focusMinutes: baseStudySession.duration ?? 25,
  breakMinutes: baseStudySession.breakDuration ?? 5,
  totalMinutes: 60,
  status: "planned",
  createdAt: "2026-03-05T09:00:00.000Z",
  ...overrides,
});

describe("StudySessionPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    useParams.mockReturnValue({ id: baseStudySession.id });
  });

  it("shows not found state when session id does not exist", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([makeStoredSession({ id: "other-id" })]),
    );
    useParams.mockReturnValue({ id: "missing-id" });

    render(<StudySessionPage />);

    expect(
      await screen.findByRole("heading", { name: /Session not found/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("link", { name: /Back to Study/i }),
    ).toBeInTheDocument();
  });

  it("renders session details from localStorage", async () => {
    const session = makeStoredSession({
      notes: "Cover dynamic programming chapters",
      attachments: ["notes.pdf"],
    });

    localStorage.setItem(STORAGE_KEY, JSON.stringify([session]));

    render(<StudySessionPage />);

    expect(
      await screen.findByRole("heading", {
        name: new RegExp(session.title, "i"),
      }),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Cover dynamic programming chapters/i),
    ).toBeInTheDocument();
    expect(screen.getByText("notes.pdf")).toBeInTheDocument();
  });

  it("marks session done and shows a success toast", async () => {
    const session = makeStoredSession({ title: "Physics Review" });
    localStorage.setItem(STORAGE_KEY, JSON.stringify([session]));

    render(<StudySessionPage />);

    fireEvent.click(await screen.findByRole("button", { name: /Mark Done/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Session complete: Physics Review",
      );
      expect(screen.getByText("COMPLETED")).toBeInTheDocument();
    });
  });
});
