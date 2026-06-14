import prisma from '@/lib/prisma';
import type { Task as PrismaTask } from '@/lib/generated/prisma/client';
import type { CreateTaskInput, ReminderOption, UpdateTaskInput } from '@/lib/validation/task';
import type { Attachment, Task, TaskStatus } from '@/types';
import { TaskAttachment } from '@/lib/ai/taskAnalyzer';
import { getFileUrl } from '@/lib/bucket';
import { incrementTasksSinceLast, shouldRunAdapter } from "@/lib/services/weightService";

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
  // 7-day overdue cutoff: hide uncompleted tasks whose deadline is older than 7 days.
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

    return task;
  });
}

export async function updateTaskById(
  taskId: number,
  userId: string,
  data: UpdateTaskInput,
) {
  const existing = await requireTaskAccess(taskId, userId);

  const statusChanging = data.status !== undefined && data.status !== existing.task_status;

  const updated = await prisma.task.update({
    where: { task_id: taskId },
    data: {
      ...(data.title !== undefined ? { task_name: data.title } : {}),
      ...(data.description !== undefined ? { task_description: data.description } : {}),
      ...(data.deadline !== undefined ? { task_deadline: data.deadline } : {}),
      ...(data.priority !== undefined ? { task_priority: data.priority } : {}),
      ...(data.status !== undefined ? { task_status: data.status } : {}),
      ...(statusChanging
        ? { task_completed_at: data.status === 'Completed' ? new Date() : null }
        : {}),
    },
  });

  await replaceTaskReminder(taskId, data.reminder);

  const becameCompleted =
    statusChanging &&
    data.status === 'Completed' &&
    existing.task_status !== 'Completed';

  return { task: updated, becameCompleted };
}

/**
 * Runs the completion side-effects (adapter counter) without mutating task
 * status. Use this when a task has just transitioned to Completed via
 * {@link updateTaskById}. Returns whether the weight adapter should run.
 */
export async function recordTaskCompletion(user_id: string) {
  await incrementTasksSinceLast(user_id);
  return shouldRunAdapter(user_id);
}

export async function deleteTaskById(taskId: number, userId: string) {
  await requireTaskAccess(taskId, userId);

  await prisma.task.delete({
    where: { task_id: taskId },
  });
}

export async function completeTask(task_id: number, user_id: string) {
  const task = await prisma.task.update({
    where: { task_id },
    data: {
      task_status: "Completed",
      task_completed_at: new Date(),
    },
  });

  // Increment counter and check if adapter should run
  await incrementTasksSinceLast(user_id);
  const shouldAdapt = await shouldRunAdapter(user_id);

  return { task, shouldAdapt };
}

// ─── AI helpers (used by lib/services/aiService.ts) ──────────────────────────

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
