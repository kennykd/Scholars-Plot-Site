"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  FileText,
  Flame,
  ListChecks,
  Sparkles,
  Star,
  Timer as TimerIcon,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The hero's "blueprint monitor": an interactive, auto-cycling preview that
 * mirrors the real app surfaces (Tasks, Calendar, Timer, Ploty, Analytics).
 * Each panel is a faithful stylized rendering of the actual components
 * (see app/components/tasks/task-card.tsx, chat/action-card.tsx, etc.).
 */

const TABS = [
  { id: "tasks", label: "Tasks", icon: ListChecks },
  { id: "calendar", label: "Calendar", icon: CalendarDays },
  { id: "timer", label: "Timer", icon: TimerIcon },
  { id: "ploty", label: "Ploty", icon: Sparkles },
  { id: "analytics", label: "Analytics", icon: BarChart3 },
] as const;

type TabId = (typeof TABS)[number]["id"];

const CAPTIONS: Record<TabId, string> = {
  tasks: "Priority-ranked tasks with AI scoring, smart deadlines & one-tap status.",
  calendar: "Every task and study session on one FullCalendar timeline.",
  timer: "Pomodoro study sessions with focus / break phases and reminders.",
  ploty: "Ploty turns a sentence into ready-to-apply task & study drafts.",
  analytics: "Completion rate, streaks and focus hours, tracked over time.",
};

const CYCLE_MS = 4500;

export function FeatureShowcase() {
  const [active, setActive] = useState<TabId>("tasks");
  const [paused, setPaused] = useState(false);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    if (paused) return;
    const id = setInterval(() => {
      setActive((cur) => {
        const idx = TABS.findIndex((t) => t.id === cur);
        return TABS[(idx + 1) % TABS.length].id;
      });
    }, CYCLE_MS);
    return () => clearInterval(id);
  }, [paused, nonce]);

  function selectTab(id: TabId) {
    setActive(id);
    setNonce((n) => n + 1);
  }

  return (
    <div
      className="blueprint-ticks relative w-full max-w-lg rounded-xl border border-white/15 bg-[#0f1a66]/70 shadow-2xl backdrop-blur-md"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)}
      onBlurCapture={() => setPaused(false)}
    >
      {/* Window chrome */}
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <div className="flex items-center gap-2">
          <span className="h-2.5 w-2.5 rounded-full bg-[#FF4D2E]/80" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/25" />
          <span className="h-2.5 w-2.5 rounded-full bg-white/15" />
        </div>
        <span className="font-mono text-[10px] tracking-[0.25em] text-white/40">
          SCHOLAR&apos;S PLOT SITE — LIVE PREVIEW
        </span>
      </div>

      {/* Tabs */}
      <div
        role="tablist"
        aria-label="Feature preview"
        className="flex gap-1 border-b border-white/10 px-2 pt-2"
      >
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const isActive = tab.id === active;
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => selectTab(tab.id)}
              className={cn(
                "group relative flex flex-1 items-center justify-center gap-1.5 rounded-t-md px-2 py-2 font-mono text-[11px] transition-colors",
                isActive
                  ? "text-white"
                  : "text-white/45 hover:text-white/80",
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">{tab.label}</span>
              {isActive && (
                <motion.span
                  layoutId="tab-underline"
                  className="absolute inset-x-1 -bottom-px h-0.5 rounded-full bg-[#FF4D2E]"
                />
              )}
            </button>
          );
        })}
      </div>

      {/* Panel */}
      <div className="relative min-h-[19rem] overflow-hidden p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={active}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.28, ease: "easeOut" }}
          >
            {active === "tasks" && <TasksPanel />}
            {active === "calendar" && <CalendarPanel />}
            {active === "timer" && <TimerPanel />}
            {active === "ploty" && <PlotyPanel />}
            {active === "analytics" && <AnalyticsPanel />}
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Caption + cycle dots */}
      <div className="flex items-center justify-between gap-3 border-t border-white/10 px-4 py-3">
        <p className="font-mono text-[10px] leading-4 text-white/45">
          {CAPTIONS[active]}
        </p>
        <div className="flex shrink-0 items-center gap-1.5">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              aria-label={`Show ${tab.label}`}
              onClick={() => selectTab(tab.id)}
              className={cn(
                "h-1.5 rounded-full transition-all",
                tab.id === active ? "w-4 bg-[#FF4D2E]" : "w-1.5 bg-white/25",
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

/* ── shared bits ─────────────────────────────────────────── */

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`Priority ${value} of 5`}>
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          key={i}
          className={cn("h-3 w-3", value >= i + 1 ? "text-[#FF4D2E]" : "text-white/20")}
          fill="currentColor"
        />
      ))}
    </div>
  );
}

