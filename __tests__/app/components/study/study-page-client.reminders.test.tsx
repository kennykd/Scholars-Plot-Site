import { act, render, waitFor } from "@testing-library/react";
import { StudyPageClient } from "@/app/components/study/study-page-client";
import type { StudySession } from "@/types";

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push: jest.fn(),
    refresh: jest.fn(),
  }),
}));

jest.mock("@/lib/firebase/auth-context", () => ({
  useAuth: () => ({
    user: { id: "user-1" },
  }),
}));

function makeSession(overrides: Partial<StudySession> = {}): StudySession {
  return {
    id: overrides.id ?? "session-1",
    title: overrides.title ?? "Physics review",
    notes: "",
    attachments: [],
    scheduledAt: overrides.scheduledAt ?? "2026-06-15T09:05:00.000Z",
    focusMinutes: 25,
    breakMinutes: 5,
    totalMinutes: 60,
    sessionStatus: "idle",
    createdAt: "2026-06-15T08:00:00.000Z",
    reminderEnabled: true,
    reminderOffsets: [5],
    ...overrides,
  };
}

describe("StudyPageClient push reminders", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-15T09:00:00.000Z"));
    localStorage.clear();
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({}),
    })) as jest.Mock;
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("sends one reminder when a session enters its reminder window", async () => {
    render(<StudyPageClient initialSessions={[makeSession()]} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/web-push/send",
      expect.objectContaining({
        method: "POST",
        body: expect.stringContaining("Physics review"),
      }),
    );
  });

  it("does not send duplicate reminders while the first request is pending", async () => {
    let resolveFetch: (value: unknown) => void = () => {};
    global.fetch = jest.fn(
      () =>
        new Promise((resolve) => {
          resolveFetch = resolve;
        }),
    ) as jest.Mock;

    render(<StudyPageClient initialSessions={[makeSession()]} />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);

    await act(async () => {
      resolveFetch({
        ok: true,
        json: async () => ({}),
      });
    });
  });

  it("does not resend the same reminder after remounting", async () => {
    const { unmount } = render(
      <StudyPageClient initialSessions={[makeSession()]} />,
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledTimes(1);
    });

    unmount();
    render(<StudyPageClient initialSessions={[makeSession()]} />);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
  });
});
