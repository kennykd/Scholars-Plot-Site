"use client";

import { useEffect, useMemo, useState, useRef } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Bell, Plus } from "lucide-react";
import {
  addMinutes,
  differenceInHours,
  differenceInMinutes,
  differenceInSeconds,
  format,
  formatDistanceToNow,
  isAfter,
  isBefore,
  parseISO,
} from "date-fns";
import { StudySession } from "@/types";
import { getSession } from "@/lib/firebase/auth";

const STORAGE_KEY = "scholarsPlot.studySessions";

export default function StudyPage() {
  const router = useRouter();
  const userIDRef = useRef<string | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [loading, setLoading] = useState(true);
  const [nowTick, setNowTick] = useState(new Date());
  const [quickTitle, setQuickTitle] = useState("");
  const [quickFocusMinutes, setQuickFocusMinutes] = useState(25);
  const [quickBreakMinutes, setQuickBreakMinutes] = useState(5);
  const [quickTotalMinutes, setQuickTotalMinutes] = useState(60);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  // Fetch the user's study session data from the API route /study
  useEffect(() => {
    const fetchSessions = async () => {
      try {
        setLoading(true);

        // Load available data from localStorage (caching)
        const stored = localStorage.getItem(STORAGE_KEY);
        if (stored) {
          setSessions(JSON.parse(stored)); // Show cached data immediately
        }

        const response = await fetch("/api/study");
        const data = await response.json();

        if (!response.ok) {
          console.error("Failed to fetch sessions:", data.message);
          setSessions([]);
          return;
        }

        // Transform API response to local format
        const transformedSessions: StudySession[] = data.studySessions.map(
          (studySession: any) => ({
            id: studySession.study_session_id.toString(),
            title: studySession.study_session_name,
            notes: studySession.study_session_description || "",
            attachments: [], // TODO: handle attachments
            scheduledAt: studySession.study_session_scheduled_at,
            focusMinutes: studySession.focus_minutes,
            breakMinutes: studySession.break_minutes,
            totalMinutes: studySession.total_minutes,
            sessionStatus: studySession.study_session_user[0]?.status || "idle",
            createdAt: studySession.study_session_created_at,
            isTimerOnly: false,
          }),
        );

        setSessions(transformedSessions);
      } catch (error) {
        console.error("Error fetching study sessions:", error);
        setSessions([]);
      } finally {
        setLoading(false);
        setHydrated(true);
      }
    };

    fetchSessions();
  }, []);

  // Write the study session metadata into localstorage for caching
  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [hydrated, sessions]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // Fetch the user and store it in Ref, this is for getting userID data for notifications
  useEffect(() => {
    const fetchUser = async () => {
      const session = await getSession();
      userIDRef.current = session?.id ?? null;
    };
    fetchUser();
  }, []);

  const inProgressSessions = useMemo(
    () =>
      sessions
        .filter((studySession) => {
          if (
            studySession.sessionStatus !== "running" &&
            studySession.sessionStatus !== "paused"
          ) {
            return false;
          }

          // Exclude sessions that are 24+ hours old (they should expire)
          const scheduledTime = parseISO(studySession.scheduledAt);
          const hoursPassed = differenceInHours(nowTick, scheduledTime);
          return hoursPassed < 24;
        })
        .sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() -
            new Date(b.scheduledAt).getTime(),
        ),
    [sessions, nowTick],
  );

  // Configure the upcoming sessions
  const upcomingSessions = useMemo(
    () =>
      sessions
        .filter((studySession) => {
          if (
            studySession.sessionStatus !== "completed" &&
            studySession.sessionStatus === "idle"
          ) {
            // Timer-only sessions always show as upcoming
            if (studySession.isTimerOnly) return true;

            // Regular sessions show as upcoming if it is
            // Before their scheduled time, OR
            // Within 15 minutes after their scheduled time (grace period)
            const scheduledTime = parseISO(studySession.scheduledAt);
            return isAfter(scheduledTime, addMinutes(nowTick, -15));
          }
          return false;
        })
        .sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() -
            new Date(b.scheduledAt).getTime(),
        ),
    [sessions, nowTick],
  );

  const completedSessions = useMemo(
    () =>
      sessions
        .filter((studySession) => studySession.sessionStatus === "completed")
        .sort(
          (a, b) =>
            new Date(b.scheduledAt).getTime() -
            new Date(a.scheduledAt).getTime(),
        ),
    [sessions],
  );

  // TODO: Place the grace periods and expired time after start in the settings
  // Expired sessions: idle sessions 15+ minutes past their time, or running/paused sessions 24+ hours old
  const expiredSessions = useMemo(
    () =>
      sessions
        .filter((studySession) => {
          if (
            studySession.sessionStatus === "completed" ||
            studySession.isTimerOnly
          ) {
            return false;
          }

          const scheduledTime = parseISO(studySession.scheduledAt);

          // Idle sessions expire 15 minutes after scheduled time (with grace period)
          if (studySession.sessionStatus === "idle") {
            return isBefore(scheduledTime, addMinutes(nowTick, -15));
          }

          // Running/paused sessions expire after 24 hours
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
            new Date(b.scheduledAt).getTime() -
            new Date(a.scheduledAt).getTime(),
        ),
    [sessions, nowTick],
  );

  // This is for the upcoming soon reminders, not yet a notification!
  const upcomingSoon = useMemo(
    () =>
      upcomingSessions.filter((studySession) => {
        if (studySession.isTimerOnly) return false;
        const minutesAway = differenceInMinutes(
          parseISO(studySession.scheduledAt),
          nowTick,
        );
        return minutesAway >= 0 && minutesAway <= 60;
      }),
    [upcomingSessions, nowTick],
  );

  const sentReminders = useRef<Record<string, number[]>>({});

  // Notification of the study session reminders
  const notifyUpcomingSoon = async () => {
    // The times where the study session reminders will give notifications to the user: 15min, 5min, now
    const thresholds = [15 * 60, 5 * 60, 0]; // times 60 to get seconds presicion

    // Check if userID already exist and stored in Ref
    const userID = userIDRef.current;
    if (!userID) return;

    upcomingSoon.forEach(async (studySession) => {
      const secondsAway = differenceInSeconds(
        parseISO(studySession.scheduledAt),
        nowTick,
      );

      for (const threshold of thresholds) {
        // Match within a 1-second window to avoid missing the exact moment
        if (secondsAway >= threshold && secondsAway < threshold + 1) {
          const sentForSession = sentReminders.current[studySession.id] || [];
          if (sentForSession.includes(threshold)) return;

          const minutesLabel = threshold / 60;
          const title = `Study session: ${studySession.title}`;
          const body =
            threshold === 0
              ? `Starting now`
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
    });
  };

  // Trigger reminders whenever upcomingSoon or nowTick changes
  useEffect(() => {
    if (!upcomingSoon || upcomingSoon.length === 0) return;
    notifyUpcomingSoon();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [upcomingSoon, nowTick]);

  const openSession = async (studySession: StudySession) => {
    // Simply navigate to the timer page. The timer will remain paused until
    // the user clicks resume in the timer page.
    if (studySession.isTimerOnly) {
      // Quick timers navigate to dedicated quick timer route with params
      const params = new URLSearchParams({
        title: studySession.title,
        focus: String(studySession.focusMinutes),
        break: String(studySession.breakMinutes),
        total: String(studySession.totalMinutes),
      });
      router.push(`/study/quicktimer?${params.toString()}`);
      return;
    }

    // Navigate to timer page without changing status
    router.push(`/study/${studySession.id}`);
  };

  const selectSession = (studySessionId: string) => {
    setSelectedSessionIds((prevIds) =>
      prevIds.includes(studySessionId)
        ? prevIds.filter((id) => id !== studySessionId)
        : [...prevIds, studySessionId],
    );
  };

  // Helper functions for section-specific select/deselect
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

  // Calculate selected count in each section
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

  // All sessions combined
  const allSessions = [
    ...inProgressSessions,
    ...upcomingSessions,
    ...completedSessions,
    ...expiredSessions,
  ];

  // Select/deselect all sessions across all categories
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
      // Separate real sessions from quick timers
      const realSessionIds = selectedSessionIds.filter(
        (id) => !id.startsWith("session-"),
      );
      const quickTimerIds = selectedSessionIds.filter((id) =>
        id.startsWith("session-"),
      );

      // Update database status only for real sessions
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

      // Update local state for all selected sessions (real + quick timers)
      setSessions((prev) =>
        prev.map((studySession) =>
          selectedSessionIds.includes(studySession.id)
            ? { ...studySession, sessionStatus: "completed" }
            : studySession,
        ),
      );
      setSelectedSessionIds([]);

      // Redirect to study session dashboard
      router.push(`/study`);
    } catch (error) {
      console.error("Error marking sessions as done:", error);
    }
  };

  const deleteSelected = async () => {
    try {
      setIsDeleting(true);
      // Delete each selected session(s) via the API route study/[id]
      const deletePromises = selectedSessionIds.map((studySessionId) =>
        fetch(`/api/study/${studySessionId}`, {
          method: "DELETE",
        }),
      );

      // the response could be from multiple instances of study sessions
      const responses = await Promise.all(deletePromises);

      // check if all the deletion is sucessfull
      const allSuccessful = responses.every((res) => res.ok);

      if (!allSuccessful) {
        console.error("Some sessions failed to delete");
        return;
      }

      // Remove deleted sessions from local state
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
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            STUDY SESSIONS
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">
            UPCOMING STUDY PLAN
          </p>
        </div>
        <div className="flex gap-2">
          <Button
            asChild
            className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
          >
            <Link href="/study/new">
              <Plus className="h-4 w-4 mr-1" /> New Session
            </Link>
          </Button>
        </div>
      </div>

      {selectedSessionIds.length > 0 && (
        <div className="sticky top-2 z-20 flex flex-wrap gap-2 rounded-lg border border-accent bg-accent/50 px-4 py-3 shadow-md">
          <p className="text-sm font-medium text-foreground self-center">
            {selectedSessionIds.length} session
            {selectedSessionIds.length > 1 ? "s" : ""} selected
          </p>
          <div className="flex gap-2">
            {selectedSessionIds.length < allSessions.length && (
              <Button
                size="sm"
                variant="outline"
                onClick={selectAllSessionsGlobal}
                className="font-semibold"
              >
                Select All
              </Button>
            )}
            {selectedSessionIds.length > 0 && (
              <Button
                size="sm"
                variant="outline"
                onClick={deselectAllSessionsGlobal}
                className="font-semibold"
              >
                Deselect All
              </Button>
            )}
          </div>
          <div className="ml-auto flex gap-2">
            {selectedSessionIds.length === 1 && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  const studySessionId = selectedSessionIds[0];
                  router.push(`/study/${studySessionId}/edit`);
                }}
                className="font-semibold"
              >
                Edit Study Session
              </Button>
            )}
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white font-semibold"
              onClick={markAsDone}
            >
              Mark as Done
            </Button>
            <Button
              size="sm"
              variant="destructive"
              onClick={deleteSelected}
              disabled={isDeleting}
              className="font-semibold"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </Button>
          </div>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {/* IN PROGRESS SESSIONS */}
          {inProgressSessions.length > 0 && (
            <Card className="bg-card/80 backdrop-blur-sm border-amber-500/40 border-2">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="font-display text-base font-bold tracking-wide text-amber-600 dark:text-amber-400">
                  In Progress
                </CardTitle>
                <div className="flex gap-2">
                  {selectedInProgress < inProgressSessions.length && (
                    <Button
                      size="sm"
                      onClick={() => selectAll(inProgressSessions)}
                      className="font-semibold text-xs"
                    >
                      Select All
                    </Button>
                  )}
                  {selectedInProgress > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deselectAll(inProgressSessions)}
                      className="font-semibold text-xs"
                    >
                      Deselect All
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {inProgressSessions.map((studySession) => (
                  <div
                    key={studySession.id}
                    className={`flex flex-col gap-3 rounded-lg border-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between transition-colors ${
                      selectedSessionIds.includes(studySession.id)
                        ? "border-red-500/50 bg-red-500/15"
                        : "border-amber-500/30 bg-amber-500/10"
                    }`}
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">
                        {studySession.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {studySession.isTimerOnly
                          ? "Timer in progress"
                          : format(parseISO(studySession.scheduledAt), "PPP p")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="font-mono text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300">
                          {studySession.sessionStatus.charAt(0).toUpperCase() +
                            studySession.sessionStatus.slice(1)}
                        </Badge>
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px]"
                        >
                          {studySession.focusMinutes}m /{" "}
                          {studySession.breakMinutes}m
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          Total {studySession.totalMinutes}m
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => openSession(studySession)}
                        className="bg-amber-600 hover:bg-amber-700 text-white"
                      >
                        Open Timer
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => selectSession(studySession.id)}
                      >
                        {selectedSessionIds.includes(studySession.id)
                          ? "Undo Select"
                          : "Select"}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-3 flex flex-row items-center justify-between">
              <CardTitle className="font-display text-base font-bold tracking-wide">
                Upcoming Sessions
              </CardTitle>
              <div className="flex gap-2">
                {selectedUpcoming < upcomingSessions.length && (
                  <Button
                    size="sm"
                    onClick={() => selectAll(upcomingSessions)}
                    className="font-semibold text-xs"
                  >
                    Select All
                  </Button>
                )}
                {selectedUpcoming > 0 && (
                  <Button
                    size="sm"
                    onClick={() => deselectAll(upcomingSessions)}
                    variant="outline"
                    className="font-semibold text-xs"
                  >
                    Deselect All
                  </Button>
                )}
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {loading ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  Loading study sessions...
                </p>
              ) : upcomingSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No upcoming sessions. Schedule one to get started.
                </p>
              ) : (
                upcomingSessions.slice(0, 8).map((studySession) => (
                  <div
                    key={studySession.id}
                    className={`flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between transition-colors ${
                      selectedSessionIds.includes(studySession.id)
                        ? "border-red-500/50 bg-red-500/15"
                        : "border-border/40 bg-muted/20"
                    }`}
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">
                        {studySession.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {studySession.isTimerOnly
                          ? "Ready to start"
                          : format(parseISO(studySession.scheduledAt), "PPP p")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="font-mono text-[10px] bg-blue-500/20 text-blue-700 dark:text-blue-300">
                          Upcoming
                        </Badge>
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px]"
                        >
                          {studySession.focusMinutes}m /{" "}
                          {studySession.breakMinutes}m
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          Total {studySession.totalMinutes}m
                        </Badge>
                        {studySession.attachments.length > 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            {studySession.attachments.length} attachment
                            {studySession.attachments.length > 1 ? "s" : ""}
                          </Badge>
                        )}
                        {studySession.notes && (
                          <Badge variant="secondary" className="text-[10px]">
                            Notes
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => openSession(studySession)}
                        className="bg-accent hover:bg-accent/90 text-accent-foreground"
                      >
                        Start
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => selectSession(studySession.id)}
                      >
                        {selectedSessionIds.includes(studySession.id)
                          ? "Undo Select"
                          : "Select"}
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
          {/* COMPLETED SESSIONS */}
          {completedSessions.length > 0 && (
            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="font-display text-base font-bold tracking-wide text-green-600 dark:text-green-400">
                  Completed Sessions
                </CardTitle>
                <div className="flex gap-2">
                  {selectedCompleted < completedSessions.length && (
                    <Button
                      size="sm"
                      onClick={() => selectAll(completedSessions)}
                      className="font-semibold text-xs"
                    >
                      Select All
                    </Button>
                  )}
                  {selectedCompleted > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deselectAll(completedSessions)}
                      className="font-semibold text-xs"
                    >
                      Deselect All
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {completedSessions.slice(0, 8).map((studySession) => (
                  <div
                    key={studySession.id}
                    className={`flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between transition-colors ${
                      selectedSessionIds.includes(studySession.id)
                        ? "border-red-500/50 bg-red-500/15"
                        : "border-green-500/20 bg-green-500/5"
                    }`}
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">
                        {studySession.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {studySession.isTimerOnly
                          ? "Completed"
                          : format(parseISO(studySession.scheduledAt), "PPP p")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="font-mono text-[10px] bg-green-500/20 text-green-700 dark:text-green-300">
                          Completed
                        </Badge>
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px]"
                        >
                          {studySession.focusMinutes}m /{" "}
                          {studySession.breakMinutes}m
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          Total {studySession.totalMinutes}m
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => selectSession(studySession.id)}
                      >
                        {selectedSessionIds.includes(studySession.id)
                          ? "Undo Select"
                          : "Select"}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
          {/* EXPIRED SESSIONS */}
          {expiredSessions.length > 0 && (
            <Card className="bg-card/80 backdrop-blur-sm border-border/50">
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="font-display text-base font-bold tracking-wide text-orange-600 dark:text-orange-400">
                  Expired Sessions
                </CardTitle>
                <div className="flex gap-2">
                  {selectedExpired < expiredSessions.length && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => selectAll(expiredSessions)}
                      className="font-semibold text-xs"
                    >
                      Select All
                    </Button>
                  )}
                  {selectedExpired > 0 && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => deselectAll(expiredSessions)}
                      className="font-semibold text-xs"
                    >
                      Deselect All
                    </Button>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                {expiredSessions.slice(0, 8).map((studySession) => (
                  <div
                    key={studySession.id}
                    className={`flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between transition-colors ${
                      selectedSessionIds.includes(studySession.id)
                        ? "border-red-500/50 bg-red-500/15"
                        : "border-orange-500/20 bg-orange-500/5"
                    }`}
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">
                        {studySession.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {studySession.isTimerOnly
                          ? "Expired"
                          : format(parseISO(studySession.scheduledAt), "PPP p")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge className="font-mono text-[10px] bg-orange-500/20 text-orange-700 dark:text-orange-300">
                          Expired
                        </Badge>
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px]"
                        >
                          {studySession.focusMinutes}m /{" "}
                          {studySession.breakMinutes}m
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          Total {studySession.totalMinutes}m
                        </Badge>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => selectSession(studySession.id)}
                      >
                        {selectedSessionIds.includes(studySession.id)
                          ? "Undo Select"
                          : "Select"}
                      </Button>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}{" "}
        </div>

        <div className="space-y-6">
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base font-bold tracking-wide">
                Quick Timer
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label className="font-mono text-xs tracking-wider">
                  TITLE
                </Label>
                <Input
                  placeholder="Timer only"
                  value={quickTitle}
                  onChange={(e) => setQuickTitle(e.target.value)}
                />
              </div>
              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5">
                  <Label className="font-mono text-xs tracking-wider">
                    FOCUS MINUTES
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={quickFocusMinutes}
                    onChange={(e) =>
                      setQuickFocusMinutes(Number(e.target.value))
                    }
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="font-mono text-xs tracking-wider">
                    BREAK MINUTES
                  </Label>
                  <Input
                    type="number"
                    min={1}
                    value={quickBreakMinutes}
                    onChange={(e) =>
                      setQuickBreakMinutes(Number(e.target.value))
                    }
                  />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label className="font-mono text-xs tracking-wider">
                  TOTAL MINUTES
                </Label>
                <Input
                  type="number"
                  min={1}
                  value={quickTotalMinutes}
                  onChange={(e) => setQuickTotalMinutes(Number(e.target.value))}
                />
              </div>
              <Button
                onClick={createQuickTimer}
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
              >
                Add Timer
              </Button>
            </CardContent>
          </Card>

          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base font-bold tracking-wide flex items-center gap-2">
                <Bell className="h-4 w-4 text-accent" />
                Upcoming Reminders
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingSoon.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No study sessions starting within the next hour.
                </p>
              ) : (
                upcomingSoon.map((studySession) => (
                  <div
                    key={studySession.id}
                    className="rounded-lg border border-accent/20 bg-accent/10 px-4 py-3"
                  >
                    <p className="font-medium text-foreground">
                      {studySession.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Starts{" "}
                      {formatDistanceToNow(parseISO(studySession.scheduledAt), {
                        addSuffix: true,
                      })}
                    </p>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
