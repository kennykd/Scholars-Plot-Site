import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateTaskSchema } from '../../../../lib/validation/task';
import {
  deleteTaskById,
  getTaskById,
  recordTaskCompletion,
  serializeTask,
  TaskServiceError,
  updateTaskById,
} from '@/lib/services/taskService';
import { getSession } from '@/lib/firebase/auth';
import { runWeightAdapter } from "@/lib/services/aiService";

/**
 * @swagger
 * /api/task/{id}:
 *   get:
 *     summary: Get a single task by ID (authenticated owner only)
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Task retrieved successfully
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
 *         description: Invalid task id
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: No access to this task
 *       404:
 *         description: Task not found
 *   patch:
 *     summary: Update a task by ID
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
 *               deadline:
 *                 type: string
 *                 format: date-time
 *               status:
 *                 type: string
 *                 enum: [Pending, In_Progress, Completed]
 *               priority:
 *                 type: number
 *                 minimum: 0.5
 *                 maximum: 5
 *     responses:
 *       200:
 *         description: Task updated successfully
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
 *         description: Validation failed, invalid JSON, or no fields provided
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: No access to this task
 *       404:
 *         description: Task not found
 *   delete:
 *     summary: Delete a task by ID
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *       400:
 *         description: Invalid task id
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: No access to this task
 *       404:
 *         description: Task not found
 */

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

function parseTaskId(raw: string) {
  return z.coerce.number().int().positive().safeParse(raw);
}

export async function GET(_: Request, context: RouteContext) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;
    const parsedId = parseTaskId(id);

    if (!parsedId.success) {
      return NextResponse.json({ message: 'Invalid task id' }, { status: 400 });
    }

    const task = await getTaskById(parsedId.data, session.id);

    return NextResponse.json(
      { message: 'Task retrieved successfully', task: serializeTask(task) },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof TaskServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: 'Error retrieving task', error }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;
    const parsedId = parseTaskId(id);

    if (!parsedId.success) {
      return NextResponse.json({ message: 'Invalid task id' }, { status: 400 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = updateTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: z.flattenError(parsed.error).fieldErrors },
        { status: 400 },
      );
    }

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ message: 'No fields provided for update' }, { status: 400 });
    }

    const { task: updated, becameCompleted } = await updateTaskById(
      parsedId.data,
      session.id,
      parsed.data,
    );

    if (becameCompleted) {
      const shouldAdapt = await recordTaskCompletion(session.id);
      if (shouldAdapt) {
        runWeightAdapter(session.id).catch((error) => {
          console.error(`Weight adapter failed for user ${session.id}:`, error);
        });
      }
    }

    return NextResponse.json(
      { message: 'Task updated successfully', task: serializeTask(updated) },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof TaskServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: 'Error updating task', error }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;
    const parsedId = parseTaskId(id);

    if (!parsedId.success) {
      return NextResponse.json({ message: 'Invalid task id' }, { status: 400 });
    }

    await deleteTaskById(parsedId.data, session.id);

    return NextResponse.json({ message: 'Task deleted successfully' }, { status: 200 });
  } catch (error) {
    if (error instanceof TaskServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: 'Error deleting task', error }, { status: 500 });
  }
}
