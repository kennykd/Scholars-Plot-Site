import { redirect } from "next/navigation";
import { TodaysTasks } from "@/app/components/dashboard/todays-tasks";
import { WeeklyScheduleMini } from "@/app/components/dashboard/weekly-schedule-mini";
import { QuickStatsBar } from "@/app/components/dashboard/quick-stats-bar";
import { ActiveStudySession } from "@/app/components/dashboard/active-study-session";
import { UpcomingDeadlines } from "@/app/components/dashboard/upcoming-deadlines";
import { getSession } from "@/lib/firebase/auth";
import { getProjectTask, getTasks, serializeTask } from "@/lib/services/taskService";
import { getStudySessionsForDashboard } from "@/lib/services/studySessionService";
import { getAnalyticsByUserId } from "@/lib/services/analyticService";

export const dynamic = 'force-dynamic';

export default async function DashboardPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [taskRows, projectTaskRows, studySessions, analyticsData] = await Promise.all([
    getTasks(session.id),
    getProjectTask(session.id),
    getStudySessionsForDashboard(session.id),
    getAnalyticsByUserId(session.id),
  ]);
  const tasks = taskRows.map((row) => serializeTask(row));
  const dashboardTasks = [
    ...tasks,
    ...projectTaskRows.map((row) => serializeTask(row)),
  ];

  return (
    <div className="flex flex-col gap-6 p-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
          COMMAND CENTER
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">
          SCHOLAR&apos;S PLOT — DASHBOARD
        </p>
      </div>
      <QuickStatsBar data={analyticsData} />
      <WeeklyScheduleMini tasks={tasks} />
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TodaysTasks tasks={dashboardTasks} />
        </div>
        <ActiveStudySession sessions={studySessions} />
      </div>
      <UpcomingDeadlines tasks={dashboardTasks} />
    </div>
  );
}
