"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, Mail, PencilRuler } from "lucide-react";
import { Button } from "@/components/ui/button";

const PRODUCT_LINKS = [
  { href: "#features", label: "Features" },
  { href: "#calendar", label: "Calendar" },
  { href: "#timer", label: "Timer" },
  { href: "#ai", label: "Ploty AI" },
  { href: "#analytics", label: "Analytics" },
];

export function LandingFooter() {
  return (
    <footer className="relative z-10">
      {/* Contact / final CTA */}
      <section id="contact" className="section-anchor px-6 py-20 lg:px-16">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5 }}
          className="blueprint-ticks mx-auto max-w-5xl overflow-hidden rounded-2xl border border-white/15 bg-[#0f1a66]/70 p-10 text-center shadow-2xl backdrop-blur-md lg:p-16"
        >
          <p className="font-mono text-[11px] tracking-[0.3em] text-[#FF4D2E]">
            CLOCK IN
          </p>
          <h2 className="mx-auto mt-4 max-w-2xl font-display text-3xl font-extrabold tracking-tight text-white md:text-5xl">
            Ready to build your semester?
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-white/65">
            Set up your site in minutes — free for students. Bring the workload,
            we&apos;ll bring the tools.
          </p>
          <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
            <Button
              asChild
              size="lg"
              className="group bg-[#FF4D2E] px-8 py-6 text-base font-semibold text-white hover:bg-[#e04327]"
            >
              <Link href="/register">
                Start Building
                <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
         
          </div>
        </motion.div>
      </section>

      {/* Footer bar */}
      <div className="border-t border-white/10 px-6 py-12 lg:px-16">
        <div className="mx-auto flex max-w-7xl flex-col gap-10 md:flex-row md:items-start md:justify-between">
          <div className="max-w-xs space-y-3">
            <Link href="/" className="flex items-center gap-2">
              <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#FF4D2E] text-white">
                <PencilRuler className="h-4 w-4" />
              </span>
              <span className="font-display text-lg font-bold text-white">
                Scholar&apos;s Plot <span className="text-[#FF4D2E]">Site</span>
              </span>
            </Link>
            <p className="text-sm leading-relaxed text-white/50">
              A study planner forged like a work site. Plans, schedules, and
              tools that actually get the job done.
            </p>
          </div>

          <div className="flex gap-16">
            <div>
              <p className="mb-3 font-mono text-[10px] tracking-[0.2em] text-white/40">
                PRODUCT
              </p>
              <ul className="space-y-2">
                {PRODUCT_LINKS.map((l) => (
                  <li key={l.href}>
                    <Link
                      href={l.href}
                      className="text-sm text-white/60 transition-colors hover:text-white"
                    >
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-3 font-mono text-[10px] tracking-[0.2em] text-white/40">
                ACCOUNT
              </p>
              <ul className="space-y-2">
                <li>
                  <Link href="/login" className="text-sm text-white/60 transition-colors hover:text-white">
                    Log in
                  </Link>
                </li>
                <li>
                  <Link href="/register" className="text-sm text-white/60 transition-colors hover:text-white">
                    Register
                  </Link>
                </li>
              </ul>
            </div>
          </div>
        </div>

        <div className="mx-auto mt-10 flex max-w-7xl flex-col gap-2 border-t border-white/10 pt-6 font-mono text-[11px] text-white/40 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} Scholar&apos;s Plot Site</span>
          <span>Study planner &amp; productivity tracker</span>
        </div>
      </div>
    </footer>
  );
}
