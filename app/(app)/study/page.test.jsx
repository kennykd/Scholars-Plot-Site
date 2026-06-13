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
      <StudyPageHeader />
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
    expect(screen.getByText(/UPCOMING STUDY PLAN/i)).toBeInTheDocument();
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

  it("navigates to the session detail page when Start is clicked", () => {
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

    fireEvent.click(screen.getByRole("button", { name: /Start/i }));

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

  it("shows upcoming reminders inline with the task-style menu", () => {
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

    expect(screen.getByText(/Upcoming Reminders/i)).toBeInTheDocument();
    expect(screen.getByText("Reminder Session")).toBeInTheDocument();
  });
});
