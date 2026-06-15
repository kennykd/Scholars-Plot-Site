"use client";

import type { ReactNode } from "react";
import { motion } from "framer-motion";
import { Check } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeatureSectionProps {
  id: string;
  index: string;
  icon: LucideIcon;
  eyebrow: string;
  title: string;
  description: string;
  bullets: string[];
  visual: ReactNode;
  reverse?: boolean;
}

export function FeatureSection({
  id,
  index,
  icon: Icon,
  eyebrow,
  title,
  description,
  bullets,
  visual,
  reverse = false,
}: FeatureSectionProps) {
  return (
    <section
      id={id}
      className="section-anchor relative z-10 px-6 py-16 lg:px-16 lg:py-24"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-10 lg:grid-cols-2 lg:gap-16">
        {/* Copy */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.5, ease: "easeOut" }}
          className={cn("space-y-5", reverse && "lg:order-2")}
        >
          <div className="flex items-center gap-3">
            <span className="flex h-10 w-10 items-center justify-center rounded-lg border border-[#FF4D2E]/30 bg-[#FF4D2E]/10 text-[#FF4D2E]">
              <Icon className="h-5 w-5" />
            </span>
            <span className="font-mono text-[11px] tracking-[0.3em] text-white/40">
              {index} · {eyebrow}
            </span>
          </div>

          <h2 className="font-display text-3xl font-extrabold tracking-tight text-white md:text-4xl">
            {title}
          </h2>

          <p className="max-w-md text-base leading-relaxed text-white/65">
            {description}
          </p>

          <ul className="space-y-2.5">
            {bullets.map((b) => (
              <li key={b} className="flex items-start gap-2.5 text-sm text-white/75">
                <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[#FF4D2E]/15 text-[#FF4D2E]">
                  <Check className="h-3 w-3" strokeWidth={3} />
                </span>
                {b}
              </li>
            ))}
          </ul>
        </motion.div>

        {/* Visual */}
        <motion.div
          initial={{ opacity: 0, y: 30, scale: 0.97 }}
          whileInView={{ opacity: 1, y: 0, scale: 1 }}
          viewport={{ once: true, margin: "-80px" }}
          transition={{ duration: 0.55, ease: "easeOut", delay: 0.1 }}
          className={cn("flex justify-center", reverse && "lg:order-1")}
        >
          {visual}
        </motion.div>
      </div>
    </section>
  );
}
