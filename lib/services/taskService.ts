import prisma from '@/lib/prisma';
import type { Task as PrismaTask } from '@/lib/generated/prisma/client';
import type { CreateTaskInput, ReminderOption, UpdateTaskInput } from '@/lib/validation/task';
import type { Attachment, Task, TaskStatus } from '@/types';
import { TaskAttachment } from '@/lib/ai/taskAnalyzer';
import { getFileUrl } from '@/lib/bucket';
import { incrementTasksSinceLast, shouldRunAdapter } from "@/lib/services/weightService";
import { getAnalyticsByUserId, updateAnalyticsByUserId } from "@/lib/services/analyticService";
import {
  getTaskStatusAnalyticsUpdate,
  isCompletionStatusTransition,
} from "@/lib/services/taskStatusAnalytics";

type ReminderInterval = { interval_type: 'days' | 'weeks' | 'months'; interval_value: number };

function reminderOptionToInterval(option: ReminderOption | undefined): ReminderInterval | null {
  switch (option) {
    case 'daily': return { interval_type: 'days', interval_value: 1 };
    case 'every-3-days': return { interval_type: 'days', interval_value: 3 };
    case 'weekly': return { interval_type: 'weeks', interval_value: 1 };
    case 'biweekly': return { interval_type: 'weeks', interval_value: 2 };
    case 'monthly': return { interval_type: 'months', interval_value: 1 };
    default: return null;
  }
}

function intervalToMs({ interval_type, interval_value }: ReminderInterval): number {
  const day = 24 * 60 * 60 * 1000;
  const unit = interval_type === 'weeks' ? 7 * day : interval_type === 'months' ? 30 * day : day;
  return interval_value * unit;
}

async function replaceTaskReminder(taskId: number, option: ReminderOption | undefined) {
  if (option === undefined) return;
  await prisma.taskReminder.deleteMany({ where: { task_id: taskId } });
  const interval = reminderOptionToInterval(option);
  if (!interval) return;
  await prisma.taskReminder.create({
    data: {
      task_id: taskId,
      interval_type: interval.interval_type,
      interval_value: interval.interval_value,
      remind_at: new Date(Date.now() + intervalToMs(interval)),
    },
  });
}

export function serializeTask(row: PrismaTask, attachments?: Attachment[]): Task {
  return {
    id: row.task_id,
    projectId: row.project_id,
    title: row.task_name,
    description: row.task_description,
    deadline: row.task_deadline.toISOString(),
    priority: Number(row.task_priority),
    status: row.task_status as TaskStatus,
    createdAt: row.task_created_at.toISOString(),
    completedAt: row.task_completed_at?.toISOString() ?? null,
    ...(attachments ? { attachments } : {}),
  };
}

export class TaskServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'TaskServiceError';
  }
}

// ─── Access control ──────────────────────────────────────────────────────────

export async function requireTaskAccess(taskId: number, userId: string) {
  const task = await prisma.task.findUnique({
    where: { task_id: taskId },
    include: {
      task_users: { select: { user_id: true } },
    },
  });

  if (!task || task.project_id !== null) {
    throw new TaskServiceError(404, 'Task not found');
  }

  const isOwner = task.task_users.some((row) => row.user_id === userId);

  if (!isOwner) {
    throw new TaskServiceError(403, 'You do not have access to this task');
  }

  return task;
}

// ─── User-scoped CRUD ────────────────────────────────────────────────────────

export async function getTasks(userId: string) {
  const overdueCutoff = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  return prisma.task.findMany({
    where: {
      project_id: null,
      task_users: { some: { user_id: userId } },
      OR: [
        { task_status: 'Completed' },
        { task_deadline: { gte: overdueCutoff } },
      ],
    },
    orderBy: { task_created_at: 'desc' },
  });
}

export async function getProjectTask(userId: string) {
  return prisma.task.findMany({
    where: {
      project_id: { not: null },
      task_users: { some: { user_id: userId } },
    },
    include: {
      project: {
        select: { project_name: true, project_id: true }
      },
    },
    orderBy: { task_created_at: 'desc' },
  });
}

