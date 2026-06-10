import { redirect } from "next/navigation";
import { getSession } from "@/lib/firebase/auth";
import { ChatbotDemo } from "@/components/ai/chatbot";

export default async function ChatPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  return (
    <main className="flex h-screen w-screen flex-col items-center justify-center bg-zinc-950 p-6 md:p-12">
      <div className="z-10 w-full max-w-5xl h-full max-h-[85vh] flex flex-col gap-4">
        <h1 className="text-2xl font-bold tracking-tight text-zinc-50">
          AI Assistant
        </h1>

        <div className="relative flex-1 w-full border border-zinc-800 rounded-xl bg-zinc-900 shadow-2xl overflow-hidden">
          <ChatbotDemo />
        </div>
      </div>
    </main>
  );
}
