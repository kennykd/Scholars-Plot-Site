import type { EventInput } from "@fullcalendar/core";
import { addMinutes, format } from "date-fns";
import type { Task } from "@/types";

export interface CalendarStudySession {
  id: number;
  title: string;
  scheduledAt: string;
  focusMinutes: number;
}

export const TASK_EVENT_COLOR = "#FF4D2E";
export const STUDY_EVENT_COLOR = "#3b82f6";

export function tasksToCalendarEvents(tasks: Task[]): EventInput[] {
  return tasks.map((task) => {
    const deadline = new Date(task.deadline);
    return {
      id: `task-${task.id}`,
      title: task.title,
      start: format(deadline, "yyyy-MM-dd"),
      allDay: true,
      backgroundColor: TASK_EVENT_COLOR,
      borderColor: TASK_EVENT_COLOR,
      extendedProps: {
        type: "task-deadline" as const,
        taskId: task.id,
        status: task.status,
        priority: task.priority,
        description: task.description,
        deadline: task.deadline,
      },
    };
  });
}

export function studySessionsToCalendarEvents(
  sessions: CalendarStudySession[],
): EventInput[] {
  return sessions.map((session) => {
    const start = new Date(session.scheduledAt);
    const end = addMinutes(start, session.focusMinutes);
    return {
      id: `session-${session.id}`,
      title: `Study: ${session.title}`,
      start: start.toISOString(),
      end: end.toISOString(),
      backgroundColor: STUDY_EVENT_COLOR,
      borderColor: STUDY_EVENT_COLOR,
      extendedProps: {
        type: "study-session" as const,
        sessionId: session.id,
      },
    };
  });
}
