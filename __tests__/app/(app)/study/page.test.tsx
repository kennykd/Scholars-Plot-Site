/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen } from "@testing-library/react";
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

// Mock the helper imports so they don't break during filtering loops
jest.mock("@/lib/study/study-session-helper", () => ({
  getInProgressSessions: () => [],
  getUpcomingSessions: () => [],
  getCompletedSessions: () => [],
  getExpiredSessions: () => [],
  getUpcomingSoonSessions: () => [],
}));

describe("StudyPageClient View", () => {
  const mockInitialSessions: StudySession[] = [];

  it("renders the task-style study toolbar and empty list state", async () => {
    render(<StudyPageClient initialSessions={mockInitialSessions} />);

    expect(screen.getByRole("tab", { name: "All" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "In Progress" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Upcoming" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Completed" })).toBeInTheDocument();
    expect(screen.getByRole("tab", { name: "Expired" })).toBeInTheDocument();
    expect(screen.getByText(/No study sessions found/i)).toBeInTheDocument();
  });
});
