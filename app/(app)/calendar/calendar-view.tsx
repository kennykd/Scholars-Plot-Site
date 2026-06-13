"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { StarRating } from "@/app/components/common/star-rating";
import {
  STUDY_EVENT_COLOR,
  TASK_EVENT_COLOR,
  tasksToCalendarEvents,
  studySessionsToCalendarEvents,
  type CalendarStudySession,
} from "@/lib/utils/calendar-adapters";
import type { Task } from "@/types";
import { addDays, format, startOfWeek } from "date-fns";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import { ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";
import "./fullcalendar-overrides.css";

interface CalendarViewProps {
  tasks: Task[];
  sessions: CalendarStudySession[];
}

interface HoverState {
  rect: DOMRect;
  dateKey: string;
  dateLabel: string;
}

const statusBadgeCls: Record<Task["status"], string> = {
  Pending: "bg-muted text-muted-foreground",
  In_Progress: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Completed: "bg-green-500/20 text-green-400 border-green-500/30",
};

const statusLabel: Record<Task["status"], string> = {
  Pending: "Pending",
  In_Progress: "In Progress",
  Completed: "Completed",
};

export function CalendarView({ tasks, sessions }: CalendarViewProps) {
  const router = useRouter();
  const calendarRef = useRef<FullCalendar>(null);
  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(new Date());
  const [hover, setHover] = useState<HoverState | null>(null);
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });

  const tasksByDay = useMemo(() => {
    const map = new Map<string, Task[]>();
    for (const task of tasks) {
      const key = format(new Date(task.deadline), "yyyy-MM-dd");
      const list = map.get(key) ?? [];
      list.push(task);
      map.set(key, list);
    }
    return map;
  }, [tasks]);

  const fcEvents = useMemo(
    () => [
      ...tasksToCalendarEvents(tasks),
      ...studySessionsToCalendarEvents(sessions),
    ],
    [tasks, sessions],
  );

  const cancelClose = () => {
    if (closeTimer.current) {
      clearTimeout(closeTimer.current);
      closeTimer.current = null;
    }
  };

  const scheduleClose = () => {
    cancelClose();
    closeTimer.current = setTimeout(() => setHover(null), 150);
  };

  useEffect(() => () => cancelClose(), []);

  const prev = () => {
    const api = calendarRef.current?.getApi();
    if (api) {
      api.prev();
      setAnchor(api.getDate());
    }
  };

  const next = () => {
    const api = calendarRef.current?.getApi();
    if (api) {
      api.next();
      setAnchor(api.getDate());
    }
  };

  const goToday = () => {
    const api = calendarRef.current?.getApi();
    if (api) {
      api.today();
      setAnchor(new Date());
    }
  };

  const handleViewChange = (newView: "week" | "month") => {
    setView(newView);
    const api = calendarRef.current?.getApi();
    if (api) {
      api.changeView(newView === "week" ? "timeGridWeek" : "dayGridMonth");
      setAnchor(api.getDate());
    }
  };

  const hoveredTasks = hover ? tasksByDay.get(hover.dateKey) ?? [] : [];

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
          <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: TASK_EVENT_COLOR }}
                aria-hidden="true"
              />
              Task deadlines
            </span>
            <span className="inline-flex items-center gap-1.5">
              <span
                className="h-2.5 w-2.5 rounded-sm"
                style={{ backgroundColor: STUDY_EVENT_COLOR }}
                aria-hidden="true"
              />
              Study sessions
            </span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={prev} className="font-mono text-xs">
            ←
          </Button>
          <Button variant="outline" size="sm" onClick={goToday} className="font-mono text-xs">
            Today
          </Button>
          <Button variant="outline" size="sm" onClick={next} className="font-mono text-xs">
            →
          </Button>
          <Tabs value={view} onValueChange={(v) => handleViewChange(v as "week" | "month")}>
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

      <div className="fc-calendar-wrapper">
        <FullCalendar
          ref={calendarRef}
          plugins={[dayGridPlugin, timeGridPlugin]}
          initialView="timeGridWeek"
          headerToolbar={false}
          events={fcEvents}
          firstDay={1}
          height="90vh"
          slotMinTime="00:00:00"
          slotMaxTime="24:00:00"
          allDaySlot={true}
          allDayText="All Day"
          nowIndicator={true}
          dayMaxEvents={3}
          eventDisplay="block"
          slotLabelFormat={{
            hour: "numeric",
            minute: "2-digit",
            meridiem: "short",
          }}
          datesSet={(dateInfo) => {
            setAnchor(dateInfo.start);
          }}
          eventClick={(arg) => {
            const props = arg.event.extendedProps as
              | { type: "task-deadline"; taskId: number }
              | { type: "study-session"; sessionId: number };
            if (props.type === "task-deadline") {
              router.push(`/tasks/${props.taskId}`);
            } else if (props.type === "study-session") {
              router.push(`/study/${props.sessionId}`);
            }
          }}
          dayCellDidMount={(info) => {
            const dateKey = format(info.date, "yyyy-MM-dd");
            const dateLabel = format(info.date, "EEEE, MMM d");

            const onEnter = () => {
              if (!tasksByDay.has(dateKey)) return;
              cancelClose();
              setHover({
                rect: info.el.getBoundingClientRect(),
                dateKey,
                dateLabel,
              });
            };
            const onLeave = () => scheduleClose();

            info.el.addEventListener("mouseenter", onEnter);
            info.el.addEventListener("mouseleave", onLeave);
          }}
        />
      </div>

      {typeof document !== "undefined" && hover && hoveredTasks.length > 0 &&
        createPortal(
          <div
            role="dialog"
            aria-label={`Tasks on ${hover.dateLabel}`}
            onMouseEnter={cancelClose}
            onMouseLeave={scheduleClose}
            style={{
              position: "fixed",
              top: Math.min(hover.rect.top + 8, window.innerHeight - 320),
              left: Math.min(hover.rect.right + 8, window.innerWidth - 340),
              width: 320,
              zIndex: 50,
            }}
            className="rounded-lg border border-border/60 bg-popover shadow-lg p-3"
          >
            <p className="font-mono text-[10px] tracking-widest text-muted-foreground mb-2">
              {hover.dateLabel.toUpperCase()}
            </p>
            <div className="space-y-1.5 max-h-72 overflow-y-auto">
              {hoveredTasks.map((task) => (
                <button
                  key={task.id}
                  type="button"
                  onClick={() => {
                    setHover(null);
                    router.push(`/tasks/${task.id}`);
                  }}
                  className={cn(
                    "w-full text-left flex items-center gap-2 rounded-md px-2 py-2 border-l-4 bg-card/70",
                    "hover:bg-card transition-colors group",
                    `priority-${Math.round(task.priority)}`,
                  )}
                >
                  <div className="flex-1 min-w-0">
                    <p
                      className={cn(
                        "text-sm font-medium truncate",
                        task.status === "Completed" &&
                          "line-through text-muted-foreground",
                      )}
                    >
                      {task.title}
                    </p>
                    <StarRating value={task.priority} size="sm" readOnly />
                  </div>
                  <Badge
                    className={cn(
                      "shrink-0 font-mono text-[10px] border",
                      statusBadgeCls[task.status],
                    )}
                    variant="outline"
                  >
                    {statusLabel[task.status]}
                  </Badge>
                  <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60 shrink-0 group-hover:text-foreground transition-colors" />
                </button>
              ))}
            </div>
          </div>,
          document.body,
        )}
    </div>
  );
}
