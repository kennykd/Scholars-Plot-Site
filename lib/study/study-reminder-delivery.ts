import { differenceInSeconds, parseISO } from "date-fns";
import type { StudySession } from "@/types";

export const SENT_REMINDERS_STORAGE_KEY = "scholars-plot:sent-study-reminders";

export type StudyReminderPushPayload = {
  title: string;
  body: string;
  url: string;
  tag: string;
};

export type DueStudyReminderNotification = {
  reminderKey: string;
  payload: StudyReminderPushPayload;
};

function getBrowserStorage() {
  if (typeof window === "undefined") return null;
  return window.localStorage;
}

export function readStoredReminderKeys(
  storage: Storage | null = getBrowserStorage(),
) {
  if (!storage) return new Set<string>();

  try {
    const parsed = JSON.parse(
      storage.getItem(SENT_REMINDERS_STORAGE_KEY) ?? "[]",
    );

    return new Set(
      Array.isArray(parsed)
        ? parsed.filter(
            (item): item is string =>
              typeof item === "string" && item.length > 0,
          )
        : [],
    );
  } catch {
    return new Set<string>();
  }
}

export function writeStoredReminderKeys(
  keys: Set<string>,
  storage: Storage | null = getBrowserStorage(),
) {
  if (!storage) return;
  storage.setItem(SENT_REMINDERS_STORAGE_KEY, JSON.stringify([...keys]));
}

export function getStudyReminderKey(
  studySession: StudySession,
  thresholdSeconds: number,
) {
  return `${studySession.id}:${studySession.scheduledAt}:${thresholdSeconds}`;
}

function buildPayload(
  studySession: StudySession,
  thresholdSeconds: number,
  reminderKey: string,
): StudyReminderPushPayload {
  const minutesLabel = thresholdSeconds / 60;

  return {
    title: `Study session: ${studySession.title}`,
    body:
      thresholdSeconds === 0
        ? "Starting now"
        : `Starts in ${minutesLabel} minute${minutesLabel > 1 ? "s" : ""}`,
    url: `/study/${studySession.id}`,
    tag: `study-reminder:${reminderKey}`,
  };
}

function getThresholdSeconds(reminderOffsets: number[]) {
  return reminderOffsets.map((offsetMinutes) =>
    Math.max(0, Number(offsetMinutes) || 0) * 60,
  );
}

export function getDueStudyReminderNotifications(
  sessions: StudySession[],
  now: Date,
  sentReminderKeys: Set<string>,
): DueStudyReminderNotification[] {
  const dueNotifications: DueStudyReminderNotification[] = [];
  const reservedKeys = new Set(sentReminderKeys);

  for (const studySession of sessions) {
    const reminderOffsets = studySession.reminderOffsets ?? [];

    if (
      studySession.isTimerOnly ||
      studySession.sessionStatus !== "idle" ||
      studySession.reminderEnabled === false ||
      reminderOffsets.length === 0
    ) {
      continue;
    }

    const secondsAway = differenceInSeconds(
      parseISO(studySession.scheduledAt),
      now,
    );

    if (!Number.isFinite(secondsAway)) continue;

    for (const thresholdSeconds of getThresholdSeconds(reminderOffsets)) {
      if (
        secondsAway <= thresholdSeconds &&
        secondsAway > thresholdSeconds - 60
      ) {
        const reminderKey = getStudyReminderKey(studySession, thresholdSeconds);
        if (reservedKeys.has(reminderKey)) continue;

        reservedKeys.add(reminderKey);
        dueNotifications.push({
          reminderKey,
          payload: buildPayload(studySession, thresholdSeconds, reminderKey),
        });
      }
    }
  }

  return dueNotifications;
}
