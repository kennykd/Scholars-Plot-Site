"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  differenceInSeconds,
  format,
  formatDistanceToNow,
  parseISO,
} from "date-fns";
import { Bell, ChevronRight, Timer } from "lucide-react";
import type { StudySession } from "@/types";
import { useAuth } from "@/lib/firebase/auth-context";
import {
  getCompletedSessions,
  getExpiredSessions,
  getInProgressSessions,
  getUpcomingSessions,
  getUpcomingSoonSessions,
} from "@/lib/study/study-session-helper";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { StudySelectionToolbar } from "@/app/components/study/study-selection-toolbar";
import { StudyQuickTimerCard } from "@/app/components/study/study-quick-timer-card";

type StudyPageClientProps = {
  initialSessions: StudySession[];
};

type StudySectionType = "in-progress" | "upcoming" | "completed" | "expired";
type StudyFilter = "all" | StudySectionType;
type StudySort = "scheduled" | "status";

type StudySessionRow = {
  session: StudySession;
  sectionType: StudySectionType;
};

const FILTERS: Array<{ value: StudyFilter; label: string }> = [
  { value: "all", label: "All" },
  { value: "in-progress", label: "In Progress" },
  { value: "upcoming", label: "Upcoming" },
  { value: "completed", label: "Completed" },
  { value: "expired", label: "Expired" },
];

const STATUS_ORDER: Record<StudySectionType, number> = {
  "in-progress": 0,
  upcoming: 1,
  completed: 2,
  expired: 3,
};

function getStatusBadge(sectionType: StudySectionType, session: StudySession) {
  if (sectionType === "in-progress") {
    return {
      label:
        session.sessionStatus.charAt(0).toUpperCase() +
        session.sessionStatus.slice(1),
      className:
        "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/20",
    };
  }

  if (sectionType === "completed") {
    return {
      label: "Completed",
      className:
        "bg-green-500/15 text-green-700 dark:text-green-300 border-green-500/20",
    };
  }

  if (sectionType === "expired") {
    return {
      label: "Expired",
      className:
        "bg-orange-500/15 text-orange-700 dark:text-orange-300 border-orange-500/20",
    };
  }

  return {
    label: "Upcoming",
    className:
      "bg-blue-500/15 text-blue-700 dark:text-blue-300 border-blue-500/20",
  };
}

function getRowAccent(sectionType: StudySectionType) {
  if (sectionType === "in-progress") return "border-l-amber-500";
  if (sectionType === "completed") return "border-l-green-500";
  if (sectionType === "expired") return "border-l-orange-500";
  return "border-l-accent";
}

function getActionLabel(sectionType: StudySectionType) {
  if (sectionType === "in-progress") return "Open";
  if (sectionType === "upcoming") return "Start";
  return "Open";
}

function buildRows(
  inProgressSessions: StudySession[],
  upcomingSessions: StudySession[],
  completedSessions: StudySession[],
  expiredSessions: StudySession[],
) {
  const rows: StudySessionRow[] = [];
  const seen = new Set<string>();
  const pushRows = (sectionType: StudySectionType, items: StudySession[]) => {
    for (const session of items) {
      if (seen.has(session.id)) continue;
      seen.add(session.id);
      rows.push({ session, sectionType });
    }
  };

  pushRows("in-progress", inProgressSessions);
  pushRows("upcoming", upcomingSessions);
  pushRows("completed", completedSessions);
  pushRows("expired", expiredSessions);

  return rows;
}

