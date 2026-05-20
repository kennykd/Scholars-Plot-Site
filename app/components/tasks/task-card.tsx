"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/app/components/common/star-rating";
import { ChevronRight } from "lucide-react";
import { toast } from "sonner";
import type { Task } from "@/types";
import { cn } from "@/lib/utils";
import { format, isPast, isToday, isTomorrow } from "date-fns";

interface TaskCardProps {
  task: Task;
}

export function TaskCard({ task }: TaskCardProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [done, setDone] = useState(task.status === "Completed");

  const deadlineDate = new Date(task.deadline);

  const handleToggle = async (checked: boolean) => {
    setDone(checked);
    try {
      const res = await fetch(`/api/task/${task.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: checked ? "Completed" : "Pending" }),
      });
      if (!res.ok) throw new Error("Failed");
      startTransition(() => router.refresh());
    } catch {
      setDone(!checked);
      toast.error("Could not update task");
    }
  };

  const getDeadlineBadge = (date: Date) => {
    if (isPast(date) && !isToday(date)) return { label: "Overdue", cls: "bg-red-500/20 text-red-400 border-red-500/30" };
    if (isToday(date)) return { label: "Today", cls: "bg-orange-500/20 text-orange-400 border-orange-500/30" };
    if (isTomorrow(date)) return { label: "Tomorrow", cls: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30" };
    return { label: format(date, "MMM d"), cls: "bg-muted text-muted-foreground border-border" };
  };

  const badge = getDeadlineBadge(deadlineDate);

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-lg px-4 py-3.5 border-l-4 bg-card",
        "hover:bg-card/90 transition-all duration-150 group shadow-sm",
        `priority-${Math.round(task.priority)}`,
        done && "opacity-60"
      )}
    >
      <Checkbox
        checked={done}
        disabled={pending}
        onCheckedChange={(v) => handleToggle(Boolean(v))}
        className="shrink-0"
        onClick={(e) => e.stopPropagation()}
      />

      <Link href={`/tasks/${task.id}`} className="flex-1 flex items-center gap-3 min-w-0">
        <div className="flex-1 min-w-0">
          <p className={cn(
            "text-sm font-medium truncate",
            done && "line-through text-muted-foreground"
          )}>
            {task.title}
          </p>
          <StarRating value={task.priority} size="sm" readOnly />
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
