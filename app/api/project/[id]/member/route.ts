import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/firebase/auth';
import { addProjectMemberSchema } from '../../../../../lib/validation/project';
import { addProjectMember, ProjectServiceError } from '@/lib/services/projectService';
import { ensureUserRecordForSession } from '@/lib/services/userService';
import { foreignKeyRepairMessage, isPrismaForeignKeyError } from '@/lib/services/prismaErrors';

/**
 * @swagger
 * /api/project/{id}/member:
 *   post:
 *     summary: Add a member to a project
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
 *             required:
 *               - id
 *               - name
 *               - role
 *             properties:
 *               id:
 *                 type: string
 *                 minLength: 1
 *                 description: The member's user ID
 *                 example: "member-008"
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 example: "Jordan Blake"
 *               handle:
 *                 type: string
 *                 example: "jordan@scholar.plot"
 *               role:
 *                 type: string
 *                 enum: [owner, moderator, collaborator, member]
 *                 example: member
 *     responses:
 *       201:
 *         description: Member added successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Member added successfully
 *                 member:
 *                   $ref: '#/components/schemas/ProjectMember'
 *       400:
 *         description: Invalid project id, invalid JSON, validation failed, or referenced member does not exist
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
 *         description: Member already in project or account record needs repair
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Member already in project
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error adding member
 */

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
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
    }

    const parsed = addProjectMemberSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: z.flattenError(parsed.error).fieldErrors },
        { status: 400 },
      );
    }

    const member = await addProjectMember(parsedProjectId.data, session.id, parsed.data);

    return NextResponse.json(
      { message: 'Member added successfully', member },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ProjectServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (isPrismaForeignKeyError(error)) {
      console.error('[api/project/:id/member] Foreign key error while adding member:', error);
      return NextResponse.json({ message: foreignKeyRepairMessage() }, { status: 409 });
    }

    console.error('[api/project/:id/member] Error adding member:', error);
    return NextResponse.json({ message: 'Error adding member' }, { status: 500 });
  }
}
