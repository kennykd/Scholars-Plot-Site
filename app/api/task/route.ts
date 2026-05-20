import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createTaskSchema } from '../../../lib/validation/task';
import { createTask, getTasks, serializeTask, TaskServiceError } from '@/lib/services/taskService';
import { runTaskAnalysis } from '@/lib/services/aiService';
import { getSession } from '@/lib/firebase/auth';

/**
 * @swagger
 * components:
 *   schemas:
 *     Task:
 *       type: object
 *       properties:
 *         id:
 *           type: integer
 *           example: 1
 *         projectId:
 *           type: integer
 *           nullable: true
 *           example: null
 *         title:
 *           type: string
 *           example: Study for math exam
 *         description:
 *           type: string
 *           nullable: true
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
 *           enum: [Pending, In_Progress, Completed]
 *           example: Pending
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2026-03-12T10:00:00.000Z"
 *         completedAt:
 *           type: string
 *           format: date-time
 *           nullable: true
 *           example: "2026-04-01T12:30:00.000Z"
 *
 * /api/task:
 *   get:
 *     summary: Get tasks belonging to the authenticated user (personal tasks only)
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
 *                 tasks:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Task'
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Internal server error
 *   post:
 *     summary: Create a new personal task for the authenticated user
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
 *                 example: Study for math exam
 *               description:
 *                 type: string
 *                 example: Cover chapters 1-5
 *               deadline:
 *                 type: string
 *                 format: date-time
 *                 example: "2026-04-01T12:00:00.000Z"
 *               status:
 *                 type: string
 *                 enum: [Pending, In_Progress, Completed]
 *                 example: Pending
 *               priority:
 *                 type: number
 *                 minimum: 0.5
 *                 maximum: 5
 *                 example: 3
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
 *                 task:
 *                   $ref: '#/components/schemas/Task'
 *       400:
 *         description: Validation failed or invalid JSON
 *       401:
 *         description: Not authenticated
 *       500:
 *         description: Internal server error
 */

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const rows = await getTasks(session.id);
    const tasks = rows.map((row) => serializeTask(row));

    return NextResponse.json(
      { message: 'Tasks retrieved successfully', tasks },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof TaskServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: 'Error retrieving tasks', error }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

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

    const created = await createTask(session.id, parsed.data);

    runTaskAnalysis(created.task_id, session.id).catch((error) => {
      console.error(`AI analysis failed for task ${created.task_id}:`, error);
    });

    return NextResponse.json(
      { message: 'Task created successfully', task: serializeTask(created) },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof TaskServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: 'Error creating task', error }, { status: 500 });
  }
}
