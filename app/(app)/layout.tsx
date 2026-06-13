import { Sidebar } from "@/app/components/layout/sidebar";
import { BottomTabBar } from "@/app/components/layout/bottom-tab-bar";
import { getSession } from "@/lib/firebase/auth";
import { redirect } from "next/navigation";
import { AuthProvider } from "@/lib/firebase/auth-context";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Assign user with the data fetched from the database
  // We are taking the user data here to ensure server side rendering for the sidebar component
  const user = await getSession();

  // Redirect if the user data is not found in the database
  if (!user) {
    redirect("/api/auth/logout");
  }

  return (
    <div className="flex h-dvh overflow-hidden bg-background">
      {/* Desktop sidebar (pass user variable into the component) */}
      <Sidebar user={user} />

      {/* Main content area - solid background, no grid pattern for readability */}
      <main className="relative h-dvh min-w-0 flex-1 overflow-y-auto bg-background">
        {/* 
        AuthProvider wraps children with the user fetched on the server.
        Client components use useAuth() to read user data without making
        additional API calls or calling getSession() from the client.
         */}
        <AuthProvider initialUser={user}>
          <div className="min-h-full pb-16 lg:pb-0">{children}</div>
        </AuthProvider>
      </main>

      {/* Mobile bottom tab bar */}
      <BottomTabBar />
    </div>
  );
}
