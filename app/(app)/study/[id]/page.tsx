"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import { Paperclip, Timer } from "lucide-react";
import { format, parseISO } from "date-fns";
import { StudySession, Phase } from "@/types";
import { useRouter } from "next/navigation";

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
  const router = useRouter();
  const sessionId = Array.isArray(rawId) ? rawId[0] : (rawId ?? "");
  const [session, setSession] = useState<StudySession | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [phase, setPhase] = useState<Phase>("idle");
  const [seconds, setSeconds] = useState(0);
  const [running, setRunning] = useState(false);
  const [totalSecondsRemaining, setTotalSecondsRemaining] = useState(0);
  const initializedRef = useRef(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const sessionRef = useRef<StudySession | null>(null);
  const runningRef = useRef(false);
  const totalSecondsRemainingRef = useRef(0);
  const isPausedSessionRef = useRef(false);

  useEffect(() => {
    if (!sessionId) return;

    const fetchSession = async () => {
      try {
        const response = await fetch(`/api/study/${sessionId}`);
        if (!response.ok) {
          setLoaded(true);
          return;
        }
        const data = await response.json();
        const apiStudy = data.studySession;
        const userSessionData = data.userSessionData;

        if (!apiStudy) {
          setLoaded(true);
          return;
        }

        // Extract attachment names from study_session_user if available
        const attachmentNames: string[] = [];
        if (
          apiStudy.study_session_user &&
          Array.isArray(apiStudy.study_session_user)
        ) {
          apiStudy.study_session_user.forEach((ssu: any) => {
            if (ssu.attachment && ssu.attachment.file_name) {
              attachmentNames.push(ssu.attachment.file_name);
            }
          });
        }

        const mapped: StudySession = {
          id: String(apiStudy.study_session_id),
          title: apiStudy.study_session_name,
          notes: apiStudy.study_session_description ?? "",
          attachments: attachmentNames,
          scheduledAt: apiStudy.study_session_scheduled_at
            ? new Date(apiStudy.study_session_scheduled_at).toISOString()
            : new Date().toISOString(),
          focusMinutes: apiStudy.focus_minutes ?? 25,
          breakMinutes: apiStudy.break_minutes ?? 5,
          totalMinutes: apiStudy.total_minutes ?? 60,
          sessionStatus: userSessionData?.status ?? "idle",
          createdAt: apiStudy.study_session_created_at
            ? new Date(apiStudy.study_session_created_at).toISOString()
            : new Date().toISOString(),
          isTimerOnly: false,
          current_time:
            userSessionData && userSessionData.current_time !== undefined
              ? userSessionData.current_time
              : undefined,
        };

        console.debug("Fetched session from API", {
          apiStudy,
          userSessionData,
          mapped,
        });
        setSession(mapped);

        // If server reports a current_time, initialize the timer state so the UI
        // immediately reflects the server's elapsed seconds. This applies whether
        // the server status is 'paused' or 'running' (covers Resume via the list view).
        if (userSessionData?.current_time !== undefined) {
          const elapsed = Math.max(0, userSessionData.current_time);
          const total = (mapped.totalMinutes ?? 0) * 60;
          const remainingTotal = Math.max(0, total - elapsed);
          const focusSec = (mapped.focusMinutes ?? 0) * 60;
          const breakSec = (mapped.breakMinutes ?? 0) * 60;
          const cycle = Math.max(1, focusSec + breakSec);
          const elapsedInCycle = cycle > 0 ? elapsed % cycle : 0;

          let restoredPhase: Phase = "focus";
          let restoredSeconds = focusSec;

          if (breakSec === 0) {
            restoredPhase = "focus";
            restoredSeconds = Math.max(0, focusSec - elapsedInCycle);
          } else {
            if (elapsedInCycle < focusSec) {
              restoredPhase = "focus";
              restoredSeconds = Math.max(0, focusSec - elapsedInCycle);
            } else {
              restoredPhase = "break";
              restoredSeconds = Math.max(0, cycle - elapsedInCycle);
            }
          }

          console.debug("Initializing timer state from API (fetch)", {
            elapsed,
            remainingTotal,
            restoredPhase,
            restoredSeconds,
            serverStatus: userSessionData.status,
          });

          setPhase(restoredPhase);
          setSeconds(restoredSeconds);
          setTotalSecondsRemaining(remainingTotal);
          // Start running immediately if server reports running
          setRunning(userSessionData.status === "running");
          isPausedSessionRef.current = userSessionData.status !== "running";
          initializedRef.current = true;
        }

        setLoaded(true);
      } catch (error) {
        console.error(
          "Error fetching study session from api/study/[id] :",
          error,
        );
        setLoaded(true);
      }
    };

    fetchSession();
  }, [sessionId]);

  // Keep refs in sync with state
  useEffect(() => {
    sessionRef.current = session;
  }, [session]);

  useEffect(() => {
    runningRef.current = running;
  }, [running]);

  // IMPORTANT CONST: Study session data
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

    // If session was paused, restore the exact paused state.
    // Prefer any exact paused fields persisted locally; if missing,
    // derive paused state from `current_time` returned by the API.
    if (
      session.sessionStatus === "paused" &&
      session.paused_seconds !== undefined &&
      session.paused_phase !== undefined &&
      session.paused_total_seconds_remaining !== undefined
    ) {
      setSeconds(session.paused_seconds);
      setPhase(session.paused_phase);
      setTotalSecondsRemaining(session.paused_total_seconds_remaining);
      isPausedSessionRef.current = true;
    } else if (
      session.sessionStatus === "paused" &&
      session.current_time !== undefined
    ) {
      console.debug("Restoring paused state from current_time", {
        id: session.id,
        current_time: session.current_time,
        focusMinutes: session.focusMinutes,
        breakMinutes: session.breakMinutes,
        totalMinutes: session.totalMinutes,
      });
      // `current_time` is elapsed seconds stored on the server.
      const elapsed = Math.max(0, session.current_time);
      const remainingTotal = Math.max(0, totalSeconds - elapsed);

      // Determine phase and seconds remaining in the current phase
      const cycle = Math.max(1, focusSeconds + breakSeconds);
      const elapsedInCycle = cycle > 0 ? elapsed % cycle : 0;

      if (breakSeconds === 0) {
        // No break configured — always in focus
        setPhase("focus");
        const secondsLeft = Math.max(0, focusSeconds - elapsedInCycle);
        setSeconds(secondsLeft);
      } else {
        if (elapsedInCycle < focusSeconds) {
          setPhase("focus");
          setSeconds(Math.max(0, focusSeconds - elapsedInCycle));
        } else {
          setPhase("break");
          setSeconds(Math.max(0, cycle - elapsedInCycle));
        }
      }

      setTotalSecondsRemaining(remainingTotal);
      isPausedSessionRef.current = true;
    } else {
      // For idle/completed or sessions without paused state
      setPhase("idle");
      setSeconds(focusSeconds);
      setTotalSecondsRemaining(totalSeconds);
      isPausedSessionRef.current = false;
    }

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

  // Auto-pause when navigating away
  useEffect(() => {
    return () => {
      if (
        sessionRef.current &&
        runningRef.current &&
        totalSecondsRemainingRef.current > 0
      ) {
        const totalSecondsAtUnmount =
          (sessionRef.current?.totalMinutes ?? 0) * 60;
        const elapsedSeconds =
          totalSecondsAtUnmount - totalSecondsRemainingRef.current;
        console.debug("Auto-pausing session on unmount", {
          sessionId: sessionRef.current.id,
          elapsedSeconds,
          totalSecondsAtUnmount,
          totalSecondsRemainingRef: totalSecondsRemainingRef.current,
        });
        fetch(`/api/study/${sessionRef.current.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            status: "paused",
            current_time: elapsedSeconds,
          }),
        }).catch((error) =>
          console.error("Error auto-pausing session:", error),
        );
      }
    };
  }, []);

  // Completing the session, marking as done
  useEffect(() => {
    if (!session) return;
    if (totalSecondsRemaining > 0) return;
    if (!running) return; // Only auto-complete if the timer was actually running

    playTone(520, 300);
    setRunning(false);
    setPhase("idle");
    setSession((prev) => (prev ? { ...prev, sessionStatus: "paused" } : prev));
    toast.success(
      `Timer finished for ${session.title}. Mark it as done when ready.`,
    );
  }, [totalSecondsRemaining, session, running, totalSeconds]);

  // Run the timer
  const toggleRunning = () => {
    if (!session) return;
    if (phase === "idle") {
      // If this is a paused session being resumed, don't reset the timer
      if (isPausedSessionRef.current) {
        isPausedSessionRef.current = false; // Mark as no longer paused
        setPhase("focus");
        // Set seconds to match the remaining time so the display is correct
        setSeconds(totalSecondsRemaining);
        setRunning(true);
        // Don't reset totalSecondsRemaining - keep the paused time
      } else {
        // Starting a fresh session
        setPhase("focus");
        setSeconds(focusSeconds);
        setTotalSecondsRemaining(totalSeconds);
        setRunning(true);
      }

      // Update database status with start time (or resume)
      fetch(`/api/study/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "running",
          started_at: new Date(),
        }),
      })
        .then((res) => {
          if (res.ok) {
            setSession((prev) =>
              prev ? { ...prev, sessionStatus: "running" } : prev,
            );
          } else {
            console.error("Failed to update session status");
          }
        })
        .catch((error) => console.error("Error updating session:", error));

      return;
    }

    if (running) {
      // Pausing - save the exact paused state to localStorage
      const pausedState = {
        paused_seconds: seconds,
        paused_phase: phase,
        paused_total_seconds_remaining: totalSecondsRemaining,
      };

      console.debug("Pausing session locally", { pausedState });
      setSession((prev) =>
        prev
          ? {
              ...prev,
              sessionStatus: "paused",
              paused_seconds: pausedState.paused_seconds,
              paused_phase: pausedState.paused_phase,
              paused_total_seconds_remaining:
                pausedState.paused_total_seconds_remaining,
            }
          : prev,
      );

      // Also persist to database
      fetch(`/api/study/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "paused",
          current_time: totalSeconds - totalSecondsRemaining,
        }),
      }).catch((error) => console.error("Error pausing session:", error));

      setRunning(false);
    } else {
      // Resuming
      console.debug("Resuming session (client) for", session?.id);
      setRunning(true);
      fetch(`/api/study/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "running",
        }),
      })
        .then((res) => {
          if (res.ok) {
            setSession((prev) =>
              prev ? { ...prev, sessionStatus: "running" } : prev,
            );
          }
        })
        .catch((error) => console.error("Error resuming session:", error));
    }
  };

  // Reset session function (making sure to add an alert, and patch the data of the timer status)
  const resetSession = async () => {
    if (!session) return;

    const wasRunning = running;

    // Pause immediately while showing confirmation
    setRunning(false);

    // Persist paused state so server has an accurate current_time
    try {
      const current_time = Math.max(0, totalSeconds - totalSecondsRemaining);
      await fetch(`/api/study/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "paused", current_time }),
      });
      setSession((prev) =>
        prev ? { ...prev, sessionStatus: "paused" } : prev,
      );
    } catch (e) {
      console.error("Error persisting pause before reset:", e);
    }

    const confirmed = window.confirm(
      "Are you sure you want to reset the study session timer? This will clear the elapsed time.",
    );

    if (!confirmed) {
      // If user cancelled, restore previous running state
      if (wasRunning) {
        setRunning(true);
        fetch(`/api/study/${session.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: "running" }),
        })
          .then((res) => {
            if (res.ok) {
              setSession((prev) =>
                prev ? { ...prev, sessionStatus: "running" } : prev,
              );
            }
          })
          .catch((err) => console.error("Error resuming after cancel:", err));
      }
      return;
    }

    // User has confirmed the reset of the study session, set these values!
    setRunning(false);
    setPhase("idle");
    setSeconds(focusSeconds);
    setTotalSecondsRemaining(totalSeconds);

    // Persist reset to server (clear current_time and mark idle)
    try {
      await fetch(`/api/study/${session.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "idle", current_time: 0 }),
      });
      setSession((prev) => (prev ? { ...prev, sessionStatus: "idle" } : prev));
    } catch (e) {
      console.error("Error persisting reset:", e);
    }
  };

  const markAsDone = () => {
    if (!session) return; // Check user session
    // markAsDone confirmation popup
    const confirmed = window.confirm(
      "Are you sure you want to mark the selected study session(s) as done?",
    );
    if (!confirmed) return;

    setRunning(false);
    setPhase("idle");

    // Update database status with completion time and actual duration
    const actualDuration = totalSeconds - totalSecondsRemaining;
    fetch(`/api/study/${session.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "completed",
        completed_at: new Date(),
        actual_duration: actualDuration,
      }),
    })
      .then((res) => {
        if (res.ok) {
          setSession((prev) =>
            prev ? { ...prev, sessionStatus: "completed" } : prev,
          );
        }
      })
      .catch((error) => console.error("Error updating session:", error));

    toast.success(`Session complete: ${session.title}`);
    router.push(`/study`);
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
            variant={
              session.sessionStatus === "completed" ? "secondary" : "outline"
            }
            className="text-[10px]"
          >
            {session.sessionStatus.charAt(0).toUpperCase() +
              session.sessionStatus.slice(1)}
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
              <Button variant="ghost" onClick={markAsDone}>
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
