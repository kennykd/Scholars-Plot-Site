import { ChatbotDemo } from "@/components/ai/chatbot";

export default function ChatAssistantPage() {
  return (
    <div className="p-6 h-[calc(100vh-4rem)] flex flex-col space-y-4">
      {/* Structural Page Identity Block */}
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
          PLOTY
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">
          YOUR AI STUDY COMPANION
        </p>
      </div>

      {/* Main Container Workspace */}
      <div className="flex-1 w-full max-w-4xl mx-auto border border-border bg-card/60 backdrop-blur-md rounded-2xl shadow-xl overflow-hidden">
        <ChatbotDemo />
      </div>
    </div>
  );
}