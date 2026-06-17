import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/firebase/auth';
import { createProjectTaskSchema } from '../../../../lib/validation/project';
import { createProjectTask, ProjectServiceError } from '@/lib/services/projectService';
import { ensureUserRecordForSession } from '@/lib/services/userService';
import { foreignKeyRepairMessage, isPrismaForeignKeyError } from '@/lib/services/prismaErrors';

/**
 * @swagger
 * /api/project/task:
 *   post:
 *     summary: Create a new task within a project
 *     description: >
 *       Requires the session cookie. Only the project owner can create project tasks.
 *       Optionally assigns a user and attaches draft attachment IDs owned by the caller.
 *     tags:
 *       - Projects
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - projectId
 *               - title
 *               - deadline
 *               - priority
 *               - status
 *             properties:
 *               projectId:
 *                 type: integer
 *                 minimum: 1
 *                 description: ID of the project to add the task to
 *                 example: 1
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: "Finalize project scope"
 *               description:
 *                 type: string
 *                 example: "Lock requirements and success criteria for the MVP."
 *               deadline:
 *                 type: string
 *                 format: date-time
 *                 description: Must be in the future.
 *               priority:
 *                 type: number
 *                 minimum: 0.5
 *                 maximum: 5
 *                 example: 3
 *               status:
 *                 type: string
 *                 enum: [Pending, In_Progress, Completed]
 *                 example: Pending
 *               assignedTo:
 *                 type: string
 *                 description: Member ID to assign the task to
 *                 example: "member-003"
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["spec.pdf"]
 *               attachmentIds:
 *                 type: array
 *                 maxItems: 20
 *                 items:
 *                   type: integer
 *                   minimum: 1
 *     responses:
 *       201:
 *         description: Project task created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project task created successfully
 *                 task:
 *                   $ref: '#/components/schemas/ProjectTask'
 *       400:
 *         description: Invalid JSON, validation failed, assigned user does not exist, or draft attachments are unavailable
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
 *         description: Only the project owner can create project tasks
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
 *                   example: Error creating project task
 */

export async function POST(request: Request) {
  try {
    // Get the session from the request (assuming request has the session, e.g., from cookies or headers)
    const session = await getSession();

    // If the user is not authenticated, return a 401 Unauthorized response
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Ensure the user record exists in the database for the authenticated session
    await ensureUserRecordForSession(session);

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createProjectTaskSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: z.flattenError(parsed.error).fieldErrors },
        { status: 400 },
      );
    }

    const task = await createProjectTask(session.id, parsed.data);

    return NextResponse.json(
      { message: 'Project task created successfully', task },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ProjectServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (isPrismaForeignKeyError(error)) {
      console.error('[api/project/task] Foreign key error while creating project task:', error);
      return NextResponse.json({ message: foreignKeyRepairMessage() }, { status: 409 });
    }

    console.error('[api/project/task] Error creating project task:', error);
    return NextResponse.json({ message: 'Error creating project task' }, { status: 500 });
  }
}
