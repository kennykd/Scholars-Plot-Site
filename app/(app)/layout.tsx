import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/firebase/firebase-admin";
import { Sidebar } from "@/app/components/layout/sidebar";
import { BottomTabBar } from "@/app/components/layout/bottom-tab-bar";

export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;

  if (!session) redirect("/login");

  try {
    await adminAuth.verifyIdToken(session, true);
  } catch {
    redirect("/login");
  }

  return (
    <div className="flex h-screen overflow-hidden">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content area - solid background, no grid pattern for readability */}
      <main className="flex-1 overflow-y-auto bg-background relative">
        <div className="min-h-full pb-16 lg:pb-0">
          {children}
        </div>
      </main>

      {/* Mobile bottom tab bar */}
      <BottomTabBar />
    </div>
  );
}
