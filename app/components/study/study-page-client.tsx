"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  differenceInSeconds,
  format,
  isToday,
  isTomorrow,
  parseISO,
} from "date-fns";
import { ChevronRight, Timer } from "lucide-react";
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
import { StudySelectionToolbar } from "@/app/components/study/study-selection-toolbar";
import { StudyQuickTimerCard } from "@/app/components/study/study-quick-timer-card";

type StudyPageClientProps = {
  initialSessions: StudySession[];
};

type StudySectionType = "in-progress" | "upcoming" | "completed" | "expired";
type StudySort = "scheduled" | "status";

type StudySessionRow = {
  session: StudySession;
  sectionType: StudySectionType;
};

const STUDY_SECTIONS: Array<{
  value: StudySectionType;
  label: string;
  dotClassName: string;
}> = [
  {
    value: "in-progress",
    label: "In Progress",
    dotClassName: "bg-amber-500",
  },
  {
    value: "upcoming",
    label: "Upcoming",
    dotClassName: "bg-blue-500",
  },
  {
    value: "completed",
    label: "Completed",
    dotClassName: "bg-green-500",
  },
  {
    value: "expired",
    label: "Expired",
    dotClassName: "bg-red-500",
  },
];

const DEFAULT_VISIBLE_SECTIONS = STUDY_SECTIONS.map((section) => section.value);

const STATUS_ORDER: Record<StudySectionType, number> = {
  "in-progress": 0,
  upcoming: 1,
  completed: 2,
  expired: 3,
};

const SENT_REMINDERS_STORAGE_KEY = "scholars-plot:sent-study-reminders";

function readStoredReminderKeys() {
  if (typeof window === "undefined") return new Set<string>();

  try {
    const raw = window.localStorage.getItem(SENT_REMINDERS_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set<string>(Array.isArray(parsed) ? parsed.filter(Boolean) : []);
  } catch {
    return new Set<string>();
  }
}

function persistReminderKeys(keys: Set<string>) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(
    SENT_REMINDERS_STORAGE_KEY,
    JSON.stringify([...keys]),
  );
}

function getReminderKey(
  studySession: StudySession,
  thresholdSeconds: number,
) {
  return `${studySession.id}:${studySession.scheduledAt}:${thresholdSeconds}`;
}

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
  if (sectionType === "expired") return "border-l-red-500";
  return "border-l-accent";
}