/* ── Tasks ───────────────────────────────────────────────── */

const TASK_ROWS = [
  {
    title: "Finish OS lab report",
    priority: 5,
    status: "In Progress",
    statusCls: "text-[#FF4D2E] border-[#FF4D2E]/40",
    borderCls: "border-l-red-500",
    badge: "Today",
    badgeCls: "bg-orange-500/20 text-orange-300 border-orange-500/30",
    done: false,
  },
  {
    title: "Submit ethics essay",
    priority: 4,
    status: "Not Started",
    statusCls: "text-white/55 border-white/20",
    borderCls: "border-l-sky-400",
    badge: "Overdue",
    badgeCls: "bg-red-500/20 text-red-300 border-red-500/30",
    done: false,
  },
  {
    title: "Read Ch. 7 — Databases",
    priority: 3,
    status: "Not Started",
    statusCls: "text-white/55 border-white/20",
    borderCls: "border-l-amber-400",
    badge: "Tomorrow",
    badgeCls: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30",
    done: false,
  },
  {
    title: "Group project sync notes",
    priority: 2,
    status: "Completed",
    statusCls: "text-emerald-300 border-emerald-400/30",
    borderCls: "border-l-blue-400",
    badge: "Mar 14",
    badgeCls: "bg-white/10 text-white/45 border-white/15",
    done: true,
  },
];

function TasksPanel() {
  return (
    <div className="space-y-2">
      {TASK_ROWS.map((t) => (
        <div
          key={t.title}
          className={cn(
            "flex items-center gap-3 rounded-lg border-l-4 bg-white/[0.04] px-3 py-2.5",
            t.borderCls,
            t.done && "opacity-60",
          )}
        >
          <span
            className={cn(
              "flex h-4 w-4 shrink-0 items-center justify-center rounded border",
              t.done
                ? "border-[#FF4D2E] bg-[#FF4D2E] text-white"
                : "border-white/30",
            )}
          >
            {t.done && <Check className="h-3 w-3" strokeWidth={3} />}
          </span>
          <div className="min-w-0 flex-1">
            <p
              className={cn(
                "truncate text-[13px] font-medium text-white",
                t.done && "text-white/50 line-through",
              )}
            >
              {t.title}
            </p>
            <div className="mt-1 flex items-center gap-2">
              <Stars value={t.priority} />
              <span
                className={cn(
                  "rounded border px-1.5 py-px font-mono text-[9px]",
                  t.statusCls,
                )}
              >
                {t.status}
              </span>
            </div>
          </div>
          <span
            className={cn("shrink-0 rounded border px-2 py-0.5 font-mono text-[10px]", t.badgeCls)}
          >
            {t.badge}
          </span>
          <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
        </div>
      ))}
    </div>
  );
}

/* ── Calendar ────────────────────────────────────────────── */

/* Week time-grid — mirrors the app's default FullCalendar timeGridWeek view */
const WEEK = ["MON", "TUE", "WED", "THU", "FRI", "SAT", "SUN"];
const WEEK_DATES = [9, 10, 11, 12, 13, 14, 15];
const TODAY_COL = 2; // Wed
const HOURS = ["8a", "9a", "10a", "11a", "12p", "1p"];
const SLOT_H = 22; // px per hour row

// Task deadlines = #FF4D2E, study sessions = #3b82f6 (see calendar-adapters.ts)
type TimedEvent = { day: number; start: number; len: number; label: string; type: "task" | "study" };
const TIMED_EVENTS: TimedEvent[] = [
  { day: 0, start: 1, len: 1, label: "Calc study", type: "study" },
  { day: 1, start: 3, len: 1.5, label: "OS lab", type: "task" },
  { day: 2, start: 2, len: 1, label: "Group sync", type: "study" },
  { day: 2, start: 4, len: 1, label: "Read DB", type: "study" },
  { day: 4, start: 1, len: 2, label: "Midterm", type: "task" },
];

