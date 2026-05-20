import { prisma } from '@/lib/prisma';
import type { CreateTaskInput as CreateTaskSchema, UpdateTaskInput as UpdateTaskSchema } from '@/lib/validation/task';

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

export async function getTasks() {
  return prisma.task.findMany({
    include: taskInclude,
    orderBy: { task_created_at: 'desc' },
  });
}

export async function createTask(input: CreateTaskSchema & { user_id?: string; project_id?: number | null }) {
  const { user_id, project_id, title, description, deadline, priority, status } = input as any;

  const data: any = {
    task_name: title,
    task_description: description ?? null,
    task_deadline: deadline,
    task_priority: priority ?? 2.5,
    task_status: status ?? undefined,
    project_id: project_id ?? null,
  };

  if (user_id) data.task_users = { create: { user_id } };

  return prisma.task.create({ data, include: taskInclude });
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

export async function getUserFormulaWeights(user_id: number) {
  return prisma.userFormulaWeights.findUnique({ where: { user_id } });
}
