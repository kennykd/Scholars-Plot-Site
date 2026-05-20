import { prisma } from '@/lib/prisma';
import type { CreateTaskInput as CreateTaskSchema, UpdateTaskInput as UpdateTaskSchema } from '@/lib/validation/task';

export async function createTask(input: CreateTaskSchema & { user_id?: string; project_id?: number | null }) {
  const { user_id, project_id, title, description, deadline, priority, status } = input as any;

  const task_deadline = typeof deadline === 'string' ? new Date(deadline) : deadline;

  const data: any = {
    task_name: title,
    task_description: description ?? null,
    task_deadline,
    task_priority: priority ?? 2.5,
    task_status: status ?? undefined,
    project_id: project_id ?? null,
  };

  if (user_id) data.task_users = { create: { user_id } };

  return prisma.task.create({
    data,
    include: { 
      task_users: { 
        select: { user_id: true } }, 
        project: true 
      },
  });
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

// export interface UpdateTaskInput {
//   task_name?: string;
//   task_description?: string | null;
//   task_deadline?: Date | string;
//   task_priority?: number;
//   task_status?: string;
//   task_completed_at?: Date | string | null;
// }

export async function updateTask(task_id: number, input: UpdateTaskSchema & { task_completed_at?: Date | string | null }) {
  const data: any = {};
  const asAny = input as any;

  if (asAny.title !== undefined) data.task_name = asAny.title;
  if (asAny.description !== undefined) data.task_description = asAny.description;
  if (asAny.deadline !== undefined) data.task_deadline = typeof asAny.deadline === 'string' ? new Date(asAny.deadline) : asAny.deadline;
  if (asAny.priority !== undefined) data.task_priority = asAny.priority;
  if (asAny.status !== undefined) data.task_status = asAny.status;
  if (input.task_completed_at !== undefined) {
    data.task_completed_at = input.task_completed_at === null ? null : (typeof input.task_completed_at === 'string' ? new Date(input.task_completed_at) : input.task_completed_at);
  }

  return prisma.task.update({ where: { task_id }, data });
}

export interface TaskAIFields {
  confidence_score: number;
  grade_weight_percent: number | null;
  estimated_minutes: number;
  ai_priority_score: number;
}

export async function updateTaskAIFields(task_id: number, fields: TaskAIFields) {
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
  return prisma.userFormulaWeights.findUnique({
    where: { user_id },
  });
}