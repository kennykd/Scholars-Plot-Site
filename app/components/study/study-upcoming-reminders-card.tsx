"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Bell } from "lucide-react";
import { formatDistanceToNow, parseISO } from "date-fns";
import type { StudySession } from "@/types";

type StudyUpcomingRemindersCardProps = {
  upcomingSoon: StudySession[];
};

export function StudyUpcomingRemindersCard({
  upcomingSoon,
}: StudyUpcomingRemindersCardProps) {
  return (
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
            No study reminders are due soon.
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
  );
}
