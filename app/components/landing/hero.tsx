"use client";

import Link from "next/link";
import { motion } from "framer-motion";
import { ArrowRight, ChevronDown, HardHat } from "lucide-react";
import { Button } from "@/components/ui/button";
import { FeatureShowcase } from "./feature-showcase";

export function Hero() {
  return (
    <section
      id="top"
      className="relative z-10 flex min-h-[calc(100vh-65px)] items-center px-6 py-12 lg:px-16 lg:py-0"
    >
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 lg:grid-cols-2 lg:gap-8">
        {/* Left — copy */}
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
          className="space-y-7"
        >
          <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/5 px-3 py-1 font-mono text-[11px] tracking-[0.25em] text-[#FF4D2E]">
            <HardHat className="h-3.5 w-3.5" />
            SCHOLAR&apos;S PLOT SITE
          </span>

          <h1 className="font-display text-5xl font-extrabold leading-[0.95] tracking-tight md:text-6xl lg:text-7xl">
            <span className="block text-white">BUILD YOUR</span>
            <span className="block text-[#FF4D2E]">SEMESTER</span>
          </h1>

          <p className="max-w-md text-lg leading-relaxed text-white/70">
            A study planner forged like a work site: priority-ranked tasks, a
            real calendar, focus timers, and an AI foreman named{" "}
            <span className="font-semibold text-white">Ploty</span> that drafts
            the plan for you.
          </p>

          <div className="flex">
            <Button
              asChild
              size="lg"
              className="group flex-1 bg-[#FF4D2E] px-8 py-6 text-base font-semibold text-white hover:bg-[#e04327]"
            >
              <Link href="/login">
                Start Building
                <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
            </Button>
          </div>
        </motion.div>

        {/* Right — interactive showcase */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: 24 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.7, ease: "easeOut", delay: 0.15 }}
          className="flex justify-center lg:justify-end"
        >
          <FeatureShowcase />
        </motion.div>
      </div>

      {/* Scroll cue */}
      <motion.a
        href="#features"
        aria-label="Scroll to features"
        className="absolute bottom-6 left-1/2 hidden -translate-x-1/2 flex-col items-center gap-1 font-mono text-[10px] tracking-[0.3em] text-white/40 transition-colors hover:text-white/70 lg:flex"
        animate={{ y: [0, 8, 0] }}
        transition={{ duration: 1.8, repeat: Infinity, ease: "easeInOut" }}
      >
        SCROLL
        <ChevronDown className="h-4 w-4" />
      </motion.a>
    </section>
  );
}