function CalendarPanel() {
  return (
    <div className="overflow-hidden rounded-lg border border-white/10">
      {/* Day header row */}
      <div className="grid grid-cols-[1.75rem_repeat(7,1fr)] border-b border-white/10 bg-white/[0.03]">
        <div />
        {WEEK.map((d, i) => (
          <div
            key={d}
            className={cn(
              "border-l border-white/5 py-1 text-center",
              i === TODAY_COL && "bg-[#FF4D2E]/10",
            )}
          >
            <div className="font-mono text-[8px] tracking-wider text-white/40">{d[0]}</div>
            <div
              className={cn(
                "text-[11px] font-bold leading-tight",
                i === TODAY_COL ? "text-[#FF4D2E]" : "text-white/70",
              )}
            >
              {WEEK_DATES[i]}
            </div>
          </div>
        ))}
      </div>

      {/* Body: time gutter + day columns */}
      <div className="grid grid-cols-[1.75rem_repeat(7,1fr)]">
        {/* time gutter */}
        <div className="flex flex-col">
          {HOURS.map((h) => (
            <div
              key={h}
              style={{ height: SLOT_H }}
              className="pr-1 text-right font-mono text-[7px] leading-none text-white/30"
            >
              {h}
            </div>
          ))}
        </div>

        {/* 7 day columns */}
        {WEEK.map((d, col) => (
          <div
            key={d}
            className={cn("relative border-l border-white/5", col === TODAY_COL && "bg-[#FF4D2E]/[0.04]")}
            style={{ height: SLOT_H * HOURS.length }}
          >
            {/* hour gridlines */}
            {HOURS.map((h) => (
              <div key={h} style={{ height: SLOT_H }} className="border-t border-white/[0.06]" />
            ))}

            {/* events */}
            {TIMED_EVENTS.filter((e) => e.day === col).map((e) => (
              <div
                key={e.label}
                style={{ top: e.start * SLOT_H, height: e.len * SLOT_H - 2 }}
                className={cn(
                  "absolute inset-x-0.5 overflow-hidden rounded-sm border-l-2 px-1 py-0.5 text-[7px] font-medium leading-tight text-white",
                  e.type === "task"
                    ? "border-l-[#FF4D2E] bg-[#FF4D2E]/85"
                    : "border-l-[#3b82f6] bg-[#3b82f6]/85",
                )}
              >
                {e.label}
              </div>
            ))}

            {/* now indicator on today */}
            {col === TODAY_COL && (
              <div
                className="absolute inset-x-0 z-10 flex items-center"
                style={{ top: 3.5 * SLOT_H }}
              >
                <span className="h-1.5 w-1.5 -ml-0.5 rounded-full bg-red-500" />
                <span className="h-px flex-1 bg-red-500" />
              </div>
            )}
          </div>
        ))}
      </div>

      {/* legend */}
      <div className="flex items-center justify-center gap-4 border-t border-white/10 py-1.5 font-mono text-[8px] text-white/45">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-[#FF4D2E]" /> Task deadlines
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-[#3b82f6]" /> Study sessions
        </span>
      </div>
    </div>
  );
}

/* ── Timer ───────────────────────────────────────────────── */

function TimerPanel() {
  const r = 54;
  const c = 2 * Math.PI * r;
  const progress = 0.64;
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-3">
      <span className="rounded-full border border-[#FF4D2E]/40 bg-[#FF4D2E]/10 px-3 py-1 font-mono text-[10px] tracking-[0.3em] text-[#FF4D2E]">
        FOCUS
      </span>
      <div className="relative h-44 w-44">
        <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
          <motion.circle
            cx="70"
            cy="70"
            r={r}
            fill="none"
            stroke="#FF4D2E"
            strokeWidth="9"
            strokeLinecap="round"
            strokeDasharray={c}
            initial={{ strokeDashoffset: c }}
            animate={{ strokeDashoffset: c * (1 - progress) }}
            transition={{ duration: 1.1, ease: "easeOut" }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-display text-3xl font-extrabold tracking-tight text-white">18:24</span>
          <span className="font-mono text-[10px] text-white/40">REMAINING</span>
        </div>
      </div>
      <div className="flex items-center gap-4 font-mono text-[10px] text-white/50">
        <span>ROUND 2 / 4</span>
        <span className="h-1 w-1 rounded-full bg-white/30" />
        <span>25m FOCUS · 5m BREAK</span>
      </div>
    </div>
  );
}

/* ── Ploty (AI chat + action card) ───────────────────────── */

function PlotyPanel() {
  return (
    <div className="space-y-3">
      {/* user bubble */}
      <div className="flex justify-end">
        <p className="max-w-[78%] rounded-2xl rounded-br-sm bg-[#FF4D2E] px-3 py-2 text-[12px] text-white">
          I have a calculus midterm Friday — help me prep.
        </p>
      </div>
      {/* ploty reply */}
      <div className="flex items-start gap-2">
        <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10 text-[#FF4D2E]">
          <Sparkles className="h-3.5 w-3.5" />
        </span>
        <p className="max-w-[80%] rounded-2xl rounded-bl-sm bg-white/[0.06] px-3 py-2 text-[12px] text-white/80">
          On it. Here&apos;s a task draft to lock it in:
        </p>
      </div>

      {/* action card — mirrors chat/action-card.tsx */}
      <div className="rounded-lg border border-white/15 bg-[#0b1450]/80 shadow-sm">
        <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
          <div className="flex items-center gap-2">
            <Sparkles className="h-3.5 w-3.5 text-[#FF4D2E]" />
            <span className="font-mono text-[10px] font-semibold uppercase tracking-widest text-white/50">
              Task Draft
            </span>
          </div>
          <span className="rounded border border-white/20 px-1.5 py-px font-mono text-[9px] text-white/50">
            Pending
          </span>
        </div>
        <div className="space-y-2.5 p-3">
          <div className="flex items-start gap-2.5">
            <span className="mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-[#FF4D2E]/15 text-[#FF4D2E]">
              <FileText className="h-3.5 w-3.5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12px] font-semibold text-white">
                Revise Calculus — Integrals
              </p>
              <p className="mt-0.5 line-clamp-2 text-[10px] leading-4 text-white/50">
                Work through past papers and Ch. 5–6 problem sets.
              </p>
            </div>
          </div>
          <div className="flex gap-2">
            <span className="flex flex-1 items-center gap-1.5 rounded border border-white/15 px-2 py-1 font-mono text-[9px] text-white/60">
              <CalendarDays className="h-3 w-3" /> Mar 13, 2026
            </span>
            <span className="flex-1 rounded border border-red-500/30 bg-red-500/10 px-2 py-1 text-right font-mono text-[9px] text-red-300">
              Priority High
            </span>
          </div>
        </div>
        <div className="flex gap-2 border-t border-white/10 px-3 py-2">
          <span className="flex flex-1 items-center justify-center gap-1.5 rounded border border-white/15 py-1.5 font-mono text-[10px] text-white/60">
            <X className="h-3 w-3" /> Dismiss
          </span>
          <span className="flex flex-1 items-center justify-center gap-1.5 rounded bg-[#FF4D2E] py-1.5 font-mono text-[10px] text-white">
            <Check className="h-3 w-3" /> Apply
          </span>
        </div>
      </div>
    </div>
  );
}

/* ── Analytics ───────────────────────────────────────────── */

const BARS = [40, 65, 52, 80, 48, 90, 70];

function AnalyticsPanel() {
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "COMPLETION", value: "87%", icon: BarChart3 },
          { label: "STREAK", value: "12d", icon: Flame },
          { label: "FOCUS HRS", value: "24.5", icon: TimerIcon },
        ].map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className="rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
              <Icon className="mb-1 h-3.5 w-3.5 text-[#FF4D2E]" />
              <div className="font-display text-lg font-bold leading-none text-white">{s.value}</div>
              <div className="mt-1 font-mono text-[8px] tracking-wider text-white/40">{s.label}</div>
            </div>
          );
        })}
      </div>
      <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
        <div className="mb-2 flex items-center justify-between font-mono text-[9px] text-white/40">
          <span>WEEKLY PRODUCTIVITY</span>
          <span>TASKS DONE</span>
        </div>
        <div className="flex h-24 items-end justify-between gap-1.5">
          {BARS.map((h, i) => (
            <motion.div
              key={i}
              className="w-full rounded-t bg-gradient-to-t from-[#FF4D2E]/40 to-[#FF4D2E]"
              initial={{ height: 0 }}
              animate={{ height: `${h}%` }}
              transition={{ duration: 0.5, delay: i * 0.05, ease: "easeOut" }}
            />
          ))}
        </div>
        <div className="mt-1.5 flex justify-between font-mono text-[8px] text-white/30">
          {WEEK.map((d) => (
            <span key={d}>{d[0]}</span>
          ))}
        </div>
      </div>
    </div>
  );
}
