/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { StudyPageClient } from "@/app/components/study/study-page-client";
import type { StudySession } from "@/types";

// Mock Next.js navigation
jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}));

// Mock Auth Context
jest.mock("@/lib/firebase/auth-context", () => ({
  useAuth: () => ({
    user: { id: "test-user-id" },
  }),
}));

const getInProgressSessions = jest.fn();
const getUpcomingSessions = jest.fn();
const getCompletedSessions = jest.fn();
const getExpiredSessions = jest.fn();
const getUpcomingSoonSessions = jest.fn();

// Mock the helper imports so the test can pin each status bucket.
jest.mock("@/lib/study/study-session-helper", () => ({
  getInProgressSessions: (...args: unknown[]) => getInProgressSessions(...args),
  getUpcomingSessions: (...args: unknown[]) => getUpcomingSessions(...args),
  getCompletedSessions: (...args: unknown[]) => getCompletedSessions(...args),
  getExpiredSessions: (...args: unknown[]) => getExpiredSessions(...args),
  getUpcomingSoonSessions: (...args: unknown[]) => getUpcomingSoonSessions(...args),
}));

describe("StudyPageClient View", () => {
  function makeSession(overrides: Partial<StudySession> = {}): StudySession {
    return {
      id: overrides.id ?? "session-1",
      title: overrides.title ?? "Physics review",
      notes: overrides.notes ?? "",
      attachments: overrides.attachments ?? [],
      scheduledAt: overrides.scheduledAt ?? "2099-06-20T09:00:00.000Z",
      focusMinutes: overrides.focusMinutes ?? 25,
      breakMinutes: overrides.breakMinutes ?? 5,
      totalMinutes: overrides.totalMinutes ?? 60,
      sessionStatus: overrides.sessionStatus ?? "idle",
      createdAt: overrides.createdAt ?? "2099-06-01T09:00:00.000Z",
      reminderEnabled: overrides.reminderEnabled ?? false,
      reminderOffsets: overrides.reminderOffsets ?? [],
    };
  }

  it("renders the task-style study toolbar and empty list state", async () => {
    getInProgressSessions.mockReturnValue([]);
    getUpcomingSessions.mockReturnValue([]);
    getCompletedSessions.mockReturnValue([]);
    getExpiredSessions.mockReturnValue([]);
    getUpcomingSoonSessions.mockReturnValue([]);

    render(<StudyPageClient initialSessions={[]} />);

    expect(screen.queryByRole("tab", { name: /all/i })).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /In Progress/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Upcoming/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Completed/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /Expired/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByText(/No study sessions found/i)).toBeInTheDocument();
  });

  it("groups sessions by status and hides a status when its button is toggled off", async () => {
    const user = userEvent.setup();
    const running = makeSession({
      id: "running-session",
      title: "Live algebra review",
      sessionStatus: "running",
      scheduledAt: "2099-06-20T09:00:00.000Z",
    });
    const upcoming = makeSession({
      id: "upcoming-session",
      title: "Upcoming literature block",
      scheduledAt: "2099-06-21T09:00:00.000Z",
    });
    const completed = makeSession({
      id: "completed-session",
      title: "Completed chemistry notes",
      sessionStatus: "completed",
      scheduledAt: "2099-06-22T09:00:00.000Z",
    });

    getInProgressSessions.mockReturnValue([running]);
    getUpcomingSessions.mockReturnValue([upcoming]);
    getCompletedSessions.mockReturnValue([completed]);
    getExpiredSessions.mockReturnValue([]);
    getUpcomingSoonSessions.mockReturnValue([]);

    render(<StudyPageClient initialSessions={[running, upcoming, completed]} />);

    expect(screen.getByRole("heading", { name: /In Progress/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Upcoming/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Completed/i })).toBeInTheDocument();
    expect(screen.getByText("Live algebra review")).toBeInTheDocument();
    expect(screen.getByText("Upcoming literature block")).toBeInTheDocument();
    expect(screen.getByText("Completed chemistry notes")).toBeInTheDocument();

    const filters = screen.getByLabelText("Study status filters");
    const upcomingFilter = within(filters).getByRole("button", {
      name: /Upcoming/i,
    });

    await user.click(upcomingFilter);

    expect(screen.getByText("Live algebra review")).toBeInTheDocument();
    expect(screen.queryByText("Upcoming literature block")).not.toBeInTheDocument();
    expect(screen.getByText("Completed chemistry notes")).toBeInTheDocument();
    expect(upcomingFilter).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });
});
