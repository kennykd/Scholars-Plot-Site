"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Timer } from "lucide-react";
import { Phase } from "@/types";

const formatDuration = (totalMinutes: number) => {
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (hours === 0) return `${minutes}m`;
  if (minutes === 0) return `${hours}h`;
  return `${hours}h ${minutes}m`;
};

const playTone = (frequency = 880, durationMs = 220) => {
  if (typeof window === "undefined") return;
  try {
    const AudioContextClass =
      window.AudioContext ||
      (
        window as typeof window & {
          webkitAudioContext?: typeof AudioContext;
        }
      ).webkitAudioContext;

    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gain = audioContext.createGain();

    oscillator.type = "sine";
    oscillator.frequency.value = frequency;
    gain.gain.value = 0.08;

    oscillator.connect(gain);
    gain.connect(audioContext.destination);

    oscillator.start();
    oscillator.stop(audioContext.currentTime + durationMs / 1000);
    oscillator.onended = () => audioContext.close();
  } catch {
    // no-op
  }
};

function CircularTimer({
  seconds,
  total,
  phase,
}: {
  seconds: number;
  total: number;
  phase: Phase;
}) {
  const radius = 90;
  const circumference = 2 * Math.PI * radius;
  const ratio = total > 0 ? seconds / total : 0;
  const dashOffset = circumference * (1 - ratio);
  const mins = Math.floor(seconds / 60)
    .toString()
    .padStart(2, "0");
  const secs = (seconds % 60).toString().padStart(2, "0");
  const label =
    phase === "break" ? "BREAK" : phase === "focus" ? "FOCUS" : "READY";

  return (
    <div className="relative flex items-center justify-center">
      <svg width="220" height="220" className="-rotate-90">
        <circle
          cx="110"
          cy="110"
          r={radius}
          fill="none"
          stroke="currentColor"
          strokeWidth="8"
          className="text-muted/30"
        />
        <circle
          cx="110"
          cy="110"
          r={radius}
          fill="none"
          stroke={phase === "break" ? "#3b82f6" : "var(--accent)"}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          className="transition-all duration-1000"
        />
      </svg>
      <div className="absolute flex flex-col items-center">
        <span className="font-mono text-5xl font-bold text-foreground tabular-nums">
          {mins}:{secs}
        </span>
        <span className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">
          {label}
        </span>
      </div>
    </div>
  );
}

