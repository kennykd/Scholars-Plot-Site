import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/firebase-admin";
import LogoutButton from "@/components/ui/logout-button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

export default async function DashboardPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;

  if (!session) redirect("/login");

  let decodedToken;

  try {
    decodedToken = await adminAuth.verifyIdToken(session, true);
  } catch {
    redirect("/login");
  }

  return (
    <div className="min-h-screen bg-muted/40">
      {/* Header */}
      <header className="border-b bg-white">
        <div className="container mx-auto flex items-center justify-between py-4 px-4">
          <h1 className="text-xl font-semibold">Dashboard</h1>
          <LogoutButton />
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto py-10 px-4">
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>User Information</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <p>
                <strong>Email:</strong> {decodedToken.email}
              </p>
              <p>
                <strong>UID:</strong> {decodedToken.uid}
              </p>
              <p>
                <strong>Email Verified:</strong> {decodedToken.email_verified ? "Yes" : "No"}
              </p>
            </CardContent>
          </Card>

          <Card className="shadow-sm">
            <CardHeader>
              <CardTitle>Welcome</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="text-muted-foreground">Successfully login using firebase auth</p>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}