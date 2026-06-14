import { redirect } from "next/navigation";
import { TodaysTasks } from "@/app/components/dashboard/todays-tasks";
import { WeeklyScheduleMini } from "@/app/components/dashboard/weekly-schedule-mini";
import { QuickStatsBar } from "@/app/components/dashboard/quick-stats-bar";
import { ActiveStudySession } from "@/app/components/dashboard/active-study-session";
import { UpcomingDeadlines } from "@/app/components/dashboard/upcoming-deadlines";
import { getSession } from "@/lib/firebase/auth";
import { getTasks, serializeTask } from "@/lib/services/taskService";
import { getStudySessionsForDashboard } from "@/lib/services/studySessionService";

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const taskRows = await getTasks(session.id);
  const tasks = taskRows.map((row) => serializeTask(row));

  const studySessions = await getStudySessionsForDashboard(session.id);

  return (
    <div className="flex flex-col gap-6 p-6 lg:h-screen lg:overflow-hidden">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
          COMMAND CENTER
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">
          SCHOLAR&apos;S PLOT — DASHBOARD
        </p>
      </div>

      <QuickStatsBar />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 lg:grid-rows-2 lg:flex-1 lg:min-h-0">
        <div className="h-full min-h-0 lg:col-span-2">
          <TodaysTasks tasks={tasks} />
        </div>
        <ActiveStudySession sessions={studySessions} />
        <WeeklyScheduleMini tasks={tasks} />
        <div className="h-full min-h-0 md:col-span-2 lg:col-span-2">
          <UpcomingDeadlines tasks={tasks} />
        </div>
      </div>
    </div>
  );
}
