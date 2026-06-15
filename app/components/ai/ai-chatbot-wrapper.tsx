"use client";

import { useState } from "react";
import { ChatbotDemo } from "@/components/ai/chatbot";
import { MessageSquare, X } from "lucide-react";

export function ChatPanelWrapper({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <div className="relative min-h-full w-full">
      {children}

      <button
        type="button"
        aria-label={isOpen ? "Close Ploty chat" : "Open Ploty chat"}
        onClick={() => setIsOpen((open) => !open)}
        className="fixed bottom-20 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full bg-accent text-accent-foreground shadow-lg transition-transform hover:bg-accent/90 active:scale-95 lg:bottom-6"
      >
        {isOpen ? <X size={22} /> : <MessageSquare size={22} />}
      </button>

      <div
        className={`fixed top-6 right-6 bottom-36 z-40 w-[calc(100vw-3rem)] max-w-[28rem] overflow-hidden rounded-lg border border-border bg-card/90 text-card-foreground shadow-xl backdrop-blur-md transition-all duration-200 ease-out lg:bottom-24 ${
          isOpen
            ? "translate-y-0 opacity-100 pointer-events-auto"
            : "translate-y-3 opacity-0 pointer-events-none"
        }`}
      >
        <ChatbotDemo variant="panel" />
      </div>
    </div>
  );
}
