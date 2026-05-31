"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { differenceInSeconds, parseISO } from "date-fns";
import type { StudySession } from "@/types";
import { useAuth } from "@/lib/firebase/auth-context";
import {
  getCompletedSessions,
  getExpiredSessions,
  getInProgressSessions,
  getUpcomingSessions,
  getUpcomingSoonSessions,
} from "@/lib/study/study-session-helper";
import { StudySelectionToolbar } from "@/app/components/study/study-selection-toolbar";
import { StudySessionListCard } from "@/app/components/study/study-session-list-card";
import { StudyQuickTimerCard } from "@/app/components/study/study-quick-timer-card";
import { StudyUpcomingRemindersCard } from "@/app/components/study/study-upcoming-reminders-card";

type StudyPageClientProps = {
  initialSessions: StudySession[];
};

export function StudyPageClient({ initialSessions }: StudyPageClientProps) {
  const router = useRouter();
  const userIDRef = useRef<string | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>(initialSessions);
  const [nowTick, setNowTick] = useState(new Date());
  const [quickTitle, setQuickTitle] = useState("");
  const [quickFocusMinutes, setQuickFocusMinutes] = useState(25);
  const [quickBreakMinutes, setQuickBreakMinutes] = useState(5);
  const [quickTotalMinutes, setQuickTotalMinutes] = useState(60);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Fetch the user and store it in Ref, this is for getting userID data for notifications
  const { user } = useAuth();
  useEffect(() => {
    userIDRef.current = user?.id ?? null;
  }, [user]);

  const inProgressSessions = useMemo(
    () => getInProgressSessions(sessions, nowTick),
    [sessions, nowTick],
  );

  const upcomingSessions = useMemo(
    () => getUpcomingSessions(sessions, nowTick),
    [sessions, nowTick],
  );

  const completedSessions = useMemo(
    () => getCompletedSessions(sessions),
    [sessions],
  );

  const expiredSessions = useMemo(
    () => getExpiredSessions(sessions, nowTick),
    [sessions, nowTick],
  );

  const upcomingSoon = useMemo(
    () => getUpcomingSoonSessions(upcomingSessions, nowTick),
    [upcomingSessions, nowTick],
  );

  const sentReminders = useRef<Record<string, number[]>>({});

  const notifyUpcomingSoon = async () => {
    const userID = userIDRef.current;
    if (!userID) return;

    for (const studySession of upcomingSoon) {
      const reminderOffsets = studySession.reminderOffsets ?? [];
      if (
        reminderOffsets.length === 0 ||
        studySession.reminderEnabled === false
      ) {
        return;
      }

      const secondsAway = differenceInSeconds(
        parseISO(studySession.scheduledAt),
        nowTick,
      );
      const thresholds = reminderOffsets.map(
        (offsetMinutes) => Math.max(0, offsetMinutes) * 60,
      );

      for (const threshold of thresholds) {
        if (secondsAway <= threshold && secondsAway > threshold - 60) {
          const sentForSession = sentReminders.current[studySession.id] || [];
          if (sentForSession.includes(threshold)) return;

          const minutesLabel = threshold / 60;
          const title = `Study session: ${studySession.title}`;
          const body =
            threshold === 0
              ? "Starting now"
              : `Starts in ${minutesLabel} minute${minutesLabel > 1 ? "s" : ""}`;

          await fetch("/api/web-push/send", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              userID: userID,
              title: title,
              body: body,
              url: `/study/${studySession.id}`,
            }),
          });

          sentReminders.current[studySession.id] = [
            ...(sentReminders.current[studySession.id] || []),
            threshold,
          ];
        }
      }
    }
  };

  useEffect(() => {
    if (!upcomingSoon || upcomingSoon.length === 0) return;
    notifyUpcomingSoon();
  }, [upcomingSoon, nowTick]);

  const openSession = async (studySession: StudySession) => {
    if (studySession.isTimerOnly) {
      const params = new URLSearchParams({
        title: studySession.title,
        focus: String(studySession.focusMinutes),
        break: String(studySession.breakMinutes),
        total: String(studySession.totalMinutes),
      });
      router.push(`/study/quicktimer?${params.toString()}`);
      return;
    }

    router.push(`/study/${studySession.id}`);
  };

  const selectSession = (studySessionId: string) => {
    setSelectedSessionIds((prevIds) =>
      prevIds.includes(studySessionId)
        ? prevIds.filter((id) => id !== studySessionId)
        : [...prevIds, studySessionId],
    );
  };

  const selectAll = (sessionList: StudySession[]) => {
    const sectionIds = sessionList.map((s) => s.id);
    const newSelected = new Set(selectedSessionIds);
    sectionIds.forEach((id) => newSelected.add(id));
    setSelectedSessionIds(Array.from(newSelected));
  };

  const deselectAll = (sessionList: StudySession[]) => {
    const sectionIds = new Set(sessionList.map((s) => s.id));
    setSelectedSessionIds(
      selectedSessionIds.filter((id) => !sectionIds.has(id)),
    );
  };

  const selectedInProgress = inProgressSessions.filter((s) =>
    selectedSessionIds.includes(s.id),
  ).length;
  const selectedUpcoming = upcomingSessions.filter((s) =>
    selectedSessionIds.includes(s.id),
  ).length;
  const selectedCompleted = completedSessions.filter((s) =>
    selectedSessionIds.includes(s.id),
  ).length;
  const selectedExpired = expiredSessions.filter((s) =>
    selectedSessionIds.includes(s.id),
  ).length;

  const allSessions = [
    ...inProgressSessions,
    ...upcomingSessions,
    ...completedSessions,
    ...expiredSessions,
  ];

  const selectAllSessionsGlobal = () => {
    const allIds = allSessions.map((s) => s.id);
    setSelectedSessionIds(allIds);
  };

  const deselectAllSessionsGlobal = () => {
    setSelectedSessionIds([]);
  };

  const markAsDone = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to mark the selected study session(s) as done?",
    );
    if (!confirmed) return;

    try {
      const realSessionIds = selectedSessionIds.filter(
        (id) => !id.startsWith("session-"),
      );

      if (realSessionIds.length > 0) {
        const updatePromises = realSessionIds.map((studySessionId) =>
          fetch(`/api/study/${studySessionId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              status: "completed",
              completed_at: new Date(),
            }),
          }),
        );

        const responses = await Promise.all(updatePromises);
        const allSuccessful = responses.every((res) => res.ok);

        if (!allSuccessful) {
          console.error("Some sessions failed to update");
          return;
        }
      }

      setSessions((prev) =>
        prev.map((studySession) =>
          selectedSessionIds.includes(studySession.id)
            ? { ...studySession, sessionStatus: "completed" }
            : studySession,
        ),
      );
      setSelectedSessionIds([]);

      router.push("/study");
    } catch (error) {
      console.error("Error marking sessions as done:", error);
    }
  };

  const deleteSelected = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete the selected study session?",
    );
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      const deletePromises = selectedSessionIds.map((studySessionId) =>
        fetch(`/api/study/${studySessionId}`, {
          method: "DELETE",
        }),
      );

      const responses = await Promise.all(deletePromises);
      const allSuccessful = responses.every((res) => res.ok);

      if (!allSuccessful) {
        console.error("Some sessions failed to delete");
        return;
      }

      setSessions((prev) =>
        prev.filter(
          (studySession) => !selectedSessionIds.includes(studySession.id),
        ),
      );
      setSelectedSessionIds([]);
    } catch (error) {
      console.error("Error deleting study sessions:", error);
    } finally {
      setIsDeleting(false);
    }
  };

  const createQuickTimer = () => {
    if (quickFocusMinutes < 1 || quickBreakMinutes < 1 || quickTotalMinutes < 1)
      return;

    const newStudySession: StudySession = {
      id: `session-${Date.now()}`,
      title: quickTitle.trim() || "Timer Only",
      notes: "",
      attachments: [],
      scheduledAt: new Date().toISOString(),
      focusMinutes: Math.max(1, Number(quickFocusMinutes) || 25),
      breakMinutes: Math.max(1, Number(quickBreakMinutes) || 5),
      totalMinutes: Math.max(1, Number(quickTotalMinutes) || 60),
      sessionStatus: "idle",
      createdAt: new Date().toISOString(),
      isTimerOnly: true,
    };

    setSessions((prev) => [newStudySession, ...prev]);
    setQuickTitle("");
    setQuickFocusMinutes(25);
    setQuickBreakMinutes(5);
    setQuickTotalMinutes(60);
  };

  return (
    <>
      <StudySelectionToolbar
        selectedCount={selectedSessionIds.length}
        allCount={allSessions.length}
        isDeleting={isDeleting}
        canEdit={selectedSessionIds.length === 1}
        onSelectAll={selectAllSessionsGlobal}
        onDeselectAll={deselectAllSessionsGlobal}
        onEditSelected={() => {
          const studySessionId = selectedSessionIds[0];
          router.push(`/study/${studySessionId}/edit`);
        }}
        onMarkDone={markAsDone}
        onDeleteSelected={deleteSelected}
      />

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <StudySessionListCard
            sectionType="in-progress"
            title="In Progress"
            titleClassName="font-display text-base font-bold tracking-wide text-amber-600 dark:text-amber-400"
            cardClassName="bg-card/80 backdrop-blur-sm border-amber-500/40 border-2"
            sessions={inProgressSessions}
            selectedSessionIds={selectedSessionIds}
            selectedCount={selectedInProgress}
            onSelectAll={() => selectAll(inProgressSessions)}
            onDeselectAll={() => deselectAll(inProgressSessions)}
            onSelectSession={selectSession}
            onOpenSession={openSession}
          />

          <StudySessionListCard
            sectionType="upcoming"
            title="Upcoming Sessions"
            sessions={upcomingSessions}
            selectedSessionIds={selectedSessionIds}
            selectedCount={selectedUpcoming}
            onSelectAll={() => selectAll(upcomingSessions)}
            onDeselectAll={() => deselectAll(upcomingSessions)}
            onSelectSession={selectSession}
            onOpenSession={openSession}
          />

          <StudySessionListCard
            sectionType="completed"
            title="Completed Sessions"
            titleClassName="font-display text-base font-bold tracking-wide text-green-600 dark:text-green-400"
            sessions={completedSessions}
            selectedSessionIds={selectedSessionIds}
            selectedCount={selectedCompleted}
            onSelectAll={() => selectAll(completedSessions)}
            onDeselectAll={() => deselectAll(completedSessions)}
            onSelectSession={selectSession}
          />

          <StudySessionListCard
            sectionType="expired"
            title="Expired Sessions"
            titleClassName="font-display text-base font-bold tracking-wide text-orange-600 dark:text-orange-400"
            sessions={expiredSessions}
            selectedSessionIds={selectedSessionIds}
            selectedCount={selectedExpired}
            onSelectAll={() => selectAll(expiredSessions)}
            onDeselectAll={() => deselectAll(expiredSessions)}
            onSelectSession={selectSession}
          />
        </div>

        <div className="space-y-6">
          <StudyQuickTimerCard
            quickTitle={quickTitle}
            quickFocusMinutes={quickFocusMinutes}
            quickBreakMinutes={quickBreakMinutes}
            quickTotalMinutes={quickTotalMinutes}
            onQuickTitleChange={setQuickTitle}
            onQuickFocusMinutesChange={setQuickFocusMinutes}
            onQuickBreakMinutesChange={setQuickBreakMinutes}
            onQuickTotalMinutesChange={setQuickTotalMinutes}
            onCreateQuickTimer={createQuickTimer}
          />

          <StudyUpcomingRemindersCard upcomingSoon={upcomingSoon} />
        </div>
      </div>
    </>
  );
}
