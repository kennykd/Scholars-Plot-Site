"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { mockCalendarEvents, mockStudySessions } from "@/lib/mock-data";
import { addDays, addMinutes, format, startOfWeek, parseISO } from "date-fns";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import { toFullCalendarEvents } from "@/lib/utils/calendar-adapters";
import "./fullcalendar-overrides.css";

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
  const calendarRef = useRef<FullCalendar>(null);
  const [view, setView] = useState<"week" | "month">("week");
  const [anchor, setAnchor] = useState(new Date());
  const [storedSessions, setStoredSessions] = useState<StoredSession[]>([]);

  const weekStart = startOfWeek(anchor, { weekStartsOn: 1 });

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

  useEffect(() => {
    if (storedSessions.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(storedSessions));
    }
  }, [storedSessions]);

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

  const fcEvents = useMemo(
    () => toFullCalendarEvents(calendarEvents),
    [calendarEvents],
  );

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
            onValueChange={(v) => handleViewChange(v as "week" | "month")}
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
        />
      </div>
    </div>
  );
}
