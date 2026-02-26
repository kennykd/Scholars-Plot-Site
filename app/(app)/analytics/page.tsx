"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { mockAnalytics } from "@/lib/mock-data";
import { Flame, CheckCircle2, Clock, Target } from "lucide-react";
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, BarChart, Bar, XAxis, YAxis, CartesianGrid, AreaChart, Area } from "recharts";

const DONUT_COLORS = ["#22c55e", "#3b82f6", "var(--accent)", "#6b7280"];

export default function AnalyticsPage() {
  const { completionStats, timeBySubject, productivityByDay, streak, totalFocusMinutes, totalTasksCompleted } = mockAnalytics;
  const focusHours = Math.floor(totalFocusMinutes / 60);
  const focusMins = totalFocusMinutes % 60;
  const totalTasks = completionStats.early + completionStats.onTime + completionStats.late + completionStats.pending;
  const completionRate = totalTasks > 0 ? Math.round(((completionStats.early + completionStats.onTime) / totalTasks) * 100) : 0;
  const donutData = [
    { name: "Early", value: completionStats.early },
    { name: "On Time", value: completionStats.onTime },
    { name: "Late", value: completionStats.late },
    { name: "Pending", value: completionStats.pending },
  ];
  const statCards = [
    { icon: <Target className="h-5 w-5 text-accent" />, label: "Total Tasks", value: totalTasks },
    { icon: <CheckCircle2 className="h-5 w-5 text-green-400" />, label: "Completion Rate", value: `${completionRate}%` },
    { icon: <Clock className="h-5 w-5 text-blue-400" />, label: "Focus Time", value: `${focusHours}h ${focusMins}m` },
    { icon: <Flame className="h-5 w-5 text-accent" />, label: "Streak", value: `${streak} days` },
  ];
  void totalTasksCompleted;

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">ANALYTICS</h1>
        <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">YOUR STUDY PERFORMANCE</p>
      </div>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map(({ icon, label, value }) => (
          <Card key={label} className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardContent className="flex flex-col items-center gap-2 py-5">{icon}<span className="font-display text-2xl font-bold text-foreground">{value}</span><span className="font-mono text-[10px] text-muted-foreground uppercase tracking-wider">{label}</span></CardContent>
          </Card>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-2"><CardTitle className="font-display text-base font-bold tracking-wide">COMPLETION RATE</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <PieChart>
                <Pie data={donutData} cx="50%" cy="50%" innerRadius={60} outerRadius={90} paddingAngle={3} dataKey="value">
                  {donutData.map((_, i) => (<Cell key={i} fill={DONUT_COLORS[i]} />))}
                </Pie>
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
              </PieChart>
            </ResponsiveContainer>
            <div className="flex flex-wrap justify-center gap-3 mt-2">
              {donutData.map((d, i) => (<div key={d.name} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: DONUT_COLORS[i] }} /><span className="font-mono text-xs text-muted-foreground">{d.name} ({d.value})</span></div>))}
            </div>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-2"><CardTitle className="font-display text-base font-bold tracking-wide">TIME BY SUBJECT</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={timeBySubject} layout="vertical" margin={{ left: 8, right: 16 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis type="category" dataKey="subject" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" width={80} />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} formatter={(v) => [`${v}h`, "Hours"]} />
                <Bar dataKey="hours" fill="var(--primary)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-border/50 lg:col-span-2">
          <CardHeader className="pb-2"><CardTitle className="font-display text-base font-bold tracking-wide">PRODUCTIVITY BY DAY</CardTitle></CardHeader>
          <CardContent>
            <ResponsiveContainer width="100%" height={200}>
              <AreaChart data={productivityByDay} margin={{ left: 0, right: 16 }}>
                <defs><linearGradient id="blueGrad" x1="0" y1="0" x2="0" y2="1"><stop offset="5%" stopColor="var(--primary)" stopOpacity={0.6} /><stop offset="95%" stopColor="var(--primary)" stopOpacity={0.05} /></linearGradient></defs>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                <XAxis dataKey="day" tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <YAxis tick={{ fontSize: 10 }} stroke="var(--muted-foreground)" />
                <Tooltip contentStyle={{ background: "var(--card)", border: "1px solid var(--border)", borderRadius: "8px", fontSize: "12px" }} />
                <Area type="monotone" dataKey="tasksCompleted" stroke="var(--accent)" fill="url(#blueGrad)" strokeWidth={2} name="Tasks Completed" />
              </AreaChart>
            </ResponsiveContainer>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
