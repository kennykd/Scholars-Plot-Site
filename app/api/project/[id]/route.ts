import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateProjectSchema } from '../../../../lib/validation/project';
import {
  deleteProjectById,
  ProjectServiceError,
  updateProjectById,
} from '@/lib/services/projectService';
import { getSession } from '@/lib/firebase/auth';
import { ensureUserRecordForSession } from '@/lib/services/userService';
import { foreignKeyRepairMessage, isPrismaForeignKeyError } from '@/lib/services/prismaErrors';

/**
 * @swagger
 * /api/project/{id}:
 *   patch:
 *     summary: Update a project by ID
 *     tags:
 *       - Projects
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Numeric project ID.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: "Capstone Collaboration (Updated)"
 *               description:
 *                 type: string
 *                 example: "Updated project description."
 *               deadline:
 *                 type: string
 *                 format: date-time
 *                 description: Must be in the future.
 *               priority:
 *                 type: number
 *                 minimum: 0.5
 *                 maximum: 5
 *               project_status:
 *                 type: string
 *                 enum: [active, completed, archived]
 *                 example: completed
 *               members:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/ProjectMember'
 *     responses:
 *       200:
 *         description: Project updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project updated successfully
 *                 project:
 *                   $ref: '#/components/schemas/Project'
 *       400:
 *         description: Invalid project id, invalid JSON, validation failed, no fields provided, or referenced member does not exist
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
 *         description: Not authenticated
 *       403:
 *         description: Only the project owner can update the project
 *       404:
 *         description: Project not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project not found
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
 *                   example: Error updating project
 *   delete:
 *     summary: Delete a project by ID
 *     tags:
 *       - Projects
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Numeric project ID.
 *     responses:
 *       200:
 *         description: Project deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project deleted successfully
 *       400:
 *         description: Invalid project id
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Only the project owner can delete the project
 *       404:
 *         description: Project not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project not found
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
 *                   example: Error deleting project
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
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    await ensureUserRecordForSession(session);

    const { id } = await context.params;
    const parsedProjectId = z.coerce.number().int().positive().safeParse(id);

    if (!parsedProjectId.success) {
      return NextResponse.json({ message: 'Invalid project id' }, { status: 400 });
    }

    await deleteProjectById(parsedProjectId.data, session.id);

    return NextResponse.json({ message: 'Project deleted successfully' }, { status: 200 });
  } catch (error) {
    if (error instanceof ProjectServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (isPrismaForeignKeyError(error)) {
      console.error('[api/project/:id] Foreign key error while deleting project:', error);
      return NextResponse.json({ message: foreignKeyRepairMessage() }, { status: 409 });
    }

    console.error('[api/project/:id] Error deleting project:', error);
    return NextResponse.json({ message: 'Error deleting project' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    await ensureUserRecordForSession(session);

    const { id } = await context.params;
    const parsedProjectId = z.coerce.number().int().positive().safeParse(id);

    if (!parsedProjectId.success) {
      return NextResponse.json({ message: 'Invalid project id' }, { status: 400 });
    }

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
    };

    const parsed = updateProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: z.flattenError(parsed.error).fieldErrors },
        { status: 400 },
      );
    };

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ message: 'No fields provided for update' }, { status: 400 });
    };

    const project = await updateProjectById(parsedProjectId.data, session.id, parsed.data);

    return NextResponse.json(
      { message: 'Project updated successfully', project },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ProjectServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (isPrismaForeignKeyError(error)) {
      console.error('[api/project/:id] Foreign key error while updating project:', error);
      return NextResponse.json({ message: foreignKeyRepairMessage() }, { status: 409 });
    }

    console.error('[api/project/:id] Error updating project:', error);
    return NextResponse.json({ message: 'Error updating project' }, { status: 500 });
  }
}
