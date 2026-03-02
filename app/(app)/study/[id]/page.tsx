"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { mockStudySessions } from "@/lib/mock-data";
import { toast } from "sonner";
import { Paperclip, Timer } from "lucide-react";
import { format, parseISO } from "date-fns";

type Phase = "idle" | "focus" | "break";

type StudySessionLocal = {
  id: string;
  title: string;
  notes: string;
  attachments: string[];
  scheduledAt: string;
  focusMinutes: number;
  breakMinutes: number;
  totalMinutes: number;
  status: "planned" | "in-progress" | "completed";
  createdAt: string;
};

const STORAGE_KEY = "scholarsPlot.studySessions";

const seedSessions = (): StudySessionLocal[] =>
  mockStudySessions.map((session) => ({
    id: session.id,
    title: session.taskTitle ?? "Study Session",
    notes: "",
    attachments: [],
    scheduledAt: (session.scheduledAt ?? new Date()).toISOString(),
    focusMinutes: session.duration ?? 25,
    breakMinutes: session.breakDuration ?? 5,
    totalMinutes: 60,
    status: session.status === "completed" ? "completed" : "planned",
    createdAt: new Date().toISOString(),
  }));

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

export default function StudySessionPage() {
  const params = useParams();
  const rawId = params?.id;
  const sessionId = Array.isArray(rawId) ? rawId[0] : (rawId ?? "");
  const [sessions, setSessions] = useState<StudySessionLocal[]>([]);
  const [session, setSession] = useState<StudySessionLocal | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [totalSecondsRemaining, setTotalSecondsRemaining] = useState(0);
  const initializedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;
    if (stored) {
      try {
        setSessions(JSON.parse(stored));
      } catch {
        setSessions(seedSessions());
      }
    } else {
      setSessions(seedSessions());
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(sessions));
  }, [loaded, sessions]);

  useEffect(() => {
    if (!loaded) return;
    const found = sessions.find((item) => item.id === sessionId) ?? null;
    setSession(found);
  }, [loaded, sessions, sessionId]);

  const focusSeconds = (session?.focusMinutes ?? 0) * 60;
  const breakSeconds = (session?.breakMinutes ?? 0) * 60;
  const totalSeconds = (session?.totalMinutes ?? 0) * 60;
  const totalProgress =
    totalSeconds > 0
      ? ((totalSeconds - totalSecondsRemaining) / totalSeconds) * 100
      : 0;
  const totalRemainingLabel = formatDuration(
    Math.ceil(totalSecondsRemaining / 60),
  );

  useEffect(() => {
    if (!session || initializedRef.current) return;
    initializedRef.current = true;

    setPhase("idle");
    setSeconds(focusSeconds);
    setTotalSecondsRemaining(totalSeconds);
    setRunning(false);
  }, [session, focusSeconds, totalSeconds]);

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
      setTotalSecondsRemaining((total) => Math.max(0, total - 1));
    }, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [running, phase, breakSeconds, focusSeconds]);

  useEffect(() => {
    if (!session) return;
    if (totalSecondsRemaining > 0) return;

    playTone(520, 300);
    setRunning(false);
    setPhase("idle");
    setSessions((prev) =>
      prev.map((item) =>
        item.id === session.id ? { ...item, status: "completed" } : item,
      ),
    );
    toast.success(`Session complete: ${session.title}`);
  }, [totalSecondsRemaining, session]);

  const toggleRunning = () => {
    if (!session) return;
    if (phase === "idle") {
      setPhase("focus");
      setSeconds(focusSeconds);
      setTotalSecondsRemaining(totalSeconds);
      setRunning(true);
      setSessions((prev) =>
        prev.map((item) =>
          item.id === session.id ? { ...item, status: "in-progress" } : item,
        ),
      );
      return;
    }
    setRunning((prev) => !prev);
  };

  const resetSession = () => {
    if (!session) return;
    setRunning(false);
    setSeconds(phase === "break" ? breakSeconds : focusSeconds);
    setTotalSecondsRemaining(totalSeconds);
  };

  const markCompleted = () => {
    if (!session) return;
    setRunning(false);
    setPhase("idle");
    setSessions((prev) =>
      prev.map((item) =>
        item.id === session.id ? { ...item, status: "completed" } : item,
      ),
    );
    toast.success(`Session complete: ${session.title}`);
  };

  if (!loaded) {
    return (
      <div className="p-6">
        <p className="text-sm text-muted-foreground">Loading session...</p>
      </div>
    );
  }

  if (!session) {
    return (
      <div className="p-6 space-y-4">
        <h1 className="font-display text-2xl font-bold text-foreground">
          Session not found
        </h1>
        <p className="text-sm text-muted-foreground">
          This study session doesn’t exist or has been removed.
        </p>
        <Button asChild variant="outline">
          <Link href="/study">Back to Study</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="font-mono text-xs text-muted-foreground tracking-widest">
            FOCUS MODE
          </p>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            {session.title}
          </h1>
          <p className="text-xs text-muted-foreground">
            {format(parseISO(session.scheduledAt), "PPP p")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Timer className="h-5 w-5 text-muted-foreground" />
          <Badge variant="outline" className="font-mono text-[10px]">
            {session.focusMinutes}m / {session.breakMinutes}m
          </Badge>
          <Badge variant="secondary" className="text-[10px]">
            Total {formatDuration(session.totalMinutes)}
          </Badge>
          <Badge
            variant={session.status === "completed" ? "secondary" : "outline"}
            className="text-[10px]"
          >
            {session.status.toUpperCase()}
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
              <Button variant="ghost" onClick={markCompleted}>
                Mark Done
              </Button>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base font-bold tracking-wide">
                NOTES
              </CardTitle>
            </CardHeader>
            <CardContent>
              {session.notes ? (
                <p className="text-sm text-foreground whitespace-pre-wrap">
                  {session.notes}
                </p>
              ) : (
                <p className="text-sm text-muted-foreground">
                  No notes for this session.
                </p>
              )}
            </CardContent>
          </Card>
          <Card className="bg-card/80 backdrop-blur-sm border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="font-display text-base font-bold tracking-wide">
                ATTACHMENTS
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              {session.attachments.length ? (
                session.attachments.map((file, index) => (
                  <div
                    key={`${file}-${index}`}
                    className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/30 px-3 py-2 text-xs"
                  >
                    <Paperclip className="h-3 w-3 text-muted-foreground" />
                    <span className="truncate">{file}</span>
                  </div>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">
                  No attachments added.
                </p>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
