import {
  addMinutes,
  differenceInHours,
  differenceInMinutes,
  isAfter,
  isBefore,
  parseISO,
} from "date-fns";
import type { StudySession } from "@/types";

export function getInProgressSessions(
  sessions: StudySession[],
  nowTick: Date,
): StudySession[] {
  return sessions
    .filter((studySession) => {
      if (
        studySession.sessionStatus !== "running" &&
        studySession.sessionStatus !== "paused"
      ) {
        return false;
      }

      const scheduledTime = parseISO(studySession.scheduledAt);
      const hoursPassed = differenceInHours(nowTick, scheduledTime);
      return hoursPassed < 24;
    })
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );
}

export function getUpcomingSessions(
  sessions: StudySession[],
  nowTick: Date,
): StudySession[] {
  return sessions
    .filter((studySession) => {
      if (
        studySession.sessionStatus !== "completed" &&
        studySession.sessionStatus === "idle"
      ) {
        if (studySession.isTimerOnly) return true;

        const scheduledTime = parseISO(studySession.scheduledAt);
        return isAfter(scheduledTime, addMinutes(nowTick, -15));
      }
      return false;
    })
    .sort(
      (a, b) =>
        new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
    );
}

export function getCompletedSessions(sessions: StudySession[]): StudySession[] {
  return sessions
    .filter((studySession) => studySession.sessionStatus === "completed")
    .sort(
      (a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
    );
}

export function getExpiredSessions(
  sessions: StudySession[],
  nowTick: Date,
): StudySession[] {
  return sessions
    .filter((studySession) => {
      if (
        studySession.sessionStatus === "completed" ||
        studySession.isTimerOnly
      ) {
        return false;
      }

      const scheduledTime = parseISO(studySession.scheduledAt);

      if (studySession.sessionStatus === "idle") {
        return isBefore(scheduledTime, addMinutes(nowTick, -15));
      }

      if (
        studySession.sessionStatus === "running" ||
        studySession.sessionStatus === "paused"
      ) {
        const hoursPassed = differenceInHours(nowTick, scheduledTime);
        return hoursPassed >= 24;
      }

      return false;
    })
    .sort(
      (a, b) =>
        new Date(b.scheduledAt).getTime() - new Date(a.scheduledAt).getTime(),
    );
}

export function getUpcomingSoonSessions(
  upcomingSessions: StudySession[],
  nowTick: Date,
): StudySession[] {
  return upcomingSessions.filter((studySession) => {
    if (studySession.isTimerOnly) return false;
    const reminderOffsets = studySession.reminderOffsets ?? [];
    if (!studySession.reminderEnabled || reminderOffsets.length === 0) {
      return false;
    }

    const maxReminderOffset = reminderOffsets.reduce(
      (highest, current) => Math.max(highest, Math.max(0, current)),
      0,
    );

    const minutesAway = differenceInMinutes(
      parseISO(studySession.scheduledAt),
      nowTick,
    );

    return minutesAway >= 0 && minutesAway <= maxReminderOffset;
  });
}
