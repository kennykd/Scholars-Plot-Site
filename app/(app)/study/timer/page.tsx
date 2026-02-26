"use client";

import { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Badge } from "@/components/ui/badge";
import { mockTasks, mockStudySessions } from "@/lib/mock-data";
import { ChecklistItem } from "@/lib/types";
import { cn } from "@/lib/utils";
import { Sparkles } from "lucide-react";

type Phase = "pre" | "focus" | "break";
const WORK_SECONDS = 25 * 60;
const BREAK_SECONDS = 5 * 60;

function CircularTimer({ seconds, total, phase }: { seconds: number; total: number; phase: Phase }) {
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const dashOffset = circumference * (1 - seconds / total);
  const mins = Math.floor(seconds / 60).toString().padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  return (
    <div className="relative flex items-center justify-center">
      <svg width="220" height="220" className="-rotate-90">
        <circle cx="110" cy="110" r={radius} fill="none" stroke="currentColor" strokeWidth="8" className="text-muted/30" />
        <circle cx="110" cy="110" r={radius} fill="none" stroke={phase === "break" ? "#3b82f6" : "var(--accent)"} strokeWidth="8" strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} className="transition-all duration-1000" />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-5xl font-bold text-foreground tabular-nums">{mins}:{secs}</span>
        <span className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">{phase === "break" ? "BREAK" : "FOCUS"}</span>
      </div>
    </div>
  );
}

export default function StudyTimerPage() {
  const [phase, setPhase] = useState<Phase>("pre");
  const [selectedTaskId, setSelectedTaskId] = useState(mockTasks[0]?.id ?? "");
  const [seconds, setSeconds] = useState(WORK_SECONDS);
  const [running, setRunning] = useState(false);
  const [checklistOverrides, setChecklistOverrides] = useState<Record<string, boolean>>({});
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const selectedTask = mockTasks.find((t) => t.id === selectedTaskId);
  const session = mockStudySessions.find((s) => s.taskId === selectedTaskId);
  const checklist: ChecklistItem[] = (session?.checklist ?? []).map((c) => ({
    ...c,
    completed: checklistOverrides[c.id] ?? c.completed,
  }));

  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => {
        setSeconds((s) => {
          if (s <= 1) {
            clearInterval(intervalRef.current!);
            setRunning(false);
            if (phase === "focus") { setPhase("break"); setSeconds(BREAK_SECONDS); }
            else { setPhase("pre"); setSeconds(WORK_SECONDS); }
            return 0;
          }
          return s - 1;
        });
      }, 1000);
    } else { if (intervalRef.current) clearInterval(intervalRef.current); }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running, phase]);

  const startSession = () => { setPhase("focus"); setSeconds(WORK_SECONDS); setRunning(true); };
  const endSession = () => { setPhase("pre"); setSeconds(WORK_SECONDS); setRunning(false); };
  const reset = () => { setRunning(false); setSeconds(phase === "break" ? BREAK_SECONDS : WORK_SECONDS); };
  const toggleCheck = (id: string) => setChecklistOverrides((prev) => ({ ...prev, [id]: !checklist.find((c) => c.id === id)?.completed }));

  if (phase === "pre") return (
    <div className="p-6 max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">STUDY SESSION</h1>
        <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">POMODORO — 25 MIN FOCUS</p>
      </div>
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className="border-t-2 border-accent rounded-t-xl pb-2"><CardTitle className="font-display text-lg">Select Task</CardTitle></CardHeader>
        <CardContent className="space-y-4 pt-4">
          <Select value={selectedTaskId} onValueChange={setSelectedTaskId}>
            <SelectTrigger className="font-mono text-sm"><SelectValue placeholder="Choose a task" /></SelectTrigger>
            <SelectContent>{mockTasks.filter((t) => t.status !== "done").map((t) => (<SelectItem key={t.id} value={t.id} className="font-mono text-sm">{t.title}</SelectItem>))}</SelectContent>
          </Select>
          {selectedTask && (<div className="rounded-lg bg-muted/30 px-4 py-3 space-y-1"><p className="text-sm font-medium">{selectedTask.title}</p><Badge variant="outline" className="font-mono text-xs">{selectedTask.status}</Badge></div>)}
          <Button onClick={startSession} className="w-full bg-accent hover:bg-accent/90 text-accent-foreground font-semibold text-base py-6">Start Session</Button>
        </CardContent>
      </Card>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-xl font-bold text-foreground truncate">{selectedTask?.title ?? "Study Session"}</h1>
          <p className="font-mono text-xs text-muted-foreground tracking-widest">{phase === "break" ? "BREAK TIME" : "FOCUS MODE"}</p>
        </div>
        <Button variant="outline" size="sm" onClick={endSession} className="font-mono text-xs">End Session</Button>
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="flex flex-col items-center gap-6 py-8">
            <CircularTimer seconds={seconds} total={phase === "break" ? BREAK_SECONDS : WORK_SECONDS} phase={phase} />
            <div className="flex gap-3">
              <Button onClick={() => setRunning((r) => !r)} className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8">{running ? "Pause" : "Resume"}</Button>
              <Button variant="outline" onClick={reset} className="font-mono text-sm">Reset</Button>
            </div>
            {phase === "break" && (<Button variant="ghost" size="sm" onClick={() => { setPhase("focus"); setSeconds(WORK_SECONDS); setRunning(true); }} className="font-mono text-xs text-muted-foreground">Skip Break</Button>)}
          </CardContent>
        </Card>
        <Card className="bg-card/80 backdrop-blur-sm border-border/50">
          <CardHeader className="pb-3">
            <div className="flex items-center justify-between">
              <CardTitle className="font-display text-base font-bold tracking-wide">CHECKLIST</CardTitle>
              <TooltipProvider><Tooltip><TooltipTrigger asChild><Button variant="outline" size="sm" disabled className="font-mono text-xs gap-1"><Sparkles className="h-3 w-3" /> AI Suggest</Button></TooltipTrigger><TooltipContent>Coming soon</TooltipContent></Tooltip></TooltipProvider>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {checklist.length === 0 ? (<p className="text-sm text-muted-foreground text-center py-4">No checklist items for this task.</p>) : (
              checklist.map((item) => (
                <div key={item.id} className="flex items-start gap-3 rounded-lg px-3 py-2 hover:bg-muted/20 transition-colors">
                  <Checkbox checked={item.completed} onCheckedChange={() => toggleCheck(item.id)} className="mt-0.5" />
                  <span className={cn("text-sm", item.completed && "line-through text-muted-foreground")}>{item.text}</span>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