export async function getTaskAttachments(
  task_id: number
): Promise<TaskAttachment[]> {
  const attachments = await prisma.attachment.findMany({
    where: { task_id },
    orderBy: { attachment_uploaded_at: 'asc' },
  });

  return Promise.all(
    attachments.map(async (attachment) => ({
      file_path: await getFileUrl(attachment.file_path),
      file_type: attachment.file_type,
      file_name: attachment.file_name,
    })),
  );
}

export async function getTaskById(taskId: number, userId: string) {
  return requireTaskAccess(taskId, userId);
}

export async function getStudySessionsForTask(taskId: number, userId: string) {
  await requireTaskAccess(taskId, userId);
  return prisma.studySessionUser.findMany({
    where: { task_id: taskId, user_id: userId },
    include: { study_session: true },
    orderBy: { study_session: { study_session_scheduled_at: 'asc' } },
  });
}

export async function createTask(userId: string, data: CreateTaskInput) {
  const reminderInterval = reminderOptionToInterval(data.reminder);
  return prisma.$transaction(async (tx) => {
    const task = await tx.task.create({
      data: {
        task_name: data.title,
        task_description: data.description,
        task_deadline: data.deadline,
        task_priority: data.priority ?? 3,
        task_status: data.status,
        project_id: null,
        task_users: { create: { user_id: userId } },
        ...(reminderInterval
          ? {
            task_reminders: {
              create: {
                interval_type: reminderInterval.interval_type,
                interval_value: reminderInterval.interval_value,
                remind_at: new Date(Date.now() + intervalToMs(reminderInterval)),
              },
            },
          }
          : {}),
      },
    });

    if (data.attachmentIds?.length) {
      const attachmentIds = [...new Set(data.attachmentIds)];
      const attachments = await tx.attachment.findMany({
        where: { attachment_id: { in: attachmentIds } },
        select: { attachment_id: true, user_id: true, task_id: true },
      });

      if (
        attachments.length !== attachmentIds.length ||
        attachments.some(
          (attachment) => attachment.user_id !== userId || attachment.task_id !== null,
        )
      ) {
        throw new TaskServiceError(400, 'Some draft attachments are unavailable');
      }

      await tx.attachment.updateMany({
        where: { attachment_id: { in: attachmentIds } },
        data: { task_id: task.task_id },
      });
    }

    const currentAnalytics = await getAnalyticsByUserId(userId);
    if (currentAnalytics) {
      await updateAnalyticsByUserId(userId, {
        tasks_pending: currentAnalytics.completionStats.pending + 1,
      });
    }

    return task;
  });



}

export async function updateTaskById(
  taskId: number,
  userId: string,
  data: UpdateTaskInput,
) {
  const existing = await requireTaskAccess(taskId, userId);
  const previousStatus = existing.task_status as TaskStatus;
  const nextStatus = data.status as TaskStatus | undefined;
  const statusChanging = nextStatus !== undefined && nextStatus !== previousStatus;
  const completionDate = statusChanging && nextStatus === 'Completed' ? new Date() : null;
  const currentAnalytics = isCompletionStatusTransition(previousStatus, nextStatus)
    ? await getAnalyticsByUserId(userId)
    : null;

  const updated = await prisma.task.update({
    where: { task_id: taskId },
    data: {
      ...(data.title !== undefined ? { task_name: data.title } : {}),
      ...(data.description !== undefined ? { task_description: data.description } : {}),
      ...(data.deadline !== undefined ? { task_deadline: data.deadline } : {}),
      ...(data.priority !== undefined ? { task_priority: data.priority } : {}),
      ...(nextStatus !== undefined ? { task_status: nextStatus } : {}),
      ...(statusChanging
        ? { task_completed_at: nextStatus === 'Completed' ? completionDate : null }
        : {}),
    },
  });

  if (currentAnalytics && nextStatus) {
    const analyticsUpdate = getTaskStatusAnalyticsUpdate({
      currentAnalytics,
      previousStatus,
      nextStatus,
      deadline: existing.task_deadline,
      completionDate: completionDate ?? new Date(),
      previousCompletedAt: existing.task_completed_at,
    });

    if (analyticsUpdate) {
      await updateAnalyticsByUserId(userId, analyticsUpdate);
    }
  }

  await replaceTaskReminder(taskId, data.reminder);
  return {
    task: updated,
    becameCompleted: previousStatus !== "Completed" && nextStatus === "Completed",
  };
}

