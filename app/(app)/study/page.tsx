"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { mockStudySessions } from "@/lib/mock-data";
import { Bell, Plus } from "lucide-react";
import {
  differenceInMinutes,
  format,
  formatDistanceToNow,
  isAfter,
  parseISO,
} from "date-fns";

type StudySessionLocal = {
  id: string;
  title: string;
  notes: string;
  attachments: string[];
  scheduledAt: string;
  focusMinutes: number;
  breakMinutes: number;
  totalMinutes: number;
  status: "planned" | "in-progress" | "completed";
  createdAt: string;
  isTimerOnly?: boolean;
};

const STORAGE_KEY = "scholarsPlot.studySessions";

const seedSessions = (): StudySessionLocal[] =>
  mockStudySessions.map((session) => ({
    id: session.id,
    title: session.taskTitle ?? "Study Session",
    notes: "",
    attachments: [],
    scheduledAt: (session.scheduledAt ?? new Date()).toISOString(),
    focusMinutes: session.duration ?? 25,
    breakMinutes: session.breakDuration ?? 5,
    totalMinutes: 60,
    status: session.status === "completed" ? "completed" : "planned",
    createdAt: new Date().toISOString(),
  }));

export default function StudyPage() {
  const router = useRouter();
  const [sessions, setSessions] = useState<StudySessionLocal[]>([]);
  const [hydrated, setHydrated] = useState(false);
  const [nowTick, setNowTick] = useState(new Date());
  const [quickTitle, setQuickTitle] = useState("");
  const [quickFocusMinutes, setQuickFocusMinutes] = useState(25);
  const [quickBreakMinutes, setQuickBreakMinutes] = useState(5);
  const [quickTotalMinutes, setQuickTotalMinutes] = useState(60);

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      try {
        setSessions(JSON.parse(stored));
      } catch {
        setSessions(seedSessions());
      }
    } else {
      setSessions(seedSessions());
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [hydrated, sessions]);

  useEffect(() => {
    const interval = setInterval(() => {
      setNowTick(new Date());
    }, 30000);

    return () => clearInterval(interval);
  }, []);

  const upcomingSessions = useMemo(
    () =>
      sessions
        .filter(
          (session) =>
            session.status !== "completed" &&
            (session.isTimerOnly ||
              isAfter(parseISO(session.scheduledAt), nowTick)),
        )
        .sort(
          (a, b) =>
            new Date(a.scheduledAt).getTime() -
            new Date(b.scheduledAt).getTime(),
        ),
    [sessions, nowTick],
  );

  const upcomingSoon = useMemo(
    () =>
      upcomingSessions.filter((session) => {
        if (session.isTimerOnly) return false;
        const minutesAway = differenceInMinutes(
          parseISO(session.scheduledAt),
          nowTick,
        );
        return minutesAway >= 0 && minutesAway <= 60;
      }),
    [upcomingSessions, nowTick],
  );

  const openSession = (sessionId: string) => {
    setSessions((prev) =>
      prev.map((item) =>
        item.id === sessionId ? { ...item, status: "in-progress" } : item,
      ),
    );
    router.push(`/study/${sessionId}`);
  };

  const createQuickTimer = () => {
    if (quickFocusMinutes < 1 || quickBreakMinutes < 1 || quickTotalMinutes < 1)
      return;

    const newSession: StudySessionLocal = {
      id: `session-${Date.now()}`,
      title: quickTitle.trim() || "Timer Only",
      notes: "",
      attachments: [],
      scheduledAt: new Date().toISOString(),
      focusMinutes: Math.max(1, Number(quickFocusMinutes) || 25),
      breakMinutes: Math.max(1, Number(quickBreakMinutes) || 5),
      totalMinutes: Math.max(1, Number(quickTotalMinutes) || 60),
      status: "planned",
      createdAt: new Date().toISOString(),
      isTimerOnly: true,
    };

    setSessions((prev) => [newSession, ...prev]);
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
        <Button
          asChild
          className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
        >
          <Link href="/study/new">
            <Plus className="h-4 w-4 mr-1" /> New Session
          </Link>
        </Button>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base font-bold tracking-wide">
                Upcoming Sessions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {upcomingSessions.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-4">
                  No upcoming sessions. Schedule one to get started.
                </p>
              ) : (
                upcomingSessions.slice(0, 8).map((session) => (
                  <div
                    key={session.id}
                    className="flex flex-col gap-3 rounded-lg border border-border/40 bg-muted/20 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="space-y-1">
                      <p className="font-medium text-foreground">
                        {session.title}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {session.isTimerOnly
                          ? "Ready to start"
                          : format(parseISO(session.scheduledAt), "PPP p")}
                      </p>
                      <div className="flex flex-wrap gap-2">
                        <Badge
                          variant="outline"
                          className="font-mono text-[10px]"
                        >
                          {session.focusMinutes}m / {session.breakMinutes}m
                        </Badge>
                        <Badge variant="secondary" className="text-[10px]">
                          Total {session.totalMinutes}m
                        </Badge>
                        {session.attachments.length > 0 && (
                          <Badge variant="secondary" className="text-[10px]">
                            {session.attachments.length} attachment
                            {session.attachments.length > 1 ? "s" : ""}
                          </Badge>
                        )}
                        {session.notes && (
                          <Badge variant="secondary" className="text-[10px]">
                            Notes
                          </Badge>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        onClick={() => openSession(session.id)}
                        className="bg-accent hover:bg-accent/90 text-accent-foreground"
                      >
                        Start
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => openSession(session.id)}
                      >
                        Select
                      </Button>
                    </div>
                  </div>
                ))
              )}
            </CardContent>
          </Card>
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
                upcomingSoon.map((session) => (
                  <div
                    key={session.id}
                    className="rounded-lg border border-accent/20 bg-accent/10 px-4 py-3"
                  >
                    <p className="font-medium text-foreground">
                      {session.title}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      Starts{" "}
                      {formatDistanceToNow(parseISO(session.scheduledAt), {
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
