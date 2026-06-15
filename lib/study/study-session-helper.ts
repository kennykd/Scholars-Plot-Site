import {
  addMinutes,
  differenceInMinutes,
  isAfter,
  isBefore,
  parseISO,
} from "date-fns";
import type { StudySession } from "@/types";

export function getInProgressSessions(
  sessions: StudySession[],
): StudySession[] {
  // A running or paused timer stays "in progress" no matter how long ago it was
  // scheduled — an active session should never get yanked into Expired.
  return sessions
    .filter(
      (studySession) =>
        studySession.sessionStatus === "running" ||
        studySession.sessionStatus === "paused",
    )
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
      // Completed and running/paused sessions belong elsewhere; only an idle
      // session that slipped past its scheduled time counts as expired (and it
      // shows up here and nowhere else).
      if (
        studySession.sessionStatus !== "idle" ||
        studySession.isTimerOnly
      ) {
        return false;
      }

      const scheduledTime = parseISO(studySession.scheduledAt);
      return isBefore(scheduledTime, addMinutes(nowTick, -15));
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
