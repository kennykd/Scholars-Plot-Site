import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createProjectSchema } from '../../../lib/validation/project';
import { createProject, getProjects, ProjectServiceError } from '@/lib/services/projectService';
import { getSession } from '@/lib/firebase/auth';
import { ensureUserRecordForSession } from '@/lib/services/userService';
import { foreignKeyRepairMessage, isPrismaForeignKeyError } from '@/lib/services/prismaErrors';

/**
 * @swagger
 * components:
 *   schemas:
 *     ProjectMember:
 *       type: object
 *       properties:
 *         project_id:
 *           type: integer
 *         user_id:
 *           type: string
 *         project_user_role:
 *           type: string
 *           enum: [owner, moderator, collaborator, member]
 *         user:
 *           type: object
 *           properties:
 *             user_name:
 *               type: string
 *             user_email:
 *               type: string
 *               format: email
 *     ProjectTask:
 *       type: object
 *       properties:
 *         task_id:
 *           type: integer
 *         project_id:
 *           type: integer
 *         task_name:
 *           type: string
 *         task_description:
 *           type: string
 *           nullable: true
 *         task_deadline:
 *           type: string
 *           format: date-time
 *         task_priority:
 *           type: number
 *         task_status:
 *           type: string
 *           enum: [Pending, In_Progress, Completed]
 *         task_users:
 *           type: array
 *           items:
 *             type: object
 *     Project:
 *       type: object
 *       properties:
 *         project_id:
 *           type: integer
 *         project_name:
 *           type: string
 *         project_description:
 *           type: string
 *           nullable: true
 *         project_deadline:
 *           type: string
 *           format: date-time
 *         project_status:
 *           type: string
 *           enum: [active, completed, archived]
 *         project_priority:
 *           type: number
 *         project_created_at:
 *           type: string
 *           format: date-time
 *         project_user:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProjectMember'
 *         tasks:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProjectTask'
 *
 * /api/project:
 *   get:
 *     summary: Get projects visible to the authenticated user
 *     description: Requires the session cookie and returns projects where the user is a member.
 *     tags:
 *       - Projects
 *     responses:
 *       200:
 *         description: Projects retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 projects:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Project'
 *       401:
 *         description: Not authenticated.
 *       409:
 *         description: Account record needs repair (foreign key error).
 *       500:
 *         description: Error retrieving projects.
 *   post:
 *     summary: Create a new project owned by the authenticated user
 *     description: >
 *       Requires the session cookie. The project owner is taken from the session,
 *       regardless of any ownerId field in the request body.
 *     tags:
 *       - Projects
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name, deadline, priority]
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               description:
 *                 type: string
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
 *               ownerId:
 *                 type: string
 *                 deprecated: true
 *                 description: Accepted by validation but ignored; the session user is owner.
 *               members:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [id, name, role]
 *                   properties:
 *                     id:
 *                       type: string
 *                     name:
 *                       type: string
 *                     handle:
 *                       type: string
 *                     role:
 *                       type: string
 *                       enum: [owner, moderator, collaborator, member]
 *     responses:
 *       201:
 *         description: Project created successfully.
 *       400:
 *         description: Invalid JSON, validation failed, or referenced member does not exist.
 *       401:
 *         description: Not authenticated.
 *       409:
 *         description: Account record needs repair (foreign key error).
 *       500:
 *         description: Error creating project.
 */

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    await ensureUserRecordForSession(session);

    const projects = await getProjects(session.id);

    return NextResponse.json(
      { message: 'Projects retrieved successfully', projects },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof ProjectServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (isPrismaForeignKeyError(error)) {
      console.error('[api/project] Foreign key error while retrieving projects:', error);
      return NextResponse.json({ message: foreignKeyRepairMessage() }, { status: 409 });
    }

    console.error('[api/project] Error retrieving projects:', error);
    return NextResponse.json({ message: 'Error retrieving projects' }, { status: 500 });
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

    const parsed = createProjectSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: z.flattenError(parsed.error).fieldErrors },
        { status: 400 },
      );
    }

    await ensureUserRecordForSession(session);

    const project = await createProject(session.id, parsed.data);

    return NextResponse.json(
      { message: 'Project created successfully', project },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof ProjectServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (isPrismaForeignKeyError(error)) {
      console.error('[api/project] Foreign key error while creating project:', error);
      return NextResponse.json({ message: foreignKeyRepairMessage() }, { status: 409 });
    }

    console.error('[api/project] Error creating project:', error);
    return NextResponse.json({ message: 'Error creating project' }, { status: 500 });
  }
}
