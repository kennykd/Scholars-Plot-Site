import { prisma } from '@/lib/prisma';
import type { Task as PrismaTask } from '@/lib/generated/prisma/client';
import type { CreateTaskInput, UpdateTaskInput } from '@/lib/validation/task';
import type { Attachment, Task, TaskStatus } from '@/types';

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
  return prisma.task.findMany({
    where: {
      project_id: null,
      task_users: { some: { user_id: userId } },
    },
    orderBy: { task_created_at: 'desc' },
  });
}

export async function getTaskById(taskId: number, userId: string) {
  return requireTaskAccess(taskId, userId);
}

export async function createTask(userId: string, data: CreateTaskInput) {
  return prisma.task.create({
    data: {
      task_name: data.title,
      task_description: data.description,
      task_deadline: data.deadline,
      task_priority: data.priority ?? 3,
      task_status: data.status,
      project_id: null,
      task_users: { create: { user_id: userId } },
    },
  });
}

export async function updateTaskById(
  taskId: number,
  userId: string,
  data: UpdateTaskInput,
) {
  const existing = await requireTaskAccess(taskId, userId);

  const statusChanging = data.status !== undefined && data.status !== existing.task_status;

  return prisma.task.update({
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
}

export async function deleteTaskById(taskId: number, userId: string) {
  await requireTaskAccess(taskId, userId);

  await prisma.task.delete({
    where: { task_id: taskId },
  });
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

export async function getUserFormulaWeights(user_id: number) {
  return prisma.userFormulaWeights.findUnique({ where: { user_id } });
}
