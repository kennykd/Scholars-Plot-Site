"use client";

import { useTheme } from "next-themes";
import { useEffect, useState } from "react";

const themes = [
  { id: "light", name: "LIGHT", bg: "bg-[#F2F2F2]", border: "border-gray-300" },
  { id: "blueprint", name: "BLUEPRINT", bg: "bg-[#1A2DAB]", border: "border-blue-900" },
  { id: "gray", name: "GRAYED", bg: "bg-[#2A2A2A]", border: "border-neutral-800" },
  { id: "emerald", name: "EMERALD", bg: "bg-[#0A1C10]", border: "border-emerald-950" },
];

export function ThemeToggle() {
  const { theme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => setMounted(true), []);
  if (!mounted) return <div className="h-24 animate-pulse bg-white/5 rounded-xl" />;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {themes.map((t) => {
        const isActive = theme === t.id;
        return (
          <button
            key={t.id}
            onClick={() => setTheme(t.id)}
            className={`group relative flex flex-col items-center justify-between p-3 rounded-xl border text-center transition-all cursor-pointer ${
              isActive
                ? "border-[#FF4D2E] bg-white/5 shadow-md"
                : "border-white/10 bg-black/20 hover:border-white/20"
            }`}
          >
            {/* Visual preview color circle */}
            <div className={`w-10 h-10 rounded-lg ${t.bg} ${t.border} border-2 mb-2 shadow-inner`} />
            
            <span className="font-mono text-[10px] tracking-wider font-bold block truncate max-w-full text-foreground/80 group-hover:text-foreground">
              {t.name}
            </span>

            {isActive && (
              <span className="absolute top-1 right-1 flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#FF4D2E] opacity-75"></span>
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-[#FF4D2E]"></span>
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}