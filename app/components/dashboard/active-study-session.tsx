"use client";

import { useMemo } from "react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarClock, Timer } from "lucide-react";
import { format, formatDistanceToNow, isAfter, parseISO } from "date-fns";
import type { StudySession } from "@/types";
type ActiveStudySessionProps = {
  sessions: StudySession[];
};

export function ActiveStudySession({ sessions }: ActiveStudySessionProps) {
  const loading = false;

  const upcomingSessions = useMemo(() => {
    const now = new Date();
    return sessions
      .filter(
        (session) =>
          session.sessionStatus !== "completed" &&
          isAfter(parseISO(session.scheduledAt), now),
      )
      .sort(
        (a, b) =>
          new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime(),
      );
  }, [sessions]);

  const activeSessions = useMemo(
    () =>
      sessions.filter(
        (session) =>
          session.sessionStatus === "running" ||
          session.sessionStatus === "paused",
      ),
    [sessions],
  );

  const nextSession = activeSessions[0] ?? upcomingSessions[0];

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-0">
      <CardHeader className="pb-4">
        <CardTitle className="font-display text-base font-bold tracking-wide">
          STUDY SESSIONS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {loading ? (
          <div className="space-y-3 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 mx-auto">
              <Timer className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">
              Loading study sessions...
            </p>
          </div>
        ) : !nextSession ? (
          <div className="space-y-4 text-center">
            <div className="flex h-14 w-14 items-center justify-center rounded-full border-2 border-dashed border-muted-foreground/30 mx-auto">
              <Timer className="h-6 w-6 text-muted-foreground/50" />
            </div>
            <p className="text-sm text-muted-foreground">
              No upcoming sessions scheduled.
            </p>
            <Button
              asChild
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold w-full"
            >
              <Link href="/study">Plan a Session</Link>
            </Button>
          </div>
        ) : (
          <>
            <div className="rounded-lg border border-border/40 bg-muted/20 px-4 py-3 space-y-2">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="font-semibold text-foreground">
                    {nextSession.title}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {format(parseISO(nextSession.scheduledAt), "PPP p")}
                  </p>
                </div>
                <CalendarClock className="h-5 w-5 text-muted-foreground" />
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge variant="secondary" className="text-[10px] capitalize">
                  {nextSession.sessionStatus}
                </Badge>
                <Badge variant="outline" className="font-mono text-[10px]">
                  {nextSession.focusMinutes}m / {nextSession.breakMinutes}m
                </Badge>
                <Badge variant="secondary" className="text-[10px]">
                  Starts{" "}
                  {formatDistanceToNow(parseISO(nextSession.scheduledAt), {
                    addSuffix: true,
                  })}
                </Badge>
              </div>
            </div>

            <div className="space-y-2">
              <p className="font-mono text-[10px] text-muted-foreground tracking-widest">
                NEXT UP
              </p>
              {upcomingSessions.slice(0, 3).map((session) => (
                <div
                  key={session.id}
                  className="flex items-center justify-between text-xs text-muted-foreground"
                >
                  <span className="truncate">{session.title}</span>
                  <span className="font-mono">
                    {format(parseISO(session.scheduledAt), "MMM d, p")}
                  </span>
                </div>
              ))}
            </div>

            <Button
              asChild
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold w-full"
            >
              <Link href="/study">Open Study Planner</Link>
            </Button>
          </>
        )}
      </CardContent>
    </Card>
  );
}