function getScheduleBadge(date: Date, sectionType: StudySectionType) {
  // Only the Expired section gets the red "Expired" badge — an in-progress row
  // whose scheduled time has passed should not be mislabeled as expired.
  if (sectionType === "expired") {
    return {
      label: "Expired",
      className: "bg-red-500/20 text-red-400 border-red-500/30",
    };
  }
  if (isToday(date)) {
    return {
      label: "Today",
      className: "bg-orange-500/20 text-orange-400 border-orange-500/30",
    };
  }
  if (isTomorrow(date)) {
    return {
      label: "Tomorrow",
      className: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30",
    };
  }
  return {
    label: format(date, "MMM d"),
    className: "bg-muted text-muted-foreground border-border",
  };
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

function sortStudyRows(rows: StudySessionRow[], sortMode: StudySort) {
  return [...rows].sort((a, b) => {
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
  const [visibleSectionTypes, setVisibleSectionTypes] =
    useState<StudySectionType[]>(DEFAULT_VISIBLE_SECTIONS);
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
    () => getInProgressSessions(sessions),
    [sessions],
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

  const groupedRows = useMemo(
    () =>
      STUDY_SECTIONS.map((section) => ({
        ...section,
        rows: sortStudyRows(
          allRows.filter((row) => row.sectionType === section.value),
          sortMode,
        ),
      })),
    [allRows, sortMode],
  );

  const visibleGroups = useMemo(
    () =>
      groupedRows.filter(
        (group) =>
          visibleSectionTypes.includes(group.value) && group.rows.length > 0,
      ),
    [groupedRows, visibleSectionTypes],
  );

  const visibleRows = useMemo(
    () => visibleGroups.flatMap((group) => group.rows),
    [visibleGroups],
  );

  const sentReminders = useRef<Set<string>>(new Set());

  useEffect(() => {
    sentReminders.current = readStoredReminderKeys();
  }, []);

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
          const reminderKey = getReminderKey(studySession, threshold);
          if (sentReminders.current.has(reminderKey)) continue;

          sentReminders.current.add(reminderKey);
          persistReminderKeys(sentReminders.current);

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
              title,
              body,
              url: `/study/${studySession.id}`,
              tag: `study-reminder:${reminderKey}`,
            }),
          });
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

  const toggleSection = (sectionType: StudySectionType) => {
    setVisibleSectionTypes((current) =>
      current.includes(sectionType)
        ? current.filter((type) => type !== sectionType)
        : [...current, sectionType],
    );
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

    // Quick timers are ephemeral: jump straight into the timer route and start
    // it running immediately rather than parking an idle row in the list.
    const params = new URLSearchParams({
      title: quickTitle.trim() || "Timer Only",
      focus: String(Math.max(1, Number(quickFocusMinutes) || 25)),
      break: String(Math.max(1, Number(quickBreakMinutes) || 5)),
      total: String(Math.max(1, Number(quickTotalMinutes) || 60)),
      autostart: "1",
    });

    setQuickTimerOpen(false);
    setQuickTitle("");
    setQuickFocusMinutes(25);
    setQuickBreakMinutes(5);
    setQuickTotalMinutes(60);
    router.push(`/study/quicktimer?${params.toString()}`);
  };

  // Hide "Mark as Done" when every selected session is already completed.
  const showMarkDone = selectedSessionIds.some(
    (id) =>
      sessions.find((s) => s.id === id)?.sessionStatus !== "completed",
  );

  return (
    <>
      <StudySelectionToolbar
        selectedCount={selectedSessionIds.length}
        allCount={visibleRows.length}
        isDeleting={isDeleting}
        canEdit={selectedSessionIds.length === 1}
        showMarkDone={showMarkDone}
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
        <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
          <div
            aria-label="Study status filters"
            className="flex flex-1 flex-wrap gap-2"
          >
            {STUDY_SECTIONS.map((section) => {
              const active = visibleSectionTypes.includes(section.value);
              const count =
                groupedRows.find((group) => group.value === section.value)
                  ?.rows.length ?? 0;

              return (
                <Button
                  key={section.value}
                  type="button"
                  size="sm"
                  variant={active ? "default" : "outline"}
                  aria-pressed={active}
                  onClick={() => toggleSection(section.value)}
                  className={cn(
                    "gap-2 font-mono text-xs",
                    active
                      ? "shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <span
                    aria-hidden="true"
                    className={cn("h-2 w-2 rounded-full", section.dotClassName)}
                  />
                  {section.label}
                  <span className="rounded-full bg-background/60 px-1.5 py-0.5 text-[10px] text-foreground">
                    {count}
                  </span>
                </Button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <Select
              value={sortMode}
              onValueChange={(value) => setSortMode(value as StudySort)}
            >
              <SelectTrigger className="w-auto min-w-[12rem] font-mono text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="scheduled">Scheduled (Soonest)</SelectItem>
                <SelectItem value="status">Status</SelectItem>
              </SelectContent>
            </Select>
            <Dialog open={quickTimerOpen} onOpenChange={setQuickTimerOpen}>
              <DialogTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  className="gap-2 font-mono text-xs"
                >
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

        <div className="space-y-4">
          {visibleRows.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border/70 bg-card/70 px-4 py-8 text-sm text-muted-foreground">
              No study sessions found.
            </div>
          ) : (
            visibleGroups.map((group) => (
              <section key={group.value} className="space-y-2">
                <div className="flex items-center gap-2 px-1">
                  <span
                    aria-hidden="true"
                    className={cn("h-2 w-2 rounded-full", group.dotClassName)}
                  />
                  <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                    {group.label}
                  </h2>
                  <Badge variant="secondary" className="font-mono text-[10px]">
                    {group.rows.length}
                  </Badge>
                </div>
                <div className="space-y-2">
                  {group.rows.map(({ session, sectionType }) => {
                    const isSelected = selectedSessionIds.includes(session.id);
                    const statusBadge = getStatusBadge(sectionType, session);
                    const scheduledDate = parseISO(session.scheduledAt);
                    const scheduleBadge = getScheduleBadge(
                      scheduledDate,
                      sectionType,
                    );

                    return (
                      <div
                        key={session.id}
                        data-study-row
                        className={cn(
                          "flex items-center gap-3 rounded-lg px-4 py-3.5 border-l-4 bg-card",
                          "hover:bg-card/90 transition-all duration-150 group shadow-sm",
                          getRowAccent(sectionType),
                          isSelected && "ring-1 ring-accent/40 bg-card/95",
                        )}
                      >
                        <Checkbox
                          aria-label={`Select ${session.title}`}
                          checked={isSelected}
                          onCheckedChange={() => selectSession(session.id)}
                          className="shrink-0"
                        />

                        <button
                          type="button"
                          aria-label={`Open ${session.title}`}
                          onClick={() => openSession(session)}
                          className="flex-1 flex items-center gap-3 min-w-0 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-md"
                        >
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-medium truncate text-foreground">
                              {session.title}
                            </p>
                            <div className="mt-1 flex flex-wrap gap-1.5">
                              <Badge
                                variant="outline"
                                className={cn(
                                  "font-mono text-[10px]",
                                  statusBadge.className,
                                )}
                              >
                                {statusBadge.label}
                              </Badge>
                              <Badge
                                variant="secondary"
                                className="font-mono text-[10px]"
                              >
                                {session.focusMinutes}m /{" "}
                                {session.breakMinutes}m
                              </Badge>
                              <Badge
                                variant="secondary"
                                className="font-mono text-[10px]"
                              >
                                Total {session.totalMinutes}m
                              </Badge>
                              {session.notes && (
                                <Badge
                                  variant="secondary"
                                  className="font-mono text-[10px]"
                                >
                                  Notes
                                </Badge>
                              )}
                              {session.attachments.length > 0 && (
                                <Badge
                                  variant="secondary"
                                  className="font-mono text-[10px]"
                                >
                                  {session.attachments.length} attachment
                                  {session.attachments.length > 1 ? "s" : ""}
                                </Badge>
                              )}
                            </div>
                          </div>

                          <Badge
                            className={cn(
                              "shrink-0 font-mono text-xs border",
                              scheduleBadge.className,
                            )}
                            variant="outline"
                          >
                            {scheduleBadge.label}
                          </Badge>

                          <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-muted-foreground transition-colors" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </section>
            ))
          )}
        </div>
      </div>
    </>
  );
}