export function StudyPageClient({ initialSessions }: StudyPageClientProps) {
  const router = useRouter();
  const userIDRef = useRef<string | null>(null);
  const [sessions, setSessions] = useState<StudySession[]>(initialSessions);
  const [nowTick, setNowTick] = useState(new Date());
  const [quickTimerOpen, setQuickTimerOpen] = useState(false);
  const [quickTitle, setQuickTitle] = useState("");
  const [quickFocusMinutes, setQuickFocusMinutes] = useState(25);
  const [quickBreakMinutes, setQuickBreakMinutes] = useState(5);
  const [quickTotalMinutes, setQuickTotalMinutes] = useState(60);
  const [selectedSessionIds, setSelectedSessionIds] = useState<string[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);
  const [filter, setFilter] = useState<StudyFilter>("all");
  const [sortMode, setSortMode] = useState<StudySort>("scheduled");

  useEffect(() => {
    setSessions(initialSessions);
  }, [initialSessions]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(new Date());
    }, 1000);

    return () => clearInterval(interval);
  }, []);

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

  const allRows = useMemo(
    () =>
      buildRows(
        inProgressSessions,
        upcomingSessions,
        completedSessions,
        expiredSessions,
      ),
    [inProgressSessions, upcomingSessions, completedSessions, expiredSessions],
  );

  const visibleRows = useMemo(() => {
    const filtered =
      filter === "all"
        ? allRows
        : allRows.filter((row) => row.sectionType === filter);

    return [...filtered].sort((a, b) => {
      if (sortMode === "status") {
        const statusDiff =
          STATUS_ORDER[a.sectionType] - STATUS_ORDER[b.sectionType];
        if (statusDiff !== 0) return statusDiff;
      }

      return (
        new Date(a.session.scheduledAt).getTime() -
        new Date(b.session.scheduledAt).getTime()
      );
    });
  }, [allRows, filter, sortMode]);

  const sentReminders = useRef<Record<string, number[]>>({});

  const notifyUpcomingSoon = useCallback(async () => {
    const userID = userIDRef.current;
    if (!userID) return;

    for (const studySession of upcomingSoon) {
      const reminderOffsets = studySession.reminderOffsets ?? [];
      if (
        reminderOffsets.length === 0 ||
        studySession.reminderEnabled === false
      ) {
        continue;
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
          if (sentForSession.includes(threshold)) continue;

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
              userID,
              title,
              body,
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
  }, [nowTick, upcomingSoon]);

  useEffect(() => {
    if (!upcomingSoon || upcomingSoon.length === 0) return;
    notifyUpcomingSoon();
  }, [notifyUpcomingSoon, upcomingSoon]);

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

  const selectVisibleSessions = () => {
    setSelectedSessionIds(visibleRows.map((row) => row.session.id));
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
    setQuickTimerOpen(false);
  };

  return (
    <>
      <StudySelectionToolbar
        selectedCount={selectedSessionIds.length}
        allCount={visibleRows.length}
        isDeleting={isDeleting}
        canEdit={selectedSessionIds.length === 1}
        onSelectAll={selectVisibleSessions}
        onDeselectAll={deselectAllSessionsGlobal}
        onEditSelected={() => {
          const studySessionId = selectedSessionIds[0];
          router.push(`/study/${studySessionId}/edit`);
        }}
        onMarkDone={markAsDone}
        onDeleteSelected={deleteSelected}
      />

      <div className="space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <Tabs
            value={filter}
            onValueChange={(value) => setFilter(value as StudyFilter)}
          >
            <TabsList className="flex-wrap justify-start h-auto">
              {FILTERS.map((item) => (
                <TabsTrigger key={item.value} value={item.value}>
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>

          <div className="flex flex-wrap items-center gap-2">
            {visibleRows.length > 0 && (
              <Button
                type="button"
                variant="outline"
                onClick={selectVisibleSessions}
                className="font-semibold"
              >
                Select All
              </Button>
            )}
            <Select
              value={sortMode}
              onValueChange={(value) => setSortMode(value as StudySort)}
            >
              <SelectTrigger className="w-[198px] font-mono text-sm">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled (Soonest)</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={quickTimerOpen} onOpenChange={setQuickTimerOpen}>
              <DialogTrigger asChild>
                <Button type="button" className="gap-2 font-semibold">
                  <Timer className="h-4 w-4" />
                  Quick Timer
                </Button>
              </DialogTrigger>
              <DialogContent className="p-0 sm:max-w-md">
                <DialogTitle className="sr-only">Quick Timer</DialogTitle>
                <DialogDescription className="sr-only">
                  Create a timer-only study session.
                </DialogDescription>
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
              </DialogContent>
            </Dialog>
          </div>
        </div>

        <div className="flex flex-col gap-3 rounded-lg border border-border/60 bg-card/80 px-4 py-3 shadow-sm sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Bell className="h-4 w-4 text-accent" />
            <p className="font-display text-sm font-bold">
              Upcoming Reminders
            </p>
          </div>
          {upcomingSoon.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              No study reminders are due soon.
            </p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {upcomingSoon.map((studySession) => (
                <button
                  key={studySession.id}
                  type="button"
                  onClick={() => openSession(studySession)}
                  className="rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-left text-xs hover:bg-accent/15"
                >
                  <span className="font-medium text-foreground">
                    Reminder: {studySession.title}
                  </span>{" "}
                  <span className="text-muted-foreground">
                    {formatDistanceToNow(parseISO(studySession.scheduledAt), {
                      addSuffix: true,
                    })}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-2">
          {visibleRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-card/70 px-4 py-8 text-sm text-muted-foreground">
              No study sessions found.
            </div>
          ) : (
            visibleRows.map(({ session, sectionType }) => {
              const isSelected = selectedSessionIds.includes(session.id);
              const statusBadge = getStatusBadge(sectionType, session);

              return (
                <div
                  key={session.id}
                  className={cn(
                    "grid grid-cols-[auto_1fr_auto] items-center gap-3 rounded-lg border border-l-4 bg-card px-4 py-3 shadow-sm transition-colors hover:bg-muted/20",
                    getRowAccent(sectionType),
                    isSelected && "border-accent bg-accent/10",
                  )}
                >
                  <Checkbox
                    aria-label={`Select ${session.title}`}
                    checked={isSelected}
                    onCheckedChange={() => selectSession(session.id)}
                  />

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate font-semibold text-foreground">
                        {session.title}
                      </p>
                      <Badge variant="outline" className="font-mono text-[10px]">
                        {format(parseISO(session.scheduledAt), "MMM d")}
                      </Badge>
                    </div>
                    <div className="mt-1 flex flex-wrap gap-2">
                      <Badge
                        variant="outline"
                        className={cn(
                          "font-mono text-[10px]",
                          statusBadge.className,
                        )}
                      >
                        {statusBadge.label}
                      </Badge>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        {session.focusMinutes}m / {session.breakMinutes}m
                      </Badge>
                      <Badge variant="secondary" className="font-mono text-[10px]">
                        Total {session.totalMinutes}m
                      </Badge>
                      {session.notes && (
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          Notes
                        </Badge>
                      )}
                      {session.attachments.length > 0 && (
                        <Badge variant="secondary" className="font-mono text-[10px]">
                          {session.attachments.length} attachment
                          {session.attachments.length > 1 ? "s" : ""}
                        </Badge>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {format(parseISO(session.scheduledAt), "PPP p")}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      onClick={() => openSession(session)}
                      className="bg-accent text-accent-foreground hover:bg-accent/90"
                    >
                      {getActionLabel(sectionType)}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Open ${session.title}`}
                      onClick={() => openSession(session)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </>
  );
}
