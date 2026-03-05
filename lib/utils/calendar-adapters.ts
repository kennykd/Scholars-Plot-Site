import { CalendarEvent } from "@/lib/types";
import { format } from "date-fns";
import type { EventInput } from "@fullcalendar/core";

export function toFullCalendarEvents(events: CalendarEvent[]): EventInput[] {
  return events.map((ev) => {
    const dateStr = format(ev.date, "yyyy-MM-dd");

    if (ev.startTime && ev.endTime) {
      return {
        id: ev.id,
        title: ev.title,
        start: `${dateStr}T${ev.startTime}:00`,
        end: `${dateStr}T${ev.endTime}:00`,
        backgroundColor: ev.color,
        borderColor: ev.color,
        allDay: false,
        extendedProps: {
          type: ev.type,
          taskId: ev.taskId,
        },
      };
    }

    return {
      id: ev.id,
      title: ev.title,
      start: dateStr,
      allDay: true,
      backgroundColor: ev.color,
      borderColor: ev.color,
      extendedProps: {
        type: ev.type,
        taskId: ev.taskId,
      },
    };
  });
}
