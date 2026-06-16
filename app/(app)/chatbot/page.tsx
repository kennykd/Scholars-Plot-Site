import { ChatbotDemo } from "@/components/ai/chatbot";

export default function ChatAssistantPage() {
  return (
    <div className="flex h-[calc(100vh-4rem)] flex-col space-y-4 p-6">
      <div className="flex items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            PLOTY
          </h1>
          <p className="mt-1 font-mono text-xs tracking-widest text-muted-foreground">
            YOUR AI STUDY COMPANION
          </p>
        </div>
        <p className="hidden max-w-sm text-right text-xs leading-5 text-muted-foreground sm:block">
          Draft tasks and task-linked study sessions without leaving your
          planning flow.
        </p>
      </div>

      <div className="mx-auto min-h-0 w-full max-w-6xl flex-1 overflow-hidden rounded-lg border border-border bg-card/70 shadow-sm">
        <ChatbotDemo />
      </div>
    </div>
  );
}
