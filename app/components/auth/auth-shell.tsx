import type { ReactNode } from "react";
import Link from "next/link";
import {
  BarChart3,
  CalendarDays,
  ListChecks,
  PencilRuler,
  Sparkles,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

const HIGHLIGHTS: { icon: LucideIcon; label: string; sub: string }[] = [
  { icon: ListChecks, label: "PRIORITY-RANKED TASKS", sub: "AI scoring + smart deadlines" },
  { icon: CalendarDays, label: "ONE CALENDAR", sub: "Every task & study session" },
  { icon: Sparkles, label: "PLOTY · AI", sub: "Drafts your plan from a sentence" },
  { icon: BarChart3, label: "ANALYTICS", sub: "Streaks, focus hours & trends" },
];

function Logo({ className = "" }: { className?: string }) {
  return (
    <Link href="/" className={`flex items-center gap-2 ${className}`}>
      <span className="flex h-9 w-9 items-center justify-center rounded-md bg-[#FF4D2E] text-white">
        <PencilRuler className="h-4 w-4" />
      </span>
      <span className="font-display text-xl font-bold tracking-tight text-white">
        Scholar&apos;s Plot <span className="text-[#FF4D2E]">Site</span>
      </span>
    </Link>
  );
}

/**
 * Split-screen auth wrapper: a blueprint showcase panel beside the form.
 * Collapses to a centered form (with a compact logo) below `lg`.
 */
export function AuthShell({ children }: { children: ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Left — blueprint showcase (desktop only) */}
      <aside className="relative hidden flex-col justify-between overflow-hidden border-r border-white/10 bg-[#0f1a66]/40 p-12 lg:flex">
        {/* drafting corner annotation */}
        <span className="absolute right-6 top-6 font-mono text-[10px] tracking-[0.3em] text-white/30">
          FIG. A — SITE ACCESS
        </span>

        <Logo />

        <div className="space-y-8">
          <div>
            <p className="font-mono text-[11px] tracking-[0.3em] text-[#FF4D2E]">
              SCHOLAR&apos;S PLOT SITE
            </p>
            <h2 className="mt-3 font-display text-4xl font-extrabold leading-[1.05] tracking-tight text-white">
              Build your
              <br />
              <span className="text-[#FF4D2E]">semester.</span>
            </h2>
            <p className="mt-4 max-w-sm text-sm leading-relaxed text-white/60">
              A study planner forged like a work site — clear plans, solid
              schedules, and tools that actually get the job done.
            </p>
          </div>

          <ul className="space-y-3">
            {HIGHLIGHTS.map((h) => {
              const Icon = h.icon;
              return (
                <li key={h.label} className="flex items-center gap-3">
                  <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-[#FF4D2E]/30 bg-[#FF4D2E]/10 text-[#FF4D2E]">
                    <Icon className="h-4 w-4" />
                  </span>
                  <div>
                    <p className="font-mono text-[11px] tracking-[0.15em] text-white/80">
                      {h.label}
                    </p>
                    <p className="text-xs text-white/45">{h.sub}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>

        <div className="dimension-line flex items-center justify-between pt-4 font-mono text-[10px] text-white/35">
          <span>SCHOLAR&apos;S PLOT SITE</span>
          <span>STUDY PLANNER</span>
        </div>
      </aside>

      {/* Right — form */}
      <main className="flex items-center justify-center px-6 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center lg:hidden">
            <Logo />
          </div>
          {children}
        </div>
      </main>
    </div>
  );
}
