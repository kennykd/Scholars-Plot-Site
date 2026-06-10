"use client";

import { useState } from "react";
import { ChatbotDemo } from "@/components/ai/chatbot";
import { MessageSquare, X } from "lucide-react";

export function ChatPanelWrapper({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative min-h-full w-full">
      {/* 1. Normal layout pages flow seamlessly beneath */}
      {children}

      {/* 2. Floating Action Toggle Button - Theme-matching colors */}
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="fixed bottom-20 lg:bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-xl hover:opacity-90 transition-transform active:scale-95"
      >
        {isOpen ? <X size={22} /> : <MessageSquare size={22} />}
      </button>

      {/* 3. Collapsible Floating Panel - Completely theme reactive */}
      <div
        className={`fixed top-6 bottom-36 lg:bottom-24 right-6 z-40 w-full max-w-110 border border-border bg-card text-card-foreground rounded-2xl shadow-2xl overflow-hidden transition-all duration-300 ease-in-out transform ${
          isOpen
            ? "opacity-100 translate-y-0 pointer-events-auto"
            : "opacity-0 translate-y-4 pointer-events-none"
        }`}
      >
        <div className="relative w-full h-full rounded-2xl shadow-2xl overflow-hidden bg-zinc-50 text-zinc-900 border-zinc-200 dark:bg-zinc-800 dark:text-zinc-100 dark:border-zinc-700">
          <ChatbotDemo />
        </div>
      </div>
    </div>
  );
}
