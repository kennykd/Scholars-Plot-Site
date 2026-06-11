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

  it("renders the upcoming and completed study session boxes", async () => {
    // Render the client component with its required array props
    render(<StudyPageClient initialSessions={mockInitialSessions} />);

    // Since we updated your ListCard component earlier to always show 
    // "Upcoming Sessions" and "Completed Sessions" layouts:
    expect(screen.getByText(/Upcoming Sessions/i)).toBeInTheDocument();
    expect(screen.getByText(/Completed Sessions/i)).toBeInTheDocument();
  });
});