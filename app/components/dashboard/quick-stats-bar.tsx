import { Card, CardContent } from "@/components/ui/card";
import type { AnalyticsData } from "@/types";
import { Flame, CheckCircle2, Clock } from "lucide-react";

export function QuickStatsBar({ data }: { data: AnalyticsData }) {
  const {
    completionStats,
    streak,
    totalFocusMinutes,
  } = data;

  const focusHours = Math.floor(totalFocusMinutes / 60);
  const focusMins = totalFocusMinutes % 60;

  const totalTasks =
    completionStats.early +
    completionStats.onTime +
    completionStats.late +
    completionStats.pending;

  const completionRate =
    totalTasks > 0
      ? Math.round(((completionStats.early + completionStats.onTime) / totalTasks) * 100)
      : 0;

  const stats = [
    {
      icon: <Flame className="h-5 w-5 text-accent" />,
      label: "Streak",
      value: `${streak} days`,
    },
    {
      icon: <CheckCircle2 className="h-5 w-5 text-green-400" />,
      label: "Completion Rate",
      value: `${completionRate}%`,
    },
    {
      icon: <Clock className="h-5 w-5 text-blue-400" />,
      label: "Focus Time",
      value: `${focusHours}h ${focusMins}m`,
    },
  ];

  return (
    <Card className="bg-card/80 backdrop-blur-sm border-0">
      <CardContent className="p-0">
        <div className="grid grid-cols-3">
          {stats.map(({ icon, label, value }, index) => (
            <div
              key={label}
              className={`flex flex-col items-center gap-2 px-4 py-4 ${index < stats.length - 1 ? "border-r border-border/30" : ""
                }`}
            >
              {icon}
              <span className="font-display text-xl font-bold text-foreground">{value}</span>
              <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
