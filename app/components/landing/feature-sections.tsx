"use client";

import type { ReactNode } from "react";
import {
  BarChart3,
  CalendarDays,
  Check,
  ChevronRight,
  Flame,
  ListChecks,
  Sparkles,
  Star,
  Timer,
  Users,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { FeatureSection } from "./feature-section";

/* Shared blueprint panel frame for every section visual */
function PanelFrame({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="blueprint-ticks w-full max-w-md rounded-xl border border-white/15 bg-[#0f1a66]/70 shadow-2xl backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 px-4 py-2.5">
        <span className="font-mono text-[10px] tracking-[0.25em] text-white/40">
          {label}
        </span>
        <div className="flex gap-1.5">
          <span className="h-2 w-2 rounded-full bg-[#FF4D2E]/70" />
          <span className="h-2 w-2 rounded-full bg-white/20" />
        </div>
      </div>
      <div className="p-4">{children}</div>
    </div>
  );
}

function Stars({ value }: { value: number }) {
  return (
    <div className="flex items-center gap-0.5">
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

/* ── Visuals ─────────────────────────────────────────────── */

function TasksVisual() {
  const rows = [
    { t: "Finish OS lab report", p: 5, b: "Today", bc: "bg-orange-500/20 text-orange-300 border-orange-500/30", lc: "border-l-red-500" },
    { t: "Submit ethics essay", p: 4, b: "Overdue", bc: "bg-red-500/20 text-red-300 border-red-500/30", lc: "border-l-sky-400" },
    { t: "Read Ch. 7 — Databases", p: 3, b: "Tomorrow", bc: "bg-yellow-500/20 text-yellow-300 border-yellow-500/30", lc: "border-l-amber-400" },
  ];
  return (
    <PanelFrame label="TASKS — PRIORITY QUEUE">
      <div className="space-y-2">
        {rows.map((r) => (
          <div
            key={r.t}
            className={cn(
              "flex items-center gap-3 rounded-lg border-l-4 bg-white/[0.04] px-3 py-2.5",
              r.lc,
            )}
          >
            <span className="h-4 w-4 shrink-0 rounded border border-white/30" />
            <div className="min-w-0 flex-1">
              <p className="truncate text-[13px] font-medium text-white">{r.t}</p>
              <div className="mt-1">
                <Stars value={r.p} />
              </div>
            </div>
            <span className={cn("shrink-0 rounded border px-2 py-0.5 font-mono text-[10px]", r.bc)}>
              {r.b}
            </span>
            <ChevronRight className="h-4 w-4 shrink-0 text-white/30" />
          </div>
        ))}
      </div>
    </PanelFrame>
  );
}

function CalendarVisual() {
  // dayGridMonth — Mon-first, events as colored bars (task=#FF4D2E, study=#3b82f6)
  const days = Array.from({ length: 35 }, (_, i) => i - 2); // offset so the 1st lands mid-row
  const TODAY = 12;
  const monthEvents: Record<number, { label: string; type: "task" | "study" }[]> = {
    4: [{ label: "Calc study", type: "study" }],
    9: [{ label: "OS lab", type: "task" }],
    12: [{ label: "Group sync", type: "study" }, { label: "Read DB", type: "study" }],
    13: [{ label: "Essay due", type: "task" }],
    20: [{ label: "Midterm", type: "task" }],
    25: [{ label: "Review", type: "study" }],
  };
  return (
    <PanelFrame label="CALENDAR — MARCH 2026">
      <div className="grid grid-cols-7">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span key={i} className="pb-1 text-center font-mono text-[9px] text-white/35">
            {d}
          </span>
        ))}
        {days.map((d, i) => {
          const valid = d >= 1 && d <= 31;
          const isToday = d === TODAY;
          const evs = valid ? monthEvents[d] ?? [] : [];
          return (
            <div
              key={i}
              className={cn(
                "min-h-[2.6rem] border-t border-l border-white/[0.06] p-0.5",
                i % 7 === 6 && "border-r",
                i >= 28 && "border-b",
              )}
            >
              {valid && (
                <>
                  <div
                    className={cn(
                      "mb-0.5 text-right text-[9px] leading-none",
                      isToday
                        ? "ml-auto flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#FF4D2E] font-bold text-white"
                        : "text-white/60",
                    )}
                  >
                    {d}
                  </div>
                  <div className="space-y-0.5">
                    {evs.map((e) => (
                      <div
                        key={e.label}
                        className={cn(
                          "truncate rounded-sm px-1 text-[6px] font-medium leading-[1.4] text-white",
                          e.type === "task" ? "bg-[#FF4D2E]/85" : "bg-[#3b82f6]/85",
                        )}
                      >
                        {e.label}
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>
      <div className="mt-3 flex items-center justify-center gap-4 border-t border-white/10 pt-2 font-mono text-[9px] text-white/45">
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-[#FF4D2E]" /> Task deadlines
        </span>
        <span className="flex items-center gap-1">
          <span className="h-2 w-2 rounded-sm bg-[#3b82f6]" /> Study sessions
        </span>
      </div>
    </PanelFrame>
  );
}

function TimerVisual() {
  const r = 54;
  const c = 2 * Math.PI * r;
  const progress = 0.64;
  return (
    <PanelFrame label="STUDY TIMER — POMODORO">
      <div className="flex flex-col items-center gap-4 py-2">
        <span className="rounded-full border border-[#FF4D2E]/40 bg-[#FF4D2E]/10 px-3 py-1 font-mono text-[10px] tracking-[0.3em] text-[#FF4D2E]">
          FOCUS
        </span>
        <div className="relative h-40 w-40">
          <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
            <circle cx="70" cy="70" r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth="9" />
            <circle
              cx="70"
              cy="70"
              r={r}
              fill="none"
              stroke="#FF4D2E"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray={c}
              strokeDashoffset={c * (1 - progress)}
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <span className="font-display text-3xl font-extrabold text-white">18:24</span>
            <span className="font-mono text-[10px] text-white/40">REMAINING</span>
          </div>
        </div>
        <div className="flex gap-1.5">
          {[1, 2, 3, 4].map((n) => (
            <span
              key={n}
              className={cn(
                "h-1.5 w-6 rounded-full",
                n <= 2 ? "bg-[#FF4D2E]" : "bg-white/15",
              )}
            />
          ))}
        </div>
        <span className="font-mono text-[10px] text-white/45">ROUND 2 / 4 · 25m focus / 5m break</span>
      </div>
    </PanelFrame>
  );
}

function PlotyVisual() {
  return (
    <PanelFrame label="PLOTY — AI ASSISTANT">
      <div className="space-y-3">
        <div className="flex justify-end">
          <p className="max-w-[80%] rounded-2xl rounded-br-sm bg-[#FF4D2E] px-3 py-2 text-[12px] text-white">
            Plan my week — exam Friday, essay due Wed.
          </p>
        </div>
        <div className="flex items-start gap-2">
          <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-white/10 text-[#FF4D2E]">
            <Sparkles className="h-3.5 w-3.5" />
          </span>
          <p className="max-w-[80%] rounded-2xl rounded-bl-sm bg-white/[0.06] px-3 py-2 text-[12px] text-white/80">
            Done — 2 tasks and 3 study sessions drafted. Review &amp; apply:
          </p>
        </div>
        <div className="rounded-lg border border-white/15 bg-[#0b1450]/80">
          <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
            <span className="flex items-center gap-2 font-mono text-[10px] font-semibold uppercase tracking-widest text-white/50">
              <Sparkles className="h-3.5 w-3.5 text-[#FF4D2E]" /> Study Draft
            </span>
            <span className="rounded border border-white/20 px-1.5 py-px font-mono text-[9px] text-white/50">
              3 sessions · 150m
            </span>
          </div>
          <div className="flex gap-2 px-3 py-2.5">
            <span className="flex flex-1 items-center justify-center gap-1.5 rounded border border-white/15 py-1.5 font-mono text-[10px] text-white/60">
              Dismiss
            </span>
            <span className="flex flex-1 items-center justify-center gap-1.5 rounded bg-[#FF4D2E] py-1.5 font-mono text-[10px] text-white">
              <Check className="h-3 w-3" /> Apply
            </span>
          </div>
        </div>
      </div>
    </PanelFrame>
  );
}

function AnalyticsVisual() {
  const bars = [45, 70, 55, 85, 50, 92, 68];
  return (
    <PanelFrame label="ANALYTICS — THIS WEEK">
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-2">
          {[
            { l: "COMPLETION", v: "87%", I: BarChart3 },
            { l: "STREAK", v: "12d", I: Flame },
            { l: "FOCUS HRS", v: "24.5", I: Timer },
          ].map((s) => {
            const I = s.I;
            return (
              <div key={s.l} className="rounded-lg border border-white/10 bg-white/[0.04] p-2.5">
                <I className="mb-1 h-3.5 w-3.5 text-[#FF4D2E]" />
                <div className="font-display text-lg font-bold leading-none text-white">{s.v}</div>
                <div className="mt-1 font-mono text-[8px] tracking-wider text-white/40">{s.l}</div>
              </div>
            );
          })}
        </div>
        <div className="rounded-lg border border-white/10 bg-white/[0.03] p-3">
          <div className="mb-2 font-mono text-[9px] text-white/40">WEEKLY PRODUCTIVITY</div>
          <div className="flex h-24 items-end justify-between gap-1.5">
            {bars.map((h, i) => (
              <div
                key={i}
                style={{ height: `${h}%` }}
                className="w-full rounded-t bg-gradient-to-t from-[#FF4D2E]/40 to-[#FF4D2E]"
              />
            ))}
          </div>
        </div>
      </div>
    </PanelFrame>
  );
}

function CollaborationVisual() {
  const columns = [
    { title: "NOT DONE", dot: "bg-white/40", cards: ["Wireframes", "API schema"] },
    { title: "PENDING", dot: "bg-amber-400", cards: ["Auth flow"] },
    { title: "DONE", dot: "bg-emerald-400", cards: ["Repo setup", "ERD"] },
  ];
  const members = [
    { i: "RM", c: "bg-[#FF4D2E]" },
    { i: "KD", c: "bg-cyan-500" },
    { i: "AS", c: "bg-violet-500" },
  ];
  return (
    <PanelFrame label="PROJECT — GROUP BOARD">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex -space-x-2">
          {members.map((m) => (
            <span
              key={m.i}
              className={cn(
                "flex h-6 w-6 items-center justify-center rounded-full border border-[#0f1a66] font-mono text-[8px] font-bold text-white",
                m.c,
              )}
            >
              {m.i}
            </span>
          ))}
        </div>
        <span className="rounded border border-[#FF4D2E]/40 bg-[#FF4D2E]/10 px-2 py-0.5 font-mono text-[9px] text-[#FF4D2E]">
          OWNER
        </span>
      </div>
      <div className="grid grid-cols-3 gap-2">
        {columns.map((col) => (
          <div key={col.title} className="rounded-lg border border-white/10 bg-white/[0.03] p-2">
            <div className="mb-2 flex items-center gap-1.5">
              <span className={cn("h-1.5 w-1.5 rounded-full", col.dot)} />
              <span className="font-mono text-[8px] tracking-wider text-white/45">{col.title}</span>
            </div>
            <div className="space-y-1.5">
              {col.cards.map((card) => (
                <div
                  key={card}
                  className="rounded border border-white/10 bg-[#0b1450]/70 px-2 py-1.5 text-[10px] text-white/80"
                >
                  {card}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </PanelFrame>
  );
}

/* ── Composed sections ───────────────────────────────────── */

export function FeatureSections() {
  return (
    <>
      <FeatureSection
        id="tasks"
        index="01"
        icon={ListChecks}
        eyebrow="TASK MANAGEMENT"
        title="Tasks that sort themselves."
        description="Capture personal and project work, then let the impact / ease / urgency formula and AI scoring float what matters to the top."
        bullets={[
          "Half-step star priorities (1–5) with deadline badges",
          "AI analyzes each task in the background after you add it",
          "Overdue, Today and Tomorrow surfaced at a glance",
        ]}
        visual={<TasksVisual />}
      />

      <FeatureSection
        id="calendar"
        index="02"
        icon={CalendarDays}
        eyebrow="CALENDAR"
        title="The whole plan, one timeline."
        description="Tasks and Pomodoro study sessions land on a single FullCalendar view so deadlines and focus blocks never collide."
        bullets={[
          "Tasks and study sessions on one calendar",
          "Color-coded by status and deadline",
          "Day and week views with drag-friendly blocks",
        ]}
        visual={<CalendarVisual />}
        reverse
      />

      <FeatureSection
        id="timer"
        index="03"
        icon={Timer}
        eyebrow="STUDY TIMER"
        title="Focus, forged in Pomodoros."
        description="Run configurable focus / break cycles, link sessions to a task, and get reminders so a study block actually happens."
        bullets={[
          "Configurable focus and break durations",
          "Circular countdown with phase tracking",
          "Sessions link back to the task you're crushing",
        ]}
        visual={<TimerVisual />}
      />

      <FeatureSection
        id="ai"
        index="04"
        icon={Sparkles}
        eyebrow="PLOTY · AI"
        title="An AI foreman for your week."
        description="Tell Ploty what's coming and it drafts tasks and study plans from live context — nothing is saved until you hit Apply."
        bullets={[
          "Natural-language task & study-session drafts",
          "Confirm-before-save action cards, never silent writes",
          "Overload warnings and schedule optimization",
        ]}
        visual={<PlotyVisual />}
        reverse
      />

      <FeatureSection
        id="analytics"
        index="05"
        icon={BarChart3}
        eyebrow="ANALYTICS"
        title="Proof the work is paying off."
        description="See completion rate, streaks, focus hours and weekly productivity trends so you can adjust before crunch time."
        bullets={[
          "Completion rate, streak and focus-hour stats",
          "Weekly productivity charts (tasks vs. sessions)",
          "Spot slumps early and rebalance",
        ]}
        visual={<AnalyticsVisual />}
      />

      <FeatureSection
        id="collaboration"
        index="06"
        icon={Users}
        eyebrow="COLLABORATION"
        title="Build the group project together."
        description="Shared projects give your team a Kanban board, role-based access and assignable project tasks — owner to member."
        bullets={[
          "Kanban columns: Not Done · Pending · Done",
          "Roles: owner, moderator, collaborator, member",
          "Assign tasks and track the whole crew",
        ]}
        visual={<CollaborationVisual />}
        reverse
      />
    </>
  );
}
