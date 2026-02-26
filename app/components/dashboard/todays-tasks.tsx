"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/app/components/common/star-rating";
import { mockTasks } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, isPast } from "date-fns";

export function TodaysTasks() {
  const [completed, setCompleted] = useState<Set<string>>(new Set());

  // Show tasks due today or overdue, sorted by priority desc
  const tasks = [...mockTasks]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);

  const toggle = (id: string) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) { next.delete(id); } else { next.add(id); }
      return next;
    });
  };

  const getDeadlineBadge = (date: Date) => {
    if (isPast(date) && !isToday(date)) return { label: "Overdue", variant: "destructive" as const };
    if (isToday(date)) return { label: "Today", variant: "default" as const };
    if (isTomorrow(date)) return { label: "Tomorrow", variant: "secondary" as const };
    return { label: format(date, "MMM d"), variant: "outline" as const };
  };

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-border/50">
      <CardHeader className="pb-3">
        <CardTitle className="font-display text-base font-bold tracking-wide">
          TODAY&apos;S TASKS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        {tasks.map((task) => {
          const done = completed.has(task.id);
          const badge = getDeadlineBadge(task.deadline);
          return (
            <div
              key={task.id}
              className={cn(
                "flex items-center gap-3 rounded-lg px-3 py-2 border-l-4 bg-background/30 transition-opacity",
                `priority-${Math.round(task.priority)}`,
                done && "opacity-50"
              )}
            >
              <Checkbox
                checked={done}
                onCheckedChange={() => toggle(task.id)}
                className="shrink-0"
              />
              <div className="flex-1 min-w-0">
                <p className={cn("text-sm font-medium truncate", done && "line-through text-muted-foreground")}>
                  {task.title}
                </p>
                <StarRating value={task.priority} size="sm" readOnly />
              </div>
              <Badge variant={badge.variant} className="shrink-0 text-xs font-mono">
                {badge.label}
              </Badge>
            </div>
          );
        })}
      </CardContent>
    </Card>
  );
}
