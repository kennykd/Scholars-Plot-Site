import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type { Task } from "@/types";
import { TASK_EVENT_COLOR } from "@/lib/utils/calendar-adapters";
import { cn } from "@/lib/utils";
import { startOfWeek, addDays, format, isToday, isSameDay } from "date-fns";

interface WeeklyScheduleMiniProps {
  tasks: Task[];
}

export function WeeklyScheduleMini({ tasks }: WeeklyScheduleMiniProps) {
  const today = new Date();
  const weekStart = startOfWeek(today, { weekStartsOn: 1 });
  const days = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  return (
    <Card className="h-full w-full bg-card/80 backdrop-blur-sm border-0">
      <CardHeader className="pb-4">
        <CardTitle className="font-display text-base font-bold tracking-wide">
          THIS WEEK
        </CardTitle>
      </CardHeader>
      <CardContent className="flex-1 min-h-0 flex flex-col justify-center">
        <Link href="/calendar" className="block w-full">
          <div className="grid w-full grid-cols-7 gap-1">
            {days.map((day) => {
              const dayTasks = tasks.filter((t) =>
                isSameDay(new Date(t.deadline), day),
              );
              const isCurrentDay = isToday(day);
              return (
                <div
                  key={day.toISOString()}
                  className="flex flex-col items-center gap-1"
                >
                  <span
                    className={cn(
                      "font-mono text-[10px] font-medium",
                      isCurrentDay ? "text-accent" : "text-muted-foreground",
                    )}
                  >
                    {format(day, "EEE")}
                  </span>
                  <div
                    className={cn(
                      "flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors",
                      isCurrentDay
                        ? "bg-accent text-accent-foreground"
                        : "text-foreground hover:bg-muted",
                    )}
                  >
                    {format(day, "d")}
                  </div>
                  <div className="flex flex-col gap-0.5 items-center">
                    {dayTasks.slice(0, 3).map((task) => (
                      <span
                        key={task.id}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: TASK_EVENT_COLOR }}
                      />
                    ))}
                    {dayTasks.length > 3 && (
                      <span className="font-mono text-[8px] text-muted-foreground">
                        +{dayTasks.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </Link>
      </CardContent>
    </Card>
  );
}
