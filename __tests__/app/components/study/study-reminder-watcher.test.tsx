import { act, render, waitFor } from "@testing-library/react";
import { StudyReminderWatcher } from "@/app/components/study/study-reminder-watcher";
import type { StudySession } from "@/types";

let pathname = "/dashboard";

jest.mock("next/navigation", () => ({
  usePathname: () => pathname,
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

function mockFetchWithSessions(sessions: StudySession[]) {
  global.fetch = jest.fn(async (input: RequestInfo | URL) => {
    if (input === "/api/study") {
      return {
        ok: true,
        json: async () => ({
          studySessions: sessions,
        }),
      } as Response;
    }

    if (input === "/api/web-push/send") {
      return {
        ok: true,
        json: async () => ({}),
      } as Response;
    }

    throw new Error(`Unexpected fetch: ${String(input)}`);
  });
}

describe("StudyReminderWatcher", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-15T09:00:00.000Z"));
    localStorage.clear();
    pathname = "/dashboard";
  });

  afterEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
  });

  it("sends a reminder from a non-study page when a session enters its reminder window", async () => {
    mockFetchWithSessions([makeSession()]);

    render(<StudyReminderWatcher />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/web-push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: "Study session: Physics review",
          body: "Starts in 5 minutes",
          url: "/study/session-1",
          tag: "study-reminder:session-1:2026-06-15T09:05:00.000Z:300",
        }),
      });
    });
  });

  it("does not send duplicate reminders while the first request is pending", async () => {
    let resolvePush: (value: Response) => void = () => {};
    global.fetch = jest.fn((input: RequestInfo | URL) => {
      if (input === "/api/study") {
        return Promise.resolve({
          ok: true,
          json: async () => ({
            studySessions: [makeSession()],
          }),
        } as Response);
      }

      if (input === "/api/web-push/send") {
        return new Promise<Response>((resolve) => {
          resolvePush = resolve;
        });
      }

      return Promise.reject(new Error(`Unexpected fetch: ${String(input)}`));
    });

    render(<StudyReminderWatcher />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/web-push/send",
        expect.objectContaining({ method: "POST" }),
      );
    });

    await act(async () => {
      jest.advanceTimersByTime(3000);
    });

    const pushCalls = (global.fetch as jest.Mock).mock.calls.filter(
      ([url]) => url === "/api/web-push/send",
    );
    expect(pushCalls).toHaveLength(1);

    await act(async () => {
      resolvePush({
        ok: true,
        json: async () => ({}),
      } as Response);
    });
  });

  it("does not resend the same reminder after remounting", async () => {
    mockFetchWithSessions([makeSession()]);

    const { unmount } = render(<StudyReminderWatcher />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/web-push/send",
        expect.objectContaining({ method: "POST" }),
      );
    });

    unmount();
    render(<StudyReminderWatcher />);

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    const pushCalls = (global.fetch as jest.Mock).mock.calls.filter(
      ([url]) => url === "/api/web-push/send",
    );
    expect(pushCalls).toHaveLength(1);
  });

  it("does not send reminders for disabled, empty, timer-only, or completed sessions", async () => {
    mockFetchWithSessions([
      makeSession({ id: "disabled", reminderEnabled: false }),
      makeSession({ id: "empty", reminderOffsets: [] }),
      makeSession({ id: "timer", isTimerOnly: true }),
      makeSession({ id: "completed", sessionStatus: "completed" }),
    ]);

    render(<StudyReminderWatcher />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/study", {
        credentials: "same-origin",
      });
    });

    await act(async () => {
      jest.advanceTimersByTime(1000);
    });

    expect(global.fetch).not.toHaveBeenCalledWith(
      "/api/web-push/send",
      expect.anything(),
    );
  });

  it("refreshes sessions when the route changes", async () => {
    mockFetchWithSessions([]);
    const { rerender } = render(<StudyReminderWatcher />);

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/study", {
        credentials: "same-origin",
      });
    });

    pathname = "/tasks";
    rerender(<StudyReminderWatcher />);

    await waitFor(() => {
      const studyFetches = (global.fetch as jest.Mock).mock.calls.filter(
        ([url]) => url === "/api/study",
      );
      expect(studyFetches).toHaveLength(2);
    });
  });
});
