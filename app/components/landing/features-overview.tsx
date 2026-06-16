"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import {
  ArrowUpRight,
  BarChart3,
  CalendarDays,
  ListChecks,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";

interface Capability {
  href: string;
  icon: LucideIcon;
  title: string;
  blurb: string;
  tag: string;
}

const CAPABILITIES: Capability[] = [
  {
    href: "#tasks",
    icon: ListChecks,
    title: "Task Management",
    blurb: "Priority-ranked tasks with AI scoring, star priorities and smart deadline badges.",
    tag: "PERSONAL · PROJECT",
  },
  {
    href: "#calendar",
    icon: CalendarDays,
    title: "Calendar",
    blurb: "Every task and study session on one FullCalendar timeline, color-coded by status.",
    tag: "FULLCALENDAR",
  },
  {
    href: "#timer",
    icon: Timer,
    title: "Study Timer",
    blurb: "Pomodoro study sessions with focus / break phases, task links and reminders.",
    tag: "POMODORO",
  },
  {
    href: "#ai",
    icon: Sparkles,
    title: "Ploty AI",
    blurb: "A chat foreman that turns a sentence into task & study drafts you apply in one tap.",
    tag: "GEMINI",
  },
  {
    href: "#analytics",
    icon: BarChart3,
    title: "Analytics",
    blurb: "Track completion rate, streaks, focus hours and weekly productivity over time.",
    tag: "RECHARTS",
  },
  {
    href: "#collaboration",
    icon: Users,
    title: "Collaboration",
    blurb: "Shared projects with Kanban boards, member roles and assigned project tasks.",
    tag: "KANBAN · ROLES",
  },
];

export function FeaturesOverview() {
  return (
    <section id="features" className="section-anchor relative z-10 px-6 py-20 lg:px-16">
      <div className="mx-auto max-w-7xl">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="max-w-2xl"
        >
          <p className="font-mono text-[11px] tracking-[0.3em] text-[#FF4D2E]">
            THE TOOLBELT
          </p>
          <h2 className="mt-3 font-display text-3xl font-extrabold tracking-tight text-white md:text-5xl">
            Everything you need to{" "}
            <span className="text-[#FF4D2E]">run the job.</span>
          </h2>
          <p className="mt-4 text-base leading-relaxed text-white/65">
            Six tools, one site. Each one is real and shipping — tap a card to
            jump to it.
          </p>
        </motion.div>

        <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {CAPABILITIES.map((c, i) => {
            const Icon = c.icon;
            return (
              <motion.div
                key={c.href}
                initial={{ opacity: 0, y: 24 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true, margin: "-60px" }}
                transition={{ duration: 0.45, delay: i * 0.06 }}
              >
                <Link
                  href={c.href}
                  className="blueprint-ticks group flex h-full flex-col rounded-xl border border-white/12 bg-[#0f1a66]/50 p-6 transition-colors hover:border-[#FF4D2E]/50 hover:bg-[#0f1a66]/80"
                >
                  <div className="mb-4 flex items-center justify-between">
                    <span className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#FF4D2E]/12 text-[#FF4D2E] transition-colors group-hover:bg-[#FF4D2E] group-hover:text-white">
                      <Icon className="h-5 w-5" />
                    </span>
                    <ArrowUpRight className="h-4 w-4 text-white/30 transition-all group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-[#FF4D2E]" />
                  </div>
                  <h3 className="font-display text-lg font-bold text-white">
                    {c.title}
                  </h3>
                  <p className="mt-1.5 flex-1 text-sm leading-relaxed text-white/60">
                    {c.blurb}
                  </p>
                  <span className="mt-4 font-mono text-[10px] tracking-[0.2em] text-white/35">
                    {c.tag}
                  </span>
                </Link>
              </motion.div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
