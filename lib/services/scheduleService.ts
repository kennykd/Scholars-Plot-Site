import { prisma } from "@/lib/prisma";

export async function getUserAvailability(user_id: string) {
  return prisma.userAvailability.findMany({
    where: { user_id, is_active: true },
    orderBy: [{ day_of_week: "asc" }, { start_time: "asc" }],
  });
}

export async function getUserPendingTasks(user_id: string) {
  return prisma.task.findMany({
    where: {
      task_users: { some: { user_id } },
      task_status: { in: ["Pending", "In_Progress"] },
      ai_priority_score: { not: null },
    },
    orderBy: { ai_priority_score: "desc" },
    include: { project: true },
  });
}

export async function getUserStudyPreferences(user_id: string) {
  // Get the most recently created study session as the user's preferred template
  const latest = await prisma.studySessionUser.findFirst({
    where: { user_id },
    orderBy: { joined_at: "desc" },
    include: { study_session: true },
  });

  // Fall back to defaults if no sessions exist yet
  return {
    focus_minutes: latest?.study_session.focus_minutes ?? 25,
    break_minutes: latest?.study_session.break_minutes ?? 5,
    total_pomodoros: latest?.study_session.total_pomodoros ?? 2,
    total_minutes: latest?.study_session.total_minutes ?? 60,
  };
}

export async function getUserBehaviorProfile(user_id: string) {
  const user = await prisma.user.findUnique({
    where: { user_id },
    select: { ai_behavior_profile: true },
  });
  return user?.ai_behavior_profile ?? null;
}

export async function confirmStudySessions(
  sessions: {
    task_id: number;
    user_id: string;
    study_session_name: string;
    study_session_scheduled_at: Date;
    focus_minutes: number;
    break_minutes: number;
    total_pomodoros: number;
    total_minutes: number;
  }[]
) {
  // Create all confirmed sessions in a single transaction
  return prisma.$transaction(
    sessions.map((session) => {
      const { user_id, task_id, ...sessionData } = session;
      return prisma.studySession.create({
        data: {
          ...sessionData,
          study_session_user: {
            create: {
              user_id,
              task_id,
            },
          },
        },
      });
    })
  );
}