export default function QuickTimerPage() {
  const searchParams = useSearchParams();

  // Parse timer config from URL params
  const title = searchParams.get("title") || "Timer Only";
  const focusMinutesParam = Number(searchParams.get("focus")) || 25;
  const breakMinutesParam = Number(searchParams.get("break")) || 5;
  const totalMinutesParam = Number(searchParams.get("total")) || 60;
  const autostart = searchParams.get("autostart") === "1";

  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [totalSecondsRemaining, setTotalSecondsRemaining] = useState(0);
  const [sessionStatus, setSessionStatus] = useState<
    "idle" | "running" | "paused" | "completed"
  >("idle");

  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const totalSecondsRemainingRef = useRef(0);
  const isPausedSessionRef = useRef(false);

  // Initialize timer from params
  useEffect(() => {
    const focusSeconds = focusMinutesParam * 60;
    const totalSeconds = totalMinutesParam * 60;

    totalSecondsRemainingRef.current = totalSeconds;

    const timeout = window.setTimeout(() => {
      setPhase("focus");
      setSeconds(focusSeconds);
      setTotalSecondsRemaining(totalSeconds);

      // When launched from "Quick Timer", start counting down right away.
      if (autostart) {
        setRunning(true);
        setSessionStatus("running");
      }
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [focusMinutesParam, totalMinutesParam, autostart]);

  const focusSeconds = focusMinutesParam * 60;
  const breakSeconds = breakMinutesParam * 60;
  const totalSeconds = totalMinutesParam * 60;
  const totalProgress =
    totalSeconds > 0
      ? ((totalSeconds - totalSecondsRemaining) / totalSeconds) * 100
      : 0;
  const totalRemainingLabel = formatDuration(
    Math.ceil(totalSecondsRemaining / 60),
  );

  // Countdown interval
  useEffect(() => {
    if (!running || phase === "idle") return;

    intervalRef.current = setInterval(() => {
      setSeconds((current) => {
        if (current <= 1) {
          if (phase === "focus") {
            setPhase("break");
            return breakSeconds;
          }
          if (phase === "break") {
            setPhase("focus");
            return focusSeconds;
          }
        }
        return current - 1;
      });
      setTotalSecondsRemaining((total) => {
        const newTotal = Math.max(0, total - 1);
        totalSecondsRemainingRef.current = newTotal;
        return newTotal;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, phase, breakSeconds, focusSeconds]);

  // Auto-complete when timer finishes
  useEffect(() => {
    if (totalSecondsRemaining > 0) return;
    if (!running) return;

    const timeout = window.setTimeout(() => {
      playTone(520, 300);
      setRunning(false);
      setPhase("idle");
      setSessionStatus("completed");
      toast.success(`Session complete: ${title}`);
    }, 0);

    return () => window.clearTimeout(timeout);
  }, [totalSecondsRemaining, running, title]);

  const toggleRunning = () => {
    if (phase === "idle") {
      // Starting fresh or resuming
      if (isPausedSessionRef.current) {
        isPausedSessionRef.current = false;
        setPhase("focus");
        setSeconds(totalSecondsRemaining);
      } else {
        // Starting fresh
        setPhase("focus");
        setSeconds(focusSeconds);
        setTotalSecondsRemaining(totalSeconds);
      }
      setRunning(true);
      setSessionStatus("running");
      return;
    }

    if (running) {
      // Pausing
      isPausedSessionRef.current = true;
      setRunning(false);
      setSessionStatus("paused");
    } else {
      // Resuming
      setRunning(true);
      setSessionStatus("running");
    }
  };

  const resetSession = () => {
    const wasRunning = running;
    setRunning(false);

    const confirmed = window.confirm(
      "Are you sure you want to reset the timer?",
    );

    if (!confirmed) {
      if (wasRunning) {
        setRunning(true);
      }
      return;
    }

    setRunning(false);
    setPhase("idle");
    setSeconds(focusSeconds);
    setTotalSecondsRemaining(totalSeconds);
    setSessionStatus("idle");
    isPausedSessionRef.current = false;
  };

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground tracking-widest">
            FOCUS MODE
          </p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            {title}
          </h1>
          <p className="text-xs text-muted-foreground">Quick Timer</p>
        </div>
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-muted-foreground" />
          <Badge variant="outline" className="font-mono text-[10px]">
            {focusMinutesParam}m / {breakMinutesParam}m
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            Total {formatDuration(totalMinutesParam)}
          </Badge>
          <Badge
            variant={sessionStatus === "completed" ? "secondary" : "outline"}
            className="text-[10px]"
          >
            {sessionStatus.charAt(0).toUpperCase() + sessionStatus.slice(1)}
          </Badge>
          <Button variant="outline" size="sm" asChild>
            <Link href="/study" className="font-mono text-xs">
              Back to Planner
            </Link>
          </Button>
        </div>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <Card className="lg:col-span-2 bg-card/80 backdrop-blur-sm border-border/50">
          <CardContent className="flex flex-col items-center gap-6 py-8">
            <CircularTimer
              seconds={seconds}
              total={phase === "break" ? breakSeconds : focusSeconds}
              phase={phase}
            />
            <div className="w-full max-w-xs space-y-2">
              <div className="flex items-center justify-between text-xs text-muted-foreground">
                <span>Total remaining</span>
                <span className="font-mono">{totalRemainingLabel}</span>
              </div>
              <Progress value={totalProgress} />
            </div>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Button
                onClick={toggleRunning}
                className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold px-8"
              >
                {running ? "Pause" : phase === "idle" ? "Start" : "Resume"}
              </Button>
              <Button variant="outline" onClick={resetSession}>
                Reset
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base font-bold tracking-wide">
                TIMER SETTINGS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <p className="text-muted-foreground">Focus Block</p>
                <p className="font-mono font-semibold">{focusMinutesParam}m</p>
              </div>
              <div>
                <p className="text-muted-foreground">Break Duration</p>
                <p className="font-mono font-semibold">{breakMinutesParam}m</p>
              </div>
              <div>
                <p className="text-muted-foreground">Total Time</p>
                <p className="font-mono font-semibold">
                  {formatDuration(totalMinutesParam)}
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
