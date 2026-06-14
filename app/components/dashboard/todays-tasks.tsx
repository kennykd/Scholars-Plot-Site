"use client";

import { useState } from "react";
import Link from "next/link"; // Added for routing
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button"; // Imported to match your button standard
import { StarRating } from "@/app/components/common/star-rating";
import type { Task } from "@/types";
import { cn } from "@/lib/utils";
import { format, isToday, isTomorrow, isPast } from "date-fns";
import { Plus, ClipboardList } from "lucide-react"; // UI icons for actions and layout empty-state

interface TodaysTasksProps {
  tasks: Task[];
}

export function TodaysTasks({ tasks }: TodaysTasksProps) {
  const [completed, setCompleted] = useState<Set<number>>(new Set());

  const sorted = [...tasks].sort((a, b) => b.priority - a.priority);

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
    <Card className="bg-card/80 backdrop-blur-sm border-0 h-full">
      <CardHeader className="pb-4">
        <CardTitle className="font-display text-base font-bold tracking-wide">
          TODAY&apos;S TASKS
        </CardTitle>
        
        {/* Subtle header action: Only renders if tasks actually exist */}
        {sorted.length > 0 && (
          <Button asChild size="sm" variant="outline" className="h-8 gap-1 font-mono text-xs border-white/10 hover:bg-white/5">
            <Link href="/tasks/new">
              <Plus size={14} /> New Task
            </Link>
          </Button>
        )}
      </CardHeader>
      <CardContent className="space-y-3 flex-1 min-h-0 overflow-y-auto">
        {sorted.length === 0 ? (
          /* Custom centered layout container: Placed right over "No tasks yet" */
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center border border-dashed border-border/60 rounded-xl bg-background/20 my-auto">
            <h3 className="font-display font-bold text-sm tracking-wide text-foreground mb-1">
              NO TASKS YET
            </h3>
            <p className="text-xs text-muted-foreground max-w-xs mb-5 leading-relaxed font-mono">
              Start by creating your first task to get organized and stay on track!
            </p>

            {/* Tactical Dark Orange Action Button */}
            <Button 
              asChild 
              className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-5 shadow-lg gap-1.5"
            >
              <Link href="/tasks/new">
                <Plus size={16} strokeWidth={2.5} />
                New Task
              </Link>
            </Button>
          </div>
        ) : (
          /* Normal layout task mapping block */
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