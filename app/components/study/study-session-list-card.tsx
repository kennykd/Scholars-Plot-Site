"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { format, parseISO } from "date-fns";
import type { StudySession } from "@/types";

type StudySectionType = "in-progress" | "upcoming" | "completed" | "expired";

type StudySessionListCardProps = {
  sectionType: StudySectionType;
  title: string;
  titleClassName?: string;
  cardClassName?: string;
  sessions: StudySession[];
  selectedSessionIds: string[];
  selectedCount: number;
  onSelectAll: () => void;
  onDeselectAll: () => void;
  onSelectSession: (id: string) => void;
  onOpenSession?: (session: StudySession) => void;
  emptyPlaceholder?: string;
};

function getSubtitle(sectionType: StudySectionType, session: StudySession) {
  if (sectionType === "in-progress") {
    return session.isTimerOnly
      ? "Timer in progress"
      : format(parseISO(session.scheduledAt), "PPP p");
  }

  if (sectionType === "upcoming") {
    return session.isTimerOnly
      ? "Ready to start"
      : format(parseISO(session.scheduledAt), "PPP p");
  }

  if (sectionType === "completed") {
    return session.isTimerOnly
      ? "Completed"
      : format(parseISO(session.scheduledAt), "PPP p");
  }

  return session.isTimerOnly
    ? "Expired"
    : format(parseISO(session.scheduledAt), "PPP p");
}

function getItemClasses(sectionType: StudySectionType, isSelected: boolean) {
  if (isSelected) return "border-red-500/50 bg-red-500/15";
  if (sectionType === "in-progress")
    return "border-amber-500/30 bg-amber-500/10";
  if (sectionType === "completed") return "border-green-500/20 bg-green-500/5";
  if (sectionType === "expired") return "border-orange-500/20 bg-orange-500/5";
  return "border-border/40 bg-muted/20";
}

function getStatusBadge(sectionType: StudySectionType, session: StudySession) {
  if (sectionType === "in-progress") {
    return {
      label:
        session.sessionStatus.charAt(0).toUpperCase() +
        session.sessionStatus.slice(1),
      className:
        "font-mono text-[10px] bg-amber-500/20 text-amber-700 dark:text-amber-300",
    };
  }

  if (sectionType === "upcoming") {
    return {
      label: "Upcoming",
      className:
        "font-mono text-[10px] bg-blue-500/20 text-blue-700 dark:text-blue-300",
    };
  }

  if (sectionType === "completed") {
    return {
      label: "Completed",
      className:
        "font-mono text-[10px] bg-green-500/20 text-green-700 dark:text-green-300",
    };
  }

  return {
    label: "Expired",
    className:
      "font-mono text-[10px] bg-orange-500/20 text-orange-700 dark:text-orange-300",
  };
}

export function StudySessionListCard({
  sectionType,
  title,
  titleClassName,
  cardClassName,
  sessions,
  selectedSessionIds,
  selectedCount,
  onSelectAll,
  onDeselectAll,
  onSelectSession,
  onOpenSession,
  emptyPlaceholder = "Nothing here yet...",
}: StudySessionListCardProps) {
  if (sectionType !== "upcoming" && sectionType !== "completed" && sessions.length === 0) {
    return null; 
  }

  const showOpenButton =
    sectionType === "in-progress" || sectionType === "upcoming";

  return (
    <Card
      className={
        cardClassName ?? "bg-card/80 backdrop-blur-sm border-border/50"
      }
    >
      <CardHeader className="pb-3 flex flex-row items-center justify-between">
        <CardTitle
          className={
            titleClassName ?? "font-display text-base font-bold tracking-wide"
          }
        >
          {title}
        </CardTitle>
        <div className="flex gap-2">
          {selectedCount < sessions.length && (
            <Button
              size="sm"
              onClick={onSelectAll}
              variant={sectionType === "expired" ? "outline" : "default"}
              className="font-semibold text-xs"
            >
              Select All
            </Button>
          )}
          {selectedCount > 0 && (
            <Button
              size="sm"
              variant="outline"
              onClick={onDeselectAll}
              className="font-semibold text-xs"
            >
              Deselect All
            </Button>
          )}
        </div>
      </CardHeader>
        <CardContent className="space-y-3">
        {sessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center min-h-25 rounded-lg border-2 border-dashed border-muted-foreground/15 bg-muted/5 p-4 text-center">
            <p className="text-xs font-medium text-muted-foreground/60">
              {emptyPlaceholder}
            </p>
          </div>
        ) : (
          sessions.slice(0, 8).map((session) => {
            const isSelected = selectedSessionIds.includes(session.id);
            const badge = getStatusBadge(sectionType, session);

            return (
              <div
                key={session.id}
                className={`flex flex-col gap-3 rounded-lg border px-4 py-3 sm:flex-row sm:items-center sm:justify-between transition-colors ${getItemClasses(
                  sectionType,
                  isSelected,
                )}`}
              >
              <div className="space-y-1">
                <p className="font-medium text-foreground">{session.title}</p>
                <p className="text-xs text-muted-foreground">
                  {getSubtitle(sectionType, session)}
                </p>
                <div className="flex flex-wrap gap-2">
                  <Badge className={badge.className}>{badge.label}</Badge>
                  <Badge variant="outline" className="font-mono text-[10px]">
                    {session.focusMinutes}m / {session.breakMinutes}m
                  </Badge>
                  <Badge variant="secondary" className="text-[10px]">
                    Total {session.totalMinutes}m
                  </Badge>
                  {sectionType === "upcoming" &&
                    session.attachments.length > 0 && (
                      <Badge variant="secondary" className="text-[10px]">
                        {session.attachments.length} attachment
                        {session.attachments.length > 1 ? "s" : ""}
                      </Badge>
                    )}
                  {sectionType === "upcoming" && session.notes && (
                    <Badge variant="secondary" className="text-[10px]">
                      Notes
                    </Badge>
                  )}
                </div>
              </div>
              <div className="flex gap-2">
                {showOpenButton && onOpenSession && (
                  <Button
                    size="sm"
                    onClick={() => onOpenSession(session)}
                    className={
                      sectionType === "in-progress"
                        ? "bg-amber-600 hover:bg-amber-700 text-white"
                        : "bg-accent hover:bg-accent/90 text-accent-foreground"
                    }
                  >
                    {sectionType === "in-progress" ? "Open Timer" : "Start"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => onSelectSession(session.id)}
                >
                  {isSelected ? "Undo Select" : "Select"}
                </Button>
              </div>
            </div>
          );
        })
      )}
      </CardContent>
    </Card>
  );
}