export async function recordTaskCompletion(user_id: string) {
  await incrementTasksSinceLast(user_id);
  return shouldRunAdapter(user_id);
}


export async function deleteTaskById(taskId: number, userId: string) {
  const taskToDelete = await requireTaskAccess(taskId, userId);

  await prisma.task.delete({
    where: { task_id: taskId },
  });

  const currentAnalytics = await getAnalyticsByUserId(userId);
  if (currentAnalytics) {
    if (taskToDelete.task_status === "Completed") {
      const completedAt = taskToDelete.task_completed_at ? new Date(taskToDelete.task_completed_at) : new Date();
      const deadline = new Date(taskToDelete.task_deadline);

      let earlyDelta = 0;
      let onTimeDelta = 0;
      let lateDelta = 0;

      if (completedAt < deadline) earlyDelta = -1;
      else if (completedAt > deadline) lateDelta = -1;
      else onTimeDelta = -1;

      await updateAnalyticsByUserId(userId, {
        total_tasks_completed: Math.max(0, currentAnalytics.totalTasksCompleted - 1),
        tasks_completed_early: Math.max(0, currentAnalytics.completionStats.early + earlyDelta),
        tasks_completed_on_time: Math.max(0, currentAnalytics.completionStats.onTime + onTimeDelta),
        tasks_completed_late: Math.max(0, currentAnalytics.completionStats.late + lateDelta),
      });
    } else {
      await updateAnalyticsByUserId(userId, {
        tasks_pending: Math.max(0, currentAnalytics.completionStats.pending - 1),
      });
    }
  }
}

export async function completeTask(task_id: number, user_id: string) {
  const existingTask = await prisma.task.findUnique({
    where: { task_id },
  });

  const isAlreadyCompleted = existingTask?.task_status === "Completed";

  const task = await prisma.task.update({
    where: { task_id },
    data: {
      task_status: "Completed",
      task_completed_at: new Date(),
    },
  });

  if (existingTask && !isAlreadyCompleted) {
    const currentAnalytics = await getAnalyticsByUserId(user_id);
    if (currentAnalytics) {
      const now = new Date();
      const deadline = new Date(existingTask.task_deadline);

      let earlyDelta = 0;
      let onTimeDelta = 0;
      let lateDelta = 0;

      if (now < deadline) earlyDelta = 1;
      else if (now > deadline) lateDelta = 1;
      else onTimeDelta = 1;

      await updateAnalyticsByUserId(user_id, {
        tasks_pending: Math.max(0, currentAnalytics.completionStats.pending - 1),
        total_tasks_completed: currentAnalytics.totalTasksCompleted + 1,
        tasks_completed_early: Math.max(0, currentAnalytics.completionStats.early + earlyDelta),
        tasks_completed_on_time: Math.max(0, currentAnalytics.completionStats.onTime + onTimeDelta),
        tasks_completed_late: Math.max(0, currentAnalytics.completionStats.late + lateDelta),
        streak_activity: true, // signal the streak activity when task is completed
      });
    }
  }

  await incrementTasksSinceLast(user_id);
  const shouldAdapt = await shouldRunAdapter(user_id);

  return { task, shouldAdapt };
}

// ─── AI helpers ──────────────────────────────────────────────────────────────

export async function getTaskWithProject(task_id: number) {
  return prisma.task.findUnique({
    where: { task_id },
    include: {
      project: true,
      task_users: { select: { user_id: true } },
    },
  });
}

export async function updateTaskAIFields(task_id: number, fields: {
  confidence_score: number;
  grade_weight_percent: number | null;
  estimated_minutes: number;
  ai_priority_score: number;
}) {
  return prisma.task.update({
    where: { task_id },
    data: {
      confidence_score: fields.confidence_score,
      grade_weight_percent: fields.grade_weight_percent,
      estimated_minutes: fields.estimated_minutes,
      ai_priority_score: fields.ai_priority_score,
      ai_analyzed_at: new Date(),
    },
  });
}

export async function getUserFormulaWeights(user_id: string) {
  return prisma.userFormulaWeights.findUnique({ where: { user_id } });
}
