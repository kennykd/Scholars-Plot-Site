"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAuth } from "@/lib/firebase/auth-context";
import {
  getDueStudyReminderNotifications,
  readStoredReminderKeys,
  writeStoredReminderKeys,
} from "@/lib/study/study-reminder-delivery";
import type { StudySession } from "@/types";

const SESSION_REFRESH_INTERVAL_MS = 60_000;
const REMINDER_TICK_INTERVAL_MS = 1_000;

function getStudySessionsFromResponse(value: unknown): StudySession[] | null {
  if (typeof value !== "object" || value === null) return null;

  const studySessions = (value as { studySessions?: unknown }).studySessions;
  return Array.isArray(studySessions) ? (studySessions as StudySession[]) : null;
}

export function StudyReminderWatcher() {
  const pathname = usePathname();
  const { user } = useAuth();
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [nowTick, setNowTick] = useState(() => new Date());
  const sentReminderKeys = useRef<Set<string>>(new Set());

  useEffect(() => {
    sentReminderKeys.current = readStoredReminderKeys();
  }, [user?.id]);

  const refreshSessions = useCallback(async () => {
    if (!user?.id) {
      setSessions([]);
      return;
    }

    try {
      const response = await fetch("/api/study", {
        credentials: "same-origin",
      });

      if (!response.ok) return;

      const data = await response.json();
      const nextSessions = getStudySessionsFromResponse(data);
      if (nextSessions) setSessions(nextSessions);
    } catch {
      // Reminder polling should never interrupt normal app navigation.
    }
  }, [user?.id]);

  useEffect(() => {
    let active = true;

    void Promise.resolve().then(() => {
      if (active) void refreshSessions();
    });

    return () => {
      active = false;
    };
  }, [pathname, refreshSessions]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      void refreshSessions();
    }, SESSION_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, [refreshSessions]);

  useEffect(() => {
    const handleFocus = () => {
      void refreshSessions();
    };

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        void refreshSessions();
      }
    };

    window.addEventListener("focus", handleFocus);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    return () => {
      window.removeEventListener("focus", handleFocus);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [refreshSessions]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      setNowTick(new Date());
    }, REMINDER_TICK_INTERVAL_MS);

    return () => window.clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!user?.id || sessions.length === 0) return;

    const dueNotifications = getDueStudyReminderNotifications(
      sessions,
      nowTick,
      sentReminderKeys.current,
    );

    if (dueNotifications.length === 0) return;

    for (const notification of dueNotifications) {
      sentReminderKeys.current.add(notification.reminderKey);
    }
    writeStoredReminderKeys(sentReminderKeys.current);

    for (const notification of dueNotifications) {
      void fetch("/api/web-push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(notification.payload),
      });
    }
  }, [nowTick, sessions, user?.id]);

  return null;
}
