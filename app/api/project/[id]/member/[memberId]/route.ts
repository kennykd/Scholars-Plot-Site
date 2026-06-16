import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/firebase/auth';
import { updateProjectMemberSchema } from '../../../../../../lib/validation/project';
import {
  deleteProjectMemberById,
  ProjectServiceError,
  updateProjectMemberById,
} from '@/lib/services/projectService';
import { ensureUserRecordForSession } from '@/lib/services/userService';
import { foreignKeyRepairMessage, isPrismaForeignKeyError } from '@/lib/services/prismaErrors';

/**
 * @swagger
 * /api/project/{id}/member/{memberId}:
 *   patch:
 *     summary: Update a member's role in a project
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
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the member to update
 *         example: "member-002"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - role
 *             properties:
 *               role:
 *                 type: string
 *                 enum: [owner, moderator, collaborator, member]
 *                 example: moderator
 *     responses:
 *       200:
 *         description: Member updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Member updated successfully
 *                 member:
 *                   $ref: '#/components/schemas/ProjectMember'
 *       400:
 *         description: Invalid project id, invalid JSON, or validation failed
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
 *         description: Only the project owner can manage members
 *       404:
 *         description: Project or member not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Member not found
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
 *                   example: Error updating member
 *   delete:
 *     summary: Remove a member from a project
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
 *       - in: path
 *         name: memberId
 *         required: true
 *         schema:
 *           type: string
 *         description: The unique ID of the member to remove
 *         example: "member-003"
 *     responses:
 *       200:
 *         description: Member removed successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Member removed successfully
 *       400:
 *         description: Invalid project id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Cannot remove the project owner or only the project owner can manage members
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Cannot remove the project owner
 *       404:
 *         description: Project or member not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Member not found
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
 *                   example: Error removing member
 */

type RouteContext = {
  params: Promise<{
    id: string;
    memberId: string;
  }>;
};

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await ensureUserRecordForSession(session);

    const { id, memberId } = await context.params;
    const parsedProjectId = z.coerce.number().int().positive().safeParse(id);

    if (!parsedProjectId.success) {
      return NextResponse.json({ message: 'Invalid project id' }, { status: 400 });
    }

    await deleteProjectMemberById(parsedProjectId.data, session.id, memberId);

    return NextResponse.json({ message: 'Member removed successfully' }, { status: 200 });
  } catch (error) {
    if (error instanceof ProjectServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (isPrismaForeignKeyError(error)) {
      console.error('[api/project/:id/member/:memberId] Foreign key error while removing member:', error);
      return NextResponse.json({ message: foreignKeyRepairMessage() }, { status: 409 });
    }

    console.error('[api/project/:id/member/:memberId] Error removing member:', error);
    return NextResponse.json({ message: 'Error removing member' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    await ensureUserRecordForSession(session);

    const { id, memberId } = await context.params;
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

    const parsed = updateProjectMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: z.flattenError(parsed.error).fieldErrors },
        { status: 400 },
      );
    };

    const member = await updateProjectMemberById(parsedProjectId.data, session.id, memberId, parsed.data);

    return NextResponse.json(
      { message: 'Member updated successfully', member },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ProjectServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (isPrismaForeignKeyError(error)) {
      console.error('[api/project/:id/member/:memberId] Foreign key error while updating member:', error);
      return NextResponse.json({ message: foreignKeyRepairMessage() }, { status: 409 });
    }

    console.error('[api/project/:id/member/:memberId] Error updating member:', error);
    return NextResponse.json({ message: 'Error updating member' }, { status: 500 });
  }
}
