"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/app/components/common/star-rating";
import type { Task } from "@/types";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, isPast } from "date-fns";

interface TodaysTasksProps {
  tasks: Task[];
}

export function TodaysTasks({ tasks }: TodaysTasksProps) {
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  const sorted = [...tasks]
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 6);

  const toggle = (id: number) => {
    setCompleted((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
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
    <Card className="bg-card/80 backdrop-blur-sm border-0">
      <CardHeader className="pb-4">
        <CardTitle className="font-display text-base font-bold tracking-wide">
          TODAY&apos;S TASKS
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {sorted.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tasks yet.</p>
        ) : (
          sorted.map((task) => {
            const done = completed.has(task.id) || task.status === "Completed";
            const deadlineDate = new Date(task.deadline);
            const badge = getDeadlineBadge(deadlineDate);
            return (
              <div
                key={task.id}
                className={cn(
                  "flex items-center gap-3 rounded-lg px-4 py-3 border-l-4 bg-background/40 transition-opacity",
                  `priority-${Math.round(task.priority)}`,
                  done && "opacity-50",
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
          })
        )}
      </CardContent>
    </Card>
  );
}
