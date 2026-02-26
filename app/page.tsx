import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { adminAuth } from "@/lib/firebase/firebase-admin";

export default async function RootPage() {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;

  if (!session) redirect("/login");

  try {
    await adminAuth.verifyIdToken(session, true);
    redirect("/dashboard");
  } catch {
    redirect("/login");
  }
}
