import { prisma } from '@/lib/prisma';
import type { Task as PrismaTask } from '@/lib/generated/prisma/client';
import type { CreateTaskInput, UpdateTaskInput } from '@/lib/validation/task';
import type { Attachment, Task, TaskStatus } from '@/types';
import { TaskAttachment } from '@/lib/ai/taskAnalyzer';

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

const taskInclude = {
  project: true,
  task_users: { select: { user_id: true } },
};

export async function getTasks(userId: string) {
  return prisma.task.findMany({
    where: {
      project_id: null,
      task_users: { some: { user_id: userId } },
    },
    orderBy: { task_created_at: 'desc' },
  });
}

export async function getTaskAttachments(
  task_id: number
): Promise<TaskAttachment[]> {
  const sessionUsers = await prisma.studySessionUser.findMany({
    where: {
      task_id,
      attachment_id: { not: null },
    },
    include: {
      attachment: true,
    },
  });

  return sessionUsers
    .filter((su) => su.attachment !== null)
    .map((su) => ({
      file_path: su.attachment!.file_path,
      file_type: su.attachment!.file_type,
      file_name: su.attachment!.file_name,
    }));
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
export async function getTaskAttachments(
  task_id: number
): Promise<TaskAttachment[]> {
  const sessionUsers = await prisma.studySessionUser.findMany({
    where: {
      task_id,
      attachment_id: { not: null },
    },
    include: {
      attachment: true,
    },
  });

  return sessionUsers
    .filter((su) => su.attachment !== null)
    .map((su) => ({
      file_path: su.attachment!.file_path,
      file_type: su.attachment!.file_type,
      file_name: su.attachment!.file_name,
    }));
}

export async function getTaskById(taskId: number, userId: string) {
  return requireTaskAccess(taskId, userId);
>>>>>>> f93ca76 (feat: addition of accepting Attachment into AI input)
}

export async function updateTaskById(taskId: number, input: UpdateTaskSchema) {
  const existing = await prisma.task.findUnique({ where: { task_id: taskId } });
  if (!existing) throw new TaskServiceError(404, 'Task not found');

  const data: any = {};
  const asAny = input as any;
  if (asAny.title !== undefined) data.task_name = asAny.title;
  if (asAny.description !== undefined) data.task_description = asAny.description;
  if (asAny.deadline !== undefined) data.task_deadline = asAny.deadline;
  if (asAny.priority !== undefined) data.task_priority = asAny.priority;
  if (asAny.status !== undefined) data.task_status = asAny.status;

  return prisma.task.update({ where: { task_id: taskId }, data, include: taskInclude });
}

export async function deleteTaskById(taskId: number) {
  const existing = await prisma.task.findUnique({ where: { task_id: taskId }, select: { task_id: true } });
  if (!existing) throw new TaskServiceError(404, 'Task not found');

  await prisma.task.delete({ where: { task_id: taskId } });
}

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
