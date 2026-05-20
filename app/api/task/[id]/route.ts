import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateTaskSchema } from '../../../../lib/validation/task';
import { updateTaskById, deleteTaskById } from '@/lib/services/taskService';

/**
 * NOTE (21/5/2026):
 * The documentation for task API has NOT been fixed yet.
 */

/**
 * @swagger
 * /api/task/{id}:
 *   patch:
 *     summary: Update a task by ID
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The unique ID of the task to update
 *         example: "123e4567-e89b-12d3-a456-426614174000"
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
 *                 description: Updated name of the task
 *                 example: Study for math exam (updated)
 *               description:
 *                 type: string
 *                 description: Updated description
 *                 example: Cover chapters 1-7 now
 *               deadline:
 *                 type: string
 *                 format: date-time
 *                 description: Updated deadline (must be in the future)
 *                 example: "2026-05-01T12:00:00.000Z"
 *               status:
 *                 type: string
 *                 enum: [todo, in-progress, done]
 *                 description: Updated status
 *                 example: in-progress
 *               priority:
 *                 type: number
 *                 minimum: 0.5
 *                 maximum: 5
 *                 description: Updated priority rating
 *                 example: 4
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                 description: Updated list of attachment file names
 *                 example: ["notes.pdf", "slides.pptx"]
 *               reminder:
 *                 type: string
 *                 enum: [daily, every-3-days, weekly, none]
 *                 description: Updated reminder frequency
 *                 example: weekly
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
 *                   example: Task updated successfully
 *                 task:
 *                   $ref: '#/components/schemas/Task'
 *       400:
 *         description: Validation failed, invalid JSON, or no fields provided
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
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Task not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error updating task
 *   delete:
 *     summary: Delete a task by ID
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The unique ID of the task to delete
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Task deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Task deleted successfully
 *       404:
 *         description: Task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Task not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error deleting task
 */

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const taskId = Number(id);
    if (!Number.isFinite(taskId)) return NextResponse.json({ message: 'Invalid task id' }, { status: 400 });

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

    try {
      const updated = await updateTaskById(taskId, parsed.data as any);

      const resp = {
        id: String(updated.task_id),
        title: updated.task_name,
        description: updated.task_description ?? undefined,
        deadline: updated.task_deadline,
        priority: Number(updated.task_priority),
        status: updated.task_status,
        attachments: [],
        reminder: undefined,
        createdAt: updated.task_created_at,
        completedAt: updated.task_completed_at ?? undefined,
      };

      return NextResponse.json({ message: 'Task updated successfully', task: resp }, { status: 200 });
    } catch (e: any) {
      return NextResponse.json({ message: e?.message ?? 'Error updating task' }, { status: e?.status ?? 500 });
    }
  } catch (error) {
    return NextResponse.json({ message: 'Error updating task', error: String(error) }, { status: 500 });
  }
}

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    const taskId = Number(id);
    if (!Number.isFinite(taskId)) return NextResponse.json({ message: 'Invalid task id' }, { status: 400 });

    try {
      await deleteTaskById(taskId);
      return NextResponse.json({ message: 'Task deleted successfully' }, { status: 200 });
    } catch (e: any) {
      return NextResponse.json({ message: e?.message ?? 'Error deleting task' }, { status: e?.status ?? 500 });
    }
  } catch (error) {
    return NextResponse.json({ message: 'Error deleting task', error: String(error) }, { status: 500 });
  }
}