import { TodaysTasks } from "@/app/components/dashboard/todays-tasks";
import { WeeklyScheduleMini } from "@/app/components/dashboard/weekly-schedule-mini";
import { QuickStatsBar } from "@/app/components/dashboard/quick-stats-bar";
import { ActiveStudySession } from "@/app/components/dashboard/active-study-session";
import { UpcomingDeadlines } from "@/app/components/dashboard/upcoming-deadlines";

export default function DashboardPage() {
  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
          COMMAND CENTER
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">
          SCHOLAR&apos;S PLOT — DASHBOARD
        </p>
      </div>

      <QuickStatsBar />

      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <TodaysTasks />
        </div>
        <ActiveStudySession />
        <WeeklyScheduleMini />
        <div className="md:col-span-2 lg:col-span-2">
          <UpcomingDeadlines />
        </div>
      </div>
    </div>
  );
}
