import { Sidebar } from "@/app/components/layout/sidebar";
import { BottomTabBar } from "@/app/components/layout/bottom-tab-bar";
import { getSession } from "@/lib/firebase/auth";
import { redirect } from "next/navigation";
import { AuthProvider } from "@/lib/firebase/auth-context";
import { ChatPanelWrapper } from "../components/ai/ai-chatbot-wrapper"; // Import your new wrapper

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getSession();

  // Redirect if the user is not authenticated
  if (!user) {
    redirect("/api/auth/logout");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <Sidebar user={user} />

      {/* Main content area */}
      <main className="flex-1 overflow-y-auto bg-background relative">
        <AuthProvider initialUser={user}>
          <div className="min-h-full pb-16 lg:pb-0">
            {/* Wrap your layout content with the toggleable chatbot layer */}
            <ChatPanelWrapper>{children}</ChatPanelWrapper>
          </div>
        </AuthProvider>
      </main>

      {/* Mobile bottom tab bar */}
      <BottomTabBar />
    </div>
  );
}
