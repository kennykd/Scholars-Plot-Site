"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Menu, PencilRuler, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const LINKS = [
  { href: "#features", label: "Features" },
  { href: "#calendar", label: "Calendar" },
  { href: "#timer", label: "Timer" },
  { href: "#ai", label: "AI" },
  { href: "#analytics", label: "Analytics" },
  { href: "#contact", label: "Contact" },
];

export function LandingNav() {
  const [scrolled, setScrolled] = useState(false);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "sticky top-0 z-50 transition-colors duration-300",
        scrolled
          ? "border-b border-white/10 bg-[#1A2DAB]/85 backdrop-blur-md"
          : "border-b border-transparent bg-transparent",
      )}
    >
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4 lg:px-16">
        {/* Logo */}
        <Link href="/" className="flex items-center gap-2">
          <span className="flex h-8 w-8 items-center justify-center rounded-md bg-[#FF4D2E] text-white">
            <PencilRuler className="h-4 w-4" />
          </span>
          <span className="font-display text-lg font-bold tracking-tight text-white">
            Scholar&apos;s Plot <span className="text-[#FF4D2E]">Site</span>
          </span>
        </Link>

        {/* Desktop links */}
        <div className="hidden items-center gap-7 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="text-sm text-white/70 transition-colors hover:text-white"
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <Button
            asChild
            className="hidden bg-[#FF4D2E] px-6 font-semibold text-white hover:bg-[#e04327] sm:inline-flex"
          >
            <Link href="/login">Start Building</Link>
          </Button>

          {/* Mobile toggle */}
          <button
            type="button"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            onClick={() => setOpen((v) => !v)}
            className="flex h-10 w-10 items-center justify-center rounded-md border border-white/15 text-white md:hidden"
          >
            {open ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </nav>

      {/* Mobile menu */}
      {open && (
        <div className="border-t border-white/10 bg-[#1A2DAB]/95 px-6 py-4 backdrop-blur-md md:hidden">
          <div className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <Link
                key={l.href}
                href={l.href}
                onClick={() => setOpen(false)}
                className="rounded-md px-2 py-2.5 text-sm text-white/80 transition-colors hover:bg-white/5 hover:text-white"
              >
                {l.label}
              </Link>
            ))}
            <Button
              asChild
              className="mt-2 w-full bg-[#FF4D2E] font-semibold text-white hover:bg-[#e04327]"
            >
              <Link href="/login" onClick={() => setOpen(false)}>
                Start Building
              </Link>
            </Button>
          </div>
        </div>
      )}
    </header>
  );
}
