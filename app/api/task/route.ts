import { NextResponse } from 'next/server';
import { z } from 'zod';
import { Task } from '../../../types/index';
import { mockTasks } from '../../../lib/mock-data';
import { createTaskSchema } from '../../../lib/validation/task';
import { createTask } from '@/lib/services/taskService';
import { runTaskAnalysis } from '@/lib/services/aiService';

export const tasks: Task[] = mockTasks;

/**
 * @swagger
 * /api/task:
 *   get:
 *     summary: Get all tasks
 *     tags:
 *       - Tasks
 *     responses:
 *       200:
 *         description: Tasks retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Tasks retrieved successfully
 *                 tasks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Task'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error retrieving tasks
 *   post:
 *     summary: Create a new task
 *     tags:
 *       - Tasks
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - title
 *               - deadline
 *               - status
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 description: Name of the task
 *                 example: Study for math exam
 *               description:
 *                 type: string
 *                 description: Optional description of the task
 *                 example: Cover chapters 1-5 and practice problems
 *               deadline:
 *                 type: string
 *                 format: date-time
 *                 description: Due date/time for the task (must be in the future)
 *                 example: "2026-04-01T12:00:00.000Z"
 *               status:
 *                 type: string
 *                 enum: [todo, in-progress, done]
 *                 description: Current status of the task
 *                 example: todo
 *               priority:
 *                 type: number
 *                 minimum: 0.5
 *                 maximum: 5
 *                 description: Priority rating (supports 0.5 increments)
 *                 example: 3
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Optional list of attachment file names
 *                 example: ["notes.pdf"]
 *               reminder:
 *                 type: string
 *                 enum: [daily, every-3-days, weekly, none]
 *                 description: Reminder frequency
 *                 example: daily
 *     responses:
 *       201:
 *         description: Task created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Task created successfully
 *                 task:
 *                   $ref: '#/components/schemas/Task'
 *       400:
 *         description: Validation failed or invalid JSON
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Validation failed
 *                 errors:
 *                   type: object
 *                   additionalProperties:
 *                     type: array
 *                     items:
 *                       type: string
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error creating task
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     Task:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *         title:
 *           type: string
 *           example: Study for math exam
 *         description:
 *           type: string
 *           example: Cover chapters 1-5 and practice problems
 *         deadline:
 *           type: string
 *           format: date-time
 *           example: "2026-04-01T12:00:00.000Z"
 *         priority:
 *           type: number
 *           example: 3
 *         status:
 *           type: string
 *           enum: [todo, in-progress, done]
 *           example: todo
 *         attachments:
 *           type: array
 *           items:
 *             type: string
 *           example: ["notes.pdf"]
 *         reminder:
 *           type: string
 *           enum: [daily, every-3-days, weekly, none]
 *           example: daily
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2026-03-12T10:00:00.000Z"
 *         completedAt:
 *           type: string
 *           format: date-time
 *           example: "2026-04-01T12:30:00.000Z"
 */

export async function GET() {
  try {
    return NextResponse.json(
      { message: 'Tasks retrieved successfully', tasks },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json({ message: 'Error retrieving tasks', error }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: z.flattenError(parsed.error).fieldErrors },
        { status: 400 },
      );
    }

    const created = await createTask({
      ...parsed.data,
      user_id: (body as any)?.user_id,
      project_id: (body as any)?.project_id ?? null,
    });

    // Kick off AI analysis if user_id and task id available
    try {
      if ((body as any)?.user_id && created.task_id) {
        runTaskAnalysis(created.task_id, (body as any).user_id).catch((error) => {
          console.error(`AI analysis failed for task ${created.task_id}:`, error);
        });
      }
    } catch (e) {
      console.error('Error starting AI analysis:', e);
    }

    return NextResponse.json(
      { message: 'Task created successfully', task: created },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json({ message: 'Error creating task', error }, { status: 500 });
  }
}