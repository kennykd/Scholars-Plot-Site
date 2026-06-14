"use client";

import Link from "next/link";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/app/components/common/star-rating";
import { ChevronRight } from "lucide-react";
import type { Task } from "@/types";
import { cn } from "@/lib/utils";
import { format, isPast, isToday, isTomorrow } from "date-fns";
import { taskStatusColors, taskStatusLabels } from "@/lib/tasks/task-status";

interface TaskCardProps {
  task: Task;
  selected: boolean;
  onToggleSelect: () => void;
}

export function TaskCard({ task, selected, onToggleSelect }: TaskCardProps) {
  const deadlineDate = new Date(task.deadline);
  const isCompleted = task.status === "Completed";

  const getDeadlineBadge = (date: Date) => {
    if (isPast(date) && !isToday(date))
      return { label: "Overdue", cls: "bg-red-500/20 text-red-400 border-red-500/30" };
    if (isToday(date))
      return { label: "Today", cls: "bg-orange-500/20 text-orange-400 border-orange-500/30" };
    if (isTomorrow(date))
      return { label: "Tomorrow", cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" };
    return { label: format(date, "MMM d"), cls: "bg-muted text-muted-foreground border-border" };
  };

  const badge = getDeadlineBadge(deadlineDate);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-4 py-3.5 border-l-4 bg-card",
        "hover:bg-card/90 transition-all duration-150 group shadow-sm",
        `priority-${Math.round(task.priority)}`,
        selected && "ring-1 ring-accent/40 bg-card/95",
        isCompleted && "opacity-60",
      )}
    >
      <Checkbox
        aria-label={`Select ${task.title}`}
        checked={selected}
        onCheckedChange={onToggleSelect}
        className="shrink-0"
      />

      <Link
        href={`/tasks/${task.id}`}
        className="flex-1 flex items-center gap-3 min-w-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/50 rounded-md"
      >
        <div className="flex-1 min-w-0">
          <p
            className={cn(
              "text-sm font-medium truncate text-foreground",
              isCompleted && "line-through text-muted-foreground",
            )}
          >
            {task.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <StarRating value={task.priority} size="sm" readOnly />
            <Badge
              variant="outline"
              className={cn(
                "font-mono text-[10px] border",
                taskStatusColors[task.status],
              )}
            >
              {taskStatusLabels[task.status]}
            </Badge>
          </div>
        </div>

        <Badge
          className={cn("shrink-0 font-mono text-xs border", badge.cls)}
          variant="outline"
        >
          {badge.label}
        </Badge>

        <ChevronRight className="h-4 w-4 text-muted-foreground/50 shrink-0 group-hover:text-muted-foreground transition-colors" />
      </Link>
    </div>
  );
}
