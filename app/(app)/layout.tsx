import { Sidebar } from "@/app/components/layout/sidebar";
import { BottomTabBar } from "@/app/components/layout/bottom-tab-bar";
import { getSession } from "@/lib/firebase/auth";
import { redirect } from "next/navigation";
import { AuthProvider } from "@/lib/firebase/auth-context";
import { ChatPanelWrapper } from "../components/ai/ai-chatbot-wrapper"; // Import your new wrapper
import { getUserProfileForSession } from "@/lib/services/userService";

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

  const profile = await getUserProfileForSession(user);

  return (
    <div className="flex min-h-dvh">
      {/* Desktop sidebar */}
      <Sidebar user={profile} />

      {/* Main content area */}
      <main className="relative min-w-0 flex-1 bg-background">
        <AuthProvider initialUser={profile}>
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
