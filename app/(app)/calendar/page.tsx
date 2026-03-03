"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockCalendarEvents, mockStudySessions } from "@/lib/mock-data";
import { cn } from "@/lib/utils";
import {
  startOfWeek,
  endOfWeek,
  startOfMonth,
  endOfMonth,
  addDays,
  addWeeks,
  subWeeks,
  addMonths,
  subMonths,
  addMinutes,
  format,
  isToday,
  isSameDay,
  eachDayOfInterval,
  isSameMonth,
  parseISO,
} from "date-fns";

const HOURS = Array.from({ length: 15 }, (_, i) => i + 7);

type StoredSession = {
  id: string;
  title: string;
  scheduledAt: string;
  focusMinutes: number;
};

const STORAGE_KEY = "scholarsPlot.studySessions";

const seedSessions = (): StoredSession[] =>
  mockStudySessions.map((session) => ({
    id: session.id,
    title: session.taskTitle ?? "Study Session",
    scheduledAt: (session.scheduledAt ?? new Date()).toISOString(),
    focusMinutes: session.duration ?? 25,
  }));

export default function CalendarPage() {
  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(new Date());
  const [storedSessions, setStoredSessions] = useState<StoredSession[]>([]);
  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });
  const weekDays = Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;

    if (stored) {
      try {
        setStoredSessions(JSON.parse(stored));
        return;
      } catch {
        setStoredSessions(seedSessions());
        return;
      }
    }

    setStoredSessions(seedSessions());
  }, []);

  const calendarEvents = useMemo(() => {
    const baseEvents = mockCalendarEvents.filter(
      (event) => event.type !== "study-session",
    );

    const studyEvents = storedSessions.map((session) => {
      const start = parseISO(session.scheduledAt);
      const end = addMinutes(start, session.focusMinutes);
      return {
        id: `session-${session.id}`,
        title: `Study: ${session.title}`,
        type: "study-session" as const,
        date: start,
        startTime: format(start, "HH:mm"),
        endTime: format(end, "HH:mm"),
        color: "#3b82f6",
      };
    });

    return [...baseEvents, ...studyEvents];
  }, [storedSessions]);
  const monthStart = startOfMonth(anchor);
  const monthEnd = endOfMonth(anchor);
  const calStart = startOfWeek(monthStart, { weekStartsOn: 1 });
  const calEnd = endOfWeek(monthEnd, { weekStartsOn: 1 });
  const monthDays = eachDayOfInterval({ start: calStart, end: calEnd });
  const prev = () =>
    view === "week"
      ? setAnchor(subWeeks(anchor, 1))
      : setAnchor(subMonths(anchor, 1));
  const next = () =>
    view === "week"
      ? setAnchor(addWeeks(anchor, 1))
      : setAnchor(addMonths(anchor, 1));
  const goToday = () => setAnchor(new Date());

  return (
    <div className="p-6 space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            CALENDAR
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">
            {view === "week"
              ? `${format(weekStart, "MMM d")} — ${format(addDays(weekStart, 6), "MMM d, yyyy")}`
              : format(anchor, "MMMM yyyy")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={prev}
            className="font-mono text-xs"
          >
            ←
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={goToday}
            className="font-mono text-xs"
          >
            Today
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={next}
            className="font-mono text-xs"
          >
            →
          </Button>
          <Tabs
            value={view}
            onValueChange={(v) => setView(v as "week" | "month")}
          >
            <TabsList className="bg-muted/50">
              <TabsTrigger value="week" className="font-mono text-xs">
                Week
              </TabsTrigger>
              <TabsTrigger value="month" className="font-mono text-xs">
                Month
              </TabsTrigger>
            </TabsList>
          </Tabs>
        </div>
      </div>

      {view === "week" ? (
        <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden">
          <div className="grid grid-cols-8 border-b border-border/50">
            <div className="py-3 px-2 font-mono text-xs text-muted-foreground text-center">
              TIME
            </div>
            {weekDays.map((day) => (
              <div
                key={day.toISOString()}
                className={cn(
                  "py-3 px-2 text-center border-l border-border/30",
                  isToday(day) && "bg-accent/10",
                )}
              >
                <p
                  className={cn(
                    "font-mono text-xs",
                    isToday(day)
                      ? "text-accent font-bold"
                      : "text-muted-foreground",
                  )}
                >
                  {format(day, "EEE")}
                </p>
                <p
                  className={cn(
                    "font-display text-lg font-bold",
                    isToday(day) ? "text-accent" : "text-foreground",
                  )}
                >
                  {format(day, "d")}
                </p>
              </div>
            ))}
          </div>
          <div className="overflow-y-auto max-h-[60vh]">
            {HOURS.map((hour) => (
              <div
                key={hour}
                className="grid grid-cols-8 border-b border-border/20 min-h-[48px]"
              >
                <div className="py-1 px-2 font-mono text-[10px] text-muted-foreground/60 text-right pr-3 pt-2">
                  {hour < 12
                    ? `${hour}am`
                    : hour === 12
                      ? "12pm"
                      : `${hour - 12}pm`}
                </div>
                {weekDays.map((day) => {
                  const events = calendarEvents.filter((e) => {
                    if (!isSameDay(e.date, day) || !e.startTime) return false;
                    const [h] = e.startTime.split(":").map(Number);
                    return h === hour;
                  });
                  return (
                    <div
                      key={day.toISOString()}
                      className={cn(
                        "border-l border-border/20 px-1 py-0.5",
                        isToday(day) && "bg-accent/5",
                      )}
                    >
                      {events.map((ev) => (
                        <div
                          key={ev.id}
                          className="rounded px-1.5 py-0.5 text-[10px] font-medium text-white truncate mb-0.5"
                          style={{ backgroundColor: ev.color }}
                        >
                          {ev.title}
                        </div>
                      ))}
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="rounded-xl border border-border/50 bg-card/60 backdrop-blur-sm overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border/50">
            {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((d) => (
              <div
                key={d}
                className="py-2 text-center font-mono text-xs text-muted-foreground"
              >
                {d}
              </div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {monthDays.map((day) => {
              const dayEvents = calendarEvents.filter((e) =>
                isSameDay(e.date, day),
              );
              const inMonth = isSameMonth(day, anchor);
              return (
                <div
                  key={day.toISOString()}
                  className={cn(
                    "min-h-[80px] border-b border-r border-border/20 p-1.5",
                    !inMonth && "opacity-30",
                    isToday(day) && "bg-accent/10",
                  )}
                >
                  <p
                    className={cn(
                      "font-mono text-xs font-bold mb-1",
                      isToday(day) ? "text-accent" : "text-foreground",
                    )}
                  >
                    {format(day, "d")}
                  </p>
                  <div className="flex flex-wrap gap-0.5">
                    {dayEvents.slice(0, 3).map((ev) => (
                      <span
                        key={ev.id}
                        className="h-1.5 w-1.5 rounded-full"
                        style={{ backgroundColor: ev.color }}
                      />
                    ))}
                    {dayEvents.length > 3 && (
                      <span className="font-mono text-[8px] text-muted-foreground">
                        +{dayEvents.length - 3}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
