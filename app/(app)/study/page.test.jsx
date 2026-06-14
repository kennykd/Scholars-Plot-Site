import { render, screen, fireEvent } from "@testing-library/react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import { StudyPageHeader } from "@/app/components/study/study-page-header";
import { StudyPageClient } from "@/app/components/study/study-page-client";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("@/lib/firebase/auth-context", () => ({
  useAuth: jest.fn(),
}));

const renderStudyPage = (initialSessions = []) =>
  render(
    <div className="p-6 space-y-6">
      <StudyPageHeader sessionCount={initialSessions.length} />
      <StudyPageClient initialSessions={initialSessions} />
    </div>,
  );

describe("StudyPage client sections", () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useRouter.mockReturnValue({ push: mockPush });
    useAuth.mockReturnValue({ user: null });
  });

  it("renders the study sessions header", () => {
    renderStudyPage();

    expect(
      screen.getByRole("heading", { name: /STUDY SESSIONS/i }),
    ).toBeInTheDocument();
    expect(screen.getByText(/0 sessions/i)).toBeInTheDocument();
    expect(screen.queryByText(/UPCOMING STUDY PLAN/i)).not.toBeInTheDocument();
  });

  it("allows a user to input a quick timer and add it to the list", async () => {
    renderStudyPage();

    fireEvent.click(screen.getByRole("button", { name: /quick timer/i }));
    fireEvent.change(screen.getByPlaceholderText(/Timer only/i), {
      target: { value: "Website Application Design" },
    });
    fireEvent.click(screen.getByText(/Add Timer/i));

    expect(
      await screen.findByText("Website Application Design"),
    ).toBeInTheDocument();
  });

  it("navigates to the session detail page from the compact row control", () => {
    renderStudyPage([
      {
        id: "42",
        title: "Physics Review",
        notes: "",
        attachments: [],
        scheduledAt: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        focusMinutes: 25,
        breakMinutes: 5,
        totalMinutes: 60,
        sessionStatus: "idle",
        createdAt: new Date().toISOString(),
        isTimerOnly: false,
      },
    ]);

    expect(
      screen.queryByRole("button", { name: /^Start$/i }),
    ).not.toBeInTheDocument();

    fireEvent.click(
      screen.getByRole("button", { name: /open physics review/i }),
    );

    expect(mockPush).toHaveBeenCalledWith("/study/42");
  });

  it("keeps the quick timer available when no sessions exist", () => {
    renderStudyPage();

    expect(
      screen.getByRole("button", { name: /quick timer/i }),
    ).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Timer only/i)).not.toBeInTheDocument();
  });

  it("shows task-style study tabs and an empty list state when no sessions exist", () => {
    renderStudyPage();

    expect(screen.getByRole("tab", { name: /^All$/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /In Progress/i })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: /Upcoming/i })).toBeInTheDocument();
    expect(screen.getByRole("combobox")).toHaveTextContent(/Scheduled/i);
    expect(screen.getByText(/No study sessions found/i)).toBeInTheDocument();
    expect(screen.queryByText(/Completed Sessions/i)).not.toBeInTheDocument();
  });

  it("shows every upcoming study session instead of capping the list", () => {
    const upcomingSessions = Array.from({ length: 10 }, (_, index) => ({
      id: String(index + 1),
      title: `Planned Session ${index + 1}`,
      notes: "",
      attachments: [],
      scheduledAt: new Date(Date.now() + (index + 1) * 60 * 60 * 1000).toISOString(),
      focusMinutes: 25,
      breakMinutes: 5,
      totalMinutes: 60,
      sessionStatus: "idle",
      createdAt: new Date().toISOString(),
      isTimerOnly: false,
    }));

    renderStudyPage(upcomingSessions);

    expect(screen.getByText("Planned Session 1")).toBeInTheDocument();
    expect(screen.getByText("Planned Session 10")).toBeInTheDocument();
  });

  it("does not render an upcoming reminders section", () => {
    renderStudyPage([
      {
        id: "12",
        title: "Reminder Session",
        notes: "",
        attachments: [],
        scheduledAt: new Date(Date.now() + 5 * 60 * 1000).toISOString(),
        focusMinutes: 25,
        breakMinutes: 5,
        totalMinutes: 60,
        sessionStatus: "idle",
        createdAt: new Date().toISOString(),
        reminderEnabled: true,
        reminderOffsets: [15, 5, 0],
        isTimerOnly: false,
      },
    ]);

    expect(screen.queryByText(/Upcoming Reminders/i)).not.toBeInTheDocument();
    expect(screen.getByText("Reminder Session")).toBeInTheDocument();
  });

  it("uses task-style compact row sizing for study sessions", () => {
    renderStudyPage([
      {
        id: "77",
        title: "Compact Session",
        notes: "Bring formula sheet",
        attachments: [],
        scheduledAt: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        focusMinutes: 25,
        breakMinutes: 5,
        totalMinutes: 60,
        sessionStatus: "idle",
        createdAt: new Date().toISOString(),
        isTimerOnly: false,
      },
    ]);

    const rowButton = screen.getByRole("button", {
      name: /open compact session/i,
    });
    const row = rowButton.closest("[data-study-row]");

    expect(row).toHaveClass("py-3.5");
    expect(row).not.toHaveClass("grid");
    expect(screen.queryByText(/June|January|February|March|April|May|July|August|September|October|November|December/)).not.toBeInTheDocument();
  });
});
