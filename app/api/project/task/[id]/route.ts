import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/firebase/auth';
import { updateProjectTaskSchema } from '../../../../../lib/validation/project';
import {
  deleteProjectTaskById,
  ProjectServiceError,
  updateProjectTaskById,
} from '@/lib/services/projectService';
import { ensureUserRecordForSession } from '@/lib/services/userService';
import { foreignKeyRepairMessage, isPrismaForeignKeyError } from '@/lib/services/prismaErrors';

/**
 * @swagger
 * /api/project/task/{id}:
 *   patch:
 *     summary: Update a project task by ID
 *     tags:
 *       - Projects
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Numeric project task ID.
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
 *                 example: "Finalize project scope (updated)"
 *               description:
 *                 type: string
 *                 example: "Updated task description."
 *               deadline:
 *                 type: string
 *                 format: date-time
 *               priority:
 *                 type: number
 *                 minimum: 0.5
 *                 maximum: 5
 *                 example: 3
 *               status:
 *                 type: string
 *                 enum: [Pending, In_Progress, Completed]
 *                 example: In_Progress
 *               assignedTo:
 *                 type: string
 *                 example: "member-002"
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["updated-spec.pdf"]
 *     responses:
 *       200:
 *         description: Project task updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project task updated successfully
 *                 task:
 *                   $ref: '#/components/schemas/ProjectTask'
 *       400:
 *         description: Invalid task id, invalid JSON, validation failed, no fields provided, or assigned user does not exist
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User is not allowed to make the requested task change
 *       404:
 *         description: Project task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project task not found
 *       409:
 *         description: Account record needs repair (foreign key error)
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error updating project task
 *   delete:
 *     summary: Delete a project task by ID
 *     tags:
 *       - Projects
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Numeric project task ID.
 *     responses:
 *       200:
 *         description: Project task deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project task deleted successfully
 *       400:
 *         description: Invalid project task id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only the project owner can delete project tasks
 *       404:
 *         description: Project task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project task not found
 *       409:
 *         description: Account record needs repair (foreign key error)
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error deleting project task
 */

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await ensureUserRecordForSession(session);

    const { id } = await context.params;
    const parsedTaskId = z.coerce.number().int().positive().safeParse(id);

    if (!parsedTaskId.success) {
      return NextResponse.json({ message: 'Invalid project task id' }, { status: 400 });
    }

    await deleteProjectTaskById(parsedTaskId.data, session.id);

    return NextResponse.json({ message: 'Project task deleted successfully' }, { status: 200 });
  } catch (error) {
    if (error instanceof ProjectServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (isPrismaForeignKeyError(error)) {
      console.error('[api/project/task/:id] Foreign key error while deleting project task:', error);
      return NextResponse.json({ message: foreignKeyRepairMessage() }, { status: 409 });
    }

    console.error('[api/project/task/:id] Error deleting project task:', error);
    return NextResponse.json({ message: 'Error deleting project task' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await ensureUserRecordForSession(session);

    const { id } = await context.params;
    const parsedTaskId = z.coerce.number().int().positive().safeParse(id);

    if (!parsedTaskId.success) {
      return NextResponse.json({ message: 'Invalid project task id' }, { status: 400 });
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
    };

    const parsed = updateProjectTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: z.flattenError(parsed.error).fieldErrors },
        { status: 400 },
      );
    };

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ message: 'No fields provided for update' }, { status: 400 });
    };

    const task = await updateProjectTaskById(parsedTaskId.data, session.id, parsed.data);

    return NextResponse.json(
      { message: 'Project task updated successfully', task },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ProjectServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (isPrismaForeignKeyError(error)) {
      console.error('[api/project/task/:id] Foreign key error while updating project task:', error);
      return NextResponse.json({ message: foreignKeyRepairMessage() }, { status: 409 });
    }

    console.error('[api/project/task/:id] Error updating project task:', error);
    return NextResponse.json({ message: 'Error updating project task' }, { status: 500 });
  }
}
