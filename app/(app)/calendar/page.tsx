import { redirect } from "next/navigation";
import { getSession } from "@/lib/firebase/auth";
import { getTasks, serializeTask } from "@/lib/services/taskService";
import { prisma } from "@/lib/prisma";
import { CalendarView } from "./calendar-view";
import type { CalendarStudySession } from "@/lib/utils/calendar-adapters";

export default async function CalendarPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [taskRows, sessionRows] = await Promise.all([
    getTasks(session.id),
    prisma.studySessionUser.findMany({
      where: { user_id: session.id },
      include: { study_session: true },
    }),
  ]);

  const tasks = taskRows.map((row) => serializeTask(row));

  const sessions: CalendarStudySession[] = sessionRows.map((row) => ({
    id: row.study_session_id,
    title: row.study_session.study_session_name,
    scheduledAt: row.study_session.study_session_scheduled_at.toISOString(),
    focusMinutes: row.study_session.focus_minutes,
  }));

  return <CalendarView tasks={tasks} sessions={sessions} />;
}
