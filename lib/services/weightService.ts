import prisma from "@/lib/prisma";
import type { WeightAdapterResult } from "@/lib/ai/weightAdapter";

export async function getCompletedTasksForUser(
  user_id: string,
  limit = 20
) {
  const taskUsers = await prisma.taskUser.findMany({
    where: {
      user_id,
      task: {
        task_status: "Completed",
        task_completed_at: { not: null },
      },
    },
    include: {
      task: true,
    },
    orderBy: {
      task: { task_completed_at: "desc" },
    },
    take: limit,
  });

  // Get actual duration from most recent study session per task
  const tasksWithActual = await Promise.all(
    taskUsers.map(async (tu) => {
      const latestSession = await prisma.studySessionUser.findFirst({
        where: {
          user_id,
          task_id: tu.task_id,
          actual_duration: { not: null },
        },
        orderBy: { completed_at: "desc" },
      });

      return {
        task_id: tu.task.task_id,
        task_name: tu.task.task_name,
        task_priority: Number(tu.task.task_priority),
        estimated_minutes: tu.task.estimated_minutes,
        actual_minutes: latestSession?.actual_duration ?? null,
        ai_priority_score: tu.task.ai_priority_score!,
        confidence_score: tu.task.confidence_score,
        grade_weight_percent: tu.task.grade_weight_percent
          ? Number(tu.task.grade_weight_percent)
          : null,
        completed_at: tu.task.task_completed_at!,
      };
    })
  );

  return tasksWithActual;
}

export async function getTotalCompletedCount(user_id: string) {
  return prisma.task.count({
    where: {
      task_users: { some: { user_id } },
      task_status: "Completed",
    },
  });
}

export async function getCurrentWeights(user_id: string) {
  const weights = await prisma.userFormulaWeights.findUnique({
    where: { user_id },
  });

  // Return defaults if no weights exist yet
  return {
    w_impact: weights ? Number(weights.w_impact) : 3.0,
    w_ease: weights ? Number(weights.w_ease) : 3.0,
    w_urgency: weights ? Number(weights.w_urgency) : 4.0,
  };
}

export async function saveAdaptedWeights(
  user_id: string,
  result: WeightAdapterResult
) {
  return prisma.userFormulaWeights.upsert({
    where: { user_id },
    update: {
      w_impact: result.w_impact,
      w_ease: result.w_ease,
      w_urgency: result.w_urgency,
      last_adapted_at: new Date(),
      tasks_since_last: 0,
    },
    create: {
      user_id,
      w_impact: result.w_impact,
      w_ease: result.w_ease,
      w_urgency: result.w_urgency,
      last_adapted_at: new Date(),
      tasks_since_last: 0,
    },
  });
}

export async function incrementTasksSinceLast(user_id: string) {
  return prisma.userFormulaWeights.upsert({
    where: { user_id },
    update: {
      tasks_since_last: { increment: 1 },
    },
    create: {
      user_id,
      w_impact: 3.0,
      w_ease: 3.0,
      w_urgency: 4.0,
      tasks_since_last: 1,
    },
  });
}

export async function shouldRunAdapter(user_id: string): Promise<boolean> {
  const weights = await prisma.userFormulaWeights.findUnique({
    where: { user_id },
  });

  if (!weights) return false;

  // Trigger if 5 or more tasks completed since last run
  return weights.tasks_since_last >= 5;
}

export async function getAllActiveUserIds(): Promise<string[]> {
  const users = await prisma.userFormulaWeights.findMany({
    select: { user_id: true },
  });
  return users.map((u) => u.user_id);
}