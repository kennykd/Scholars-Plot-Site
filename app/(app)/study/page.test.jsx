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

    expect(screen.getByText(/STUDY SESSIONS/i)).toBeInTheDocument();
    expect(screen.getByText(/UPCOMING STUDY PLAN/i)).toBeInTheDocument();
  });

  it("allows a user to input a quick timer and add it to the list", async () => {
    renderStudyPage();

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

    expect(screen.getByText(/Quick Timer/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Timer only/i)).toBeInTheDocument();
  });
});
