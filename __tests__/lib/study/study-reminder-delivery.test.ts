import {
  getDueStudyReminderNotifications,
  getStudyReminderKey,
  readStoredReminderKeys,
  SENT_REMINDERS_STORAGE_KEY,
  writeStoredReminderKeys,
} from "@/lib/study/study-reminder-delivery";
import type { StudySession } from "@/types";

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

describe("study reminder delivery helpers", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it("builds a stable reminder key from session id, scheduled time, and threshold", () => {
    const session = makeSession();

    expect(getStudyReminderKey(session, 300)).toBe(
      "session-1:2026-06-15T09:05:00.000Z:300",
    );
  });

  it("computes one due push payload when a session enters its reminder window", () => {
    const notifications = getDueStudyReminderNotifications(
      [makeSession()],
      new Date("2026-06-15T09:00:00.000Z"),
      new Set(),
    );

    expect(notifications).toEqual([
      {
        reminderKey: "session-1:2026-06-15T09:05:00.000Z:300",
        payload: {
          title: "Study session: Physics review",
          body: "Starts in 5 minutes",
          url: "/study/session-1",
          tag: "study-reminder:session-1:2026-06-15T09:05:00.000Z:300",
        },
      },
    ]);
  });

  it("skips ineligible sessions and already-sent reminder keys", () => {
    const sentKey = "sent:already";
    const sessions = [
      makeSession({
        id: "disabled",
        reminderEnabled: false,
      }),
      makeSession({
        id: "empty-offsets",
        reminderOffsets: [],
      }),
      makeSession({
        id: "timer-only",
        isTimerOnly: true,
      }),
      makeSession({
        id: "completed",
        sessionStatus: "completed",
      }),
      makeSession({
        id: "already",
        scheduledAt: "2026-06-15T09:05:00.000Z",
        reminderOffsets: [5],
      }),
    ];

    const notifications = getDueStudyReminderNotifications(
      sessions,
      new Date("2026-06-15T09:00:00.000Z"),
      new Set([
        sentKey,
        "already:2026-06-15T09:05:00.000Z:300",
      ]),
    );

    expect(notifications).toEqual([]);
  });

  it("stores and reads sent reminder keys from localStorage", () => {
    writeStoredReminderKeys(new Set(["a", "b"]));

    expect(localStorage.getItem(SENT_REMINDERS_STORAGE_KEY)).toBe(
      JSON.stringify(["a", "b"]),
    );
    expect(readStoredReminderKeys()).toEqual(new Set(["a", "b"]));
  });
});
