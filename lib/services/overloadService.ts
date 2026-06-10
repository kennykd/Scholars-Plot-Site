import prisma from "@/lib/prisma";
import type { OverloadDetectorResult } from "@/lib/ai/overloadDetector";

export async function getScheduledSessionsForWeek(
  user_id: string,
  week_start: Date,
  week_end: Date
) {
  const sessions = await prisma.studySessionUser.findMany({
    where: {
      user_id,
      study_session: {
        study_session_scheduled_at: {
          gte: week_start,
          lt: week_end,
        },
      },
    },
    include: {
      study_session: true,
      task: true,
    },
  });

  return sessions.map((s) => ({
    study_session_name: s.study_session.study_session_name,
    scheduled_at: s.study_session.study_session_scheduled_at,
    total_minutes: s.study_session.total_minutes,
    task_id: s.task_id ?? null,
    task_name: s.task?.task_name ?? null,
  }));
}

export async function getUnscheduledTasksForWeek(
  user_id: string,
  week_end: Date
) {
  // Tasks that are pending or in progress with deadlines before week end
  // and have no study sessions scheduled
  const tasks = await prisma.task.findMany({
    where: {
      task_users: { some: { user_id } },
      task_status: { in: ["Pending", "In_Progress"] },
      task_deadline: { lte: week_end },
      ai_priority_score: { not: null },
    },
    include: {
      task_users: true,
      study_session_user: {
        include: { study_session: true },
      },
    },
  });

  // Filter to only tasks with no sessions scheduled this week
  return tasks
    .filter((task) => {
      const hasScheduledSession = task.study_session_user.some(
        (su) =>
          su.study_session.study_session_scheduled_at >= new Date() &&
          su.study_session.study_session_scheduled_at <= week_end
      );
      return !hasScheduledSession;
    })
    .map((task) => ({
      task_id: task.task_id,
      task_name: task.task_name,
      task_deadline: task.task_deadline,
      ai_priority_score: task.ai_priority_score!,
      estimated_minutes: task.estimated_minutes,
    }));
}

export async function getTotalAvailableMinutes(
  user_id: string,
  week_start: Date
): Promise<number> {
  const availability = await prisma.userAvailability.findMany({
    where: { user_id, is_active: true },
  });

  return availability.reduce((total, slot) => {
    const [startHour, startMin] = slot.start_time.split(":").map(Number);
    const [endHour, endMin] = slot.end_time.split(":").map(Number);
    const slotMinutes = endHour * 60 + endMin - (startHour * 60 + startMin);
    return total + Math.max(0, slotMinutes);
  }, 0);
}

export async function saveOverloadWarning(
  user_id: string,
  week_start: Date,
  result: OverloadDetectorResult
) {
  return prisma.overloadWarning.create({
    data: {
      user_id,
      week_start,
      warnings: result as unknown as object,
      detected_at: new Date(),
    },
  });
}

export async function getOverloadWarningsForUser(
  user_id: string,
  limit = 10
) {
  return prisma.overloadWarning.findMany({
    where: { user_id },
    orderBy: { detected_at: "desc" },
    take: limit,
  });
}

export async function markWarningAsRead(id: number) {
  return prisma.overloadWarning.update({
    where: { id },
    data: { is_read: true },
  });
}