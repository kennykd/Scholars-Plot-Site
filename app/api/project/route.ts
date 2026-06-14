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
 *         id:
 *           type: string
 *           example: "member-001"
 *         name:
 *           type: string
 *           example: "Alex Scholar"
 *         handle:
 *           type: string
 *           example: "alex@scholar.plot"
 *         role:
 *           type: string
 *           enum: [owner, moderator, member]
 *           example: owner
 *     ProjectTask:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *         title:
 *           type: string
 *           example: "Finalize project scope"
 *         description:
 *           type: string
 *           example: "Lock requirements and success criteria for the MVP."
 *         priority:
 *           type: string
 *           enum: [low, medium, high]
 *           example: high
 *         status:
 *           type: string
 *           enum: [not-done, pending, done]
 *           example: not-done
 *         assignedTo:
 *           type: string
 *           example: "member-003"
 *         attachments:
 *           type: array
 *           items:
 *             type: string
 *           example: ["spec.pdf"]
 *         reminder:
 *           type: string
 *           enum: [daily, every-3-days, weekly, none]
 *           example: daily
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2026-03-12T10:00:00.000Z"
 *     Project:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *         name:
 *           type: string
 *           example: "Capstone Collaboration"
 *         description:
 *           type: string
 *           example: "Team coordination for the semester capstone build."
 *         project_status:
 *           type: string
 *           enum: [active, completed, archived]
 *           example: active
 *         ownerId:
 *           type: string
 *           example: "member-001"
 *         members:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProjectMember'
 *         tasks:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ProjectTask'
 *         createdAt:
 *           type: string
 *           format: date-time
 *           example: "2026-03-12T10:00:00.000Z"
 *
 * /api/project:
 *   get:
 *     summary: Get all projects
 *     tags:
 *       - Projects
 *     responses:
 *       200:
 *         description: Projects retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Projects retrieved successfully
 *                 projects:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Project'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error retrieving projects
 *   post:
 *     summary: Create a new project
 *     tags:
 *       - Projects
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - ownerId
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: "Capstone Collaboration"
 *               description:
 *                 type: string
 *                 example: "Team coordination for the semester capstone build."
 *               project_status:
 *                 type: string
 *                 enum: [active, completed, archived]
 *                 example: active
 *               ownerId:
 *                 type: string
 *                 minLength: 1
 *                 example: "member-001"
 *               members:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/ProjectMember'
 *     responses:
 *       201:
 *         description: Project created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project created successfully
 *                 project:
 *                   $ref: '#/components/schemas/Project'
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
 *                   example: Error creating project
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
