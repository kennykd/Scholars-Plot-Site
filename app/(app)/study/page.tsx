import { redirect } from "next/navigation";
import { getSession } from "@/lib/firebase/auth";
import { getStudySessionsForUser } from "@/lib/services/studySessionService";
import { StudyPageHeader } from "@/app/components/study/study-page-header";
import { StudyPageClient } from "@/app/components/study/study-page-client";
import type { StudySession } from "@/types";

export default async function StudyPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  let initialSessions: StudySession[] = [];
  try {
    initialSessions = await getStudySessionsForUser(session.id);
  } catch (error) {
    console.error("Failed to load study sessions for page:", error);
  }

  return (
    <div className="p-6 space-y-6">
      <StudyPageHeader />
      <StudyPageClient initialSessions={initialSessions} />
    </div>
  );
}
