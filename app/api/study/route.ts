import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createStudySchema } from '../../../lib/validation/study';
import { prisma } from '@/lib/prisma';
import { Prisma } from '@/lib/generated/prisma/client';
import { getSession } from '@/lib/firebase/auth';
import { get } from 'http';

/**
 * @swagger
 * components:
 *   schemas:
 *     ChecklistItem:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *         text:
 *           type: string
 *           example: "Read chapter 3"
 *         completed:
 *           type: boolean
 *           example: false
 *     StudySession:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *           example: "123e4567-e89b-12d3-a456-426614174000"
 *         taskId:
 *           type: string
 *           example: "task-001"
 *         taskTitle:
 *           type: string
 *           example: "Calculus II Problem Set 5"
 *         duration:
 *           type: number
 *           description: Study duration in minutes
 *           example: 25
 *         breakDuration:
 *           type: number
 *           description: Break duration in minutes
 *           example: 5
 *         checklist:
 *           type: array
 *           items:
 *             $ref: '#/components/schemas/ChecklistItem'
 *         status:
 *           type: string
 *           enum: [pending, active, completed]
 *           example: pending
 *         scheduledAt:
 *           type: string
 *           format: date-time
 *           example: "2026-04-01T09:00:00.000Z"
 *
 * /api/study:
 *   get:
 *     summary: Get all study sessions
 *     tags:
 *       - Study Sessions
 *     responses:
 *       200:
 *         description: Study sessions retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Study sessions retrieved successfully
 *                 studySessions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/StudySession'
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error retrieving study sessions
 *   post:
 *     summary: Create a new study session
 *     tags:
 *       - Study Sessions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - taskId
 *               - taskTitle
 *               - duration
 *               - breakDuration
 *               - checklist
 *               - status
 *               - scheduledAt
 *             properties:
 *               taskId:
 *                 type: string
 *                 description: ID of the associated task
 *                 example: "task-001"
 *               taskTitle:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: "Calculus II Problem Set 5"
 *               duration:
 *                 type: number
 *                 minimum: 1
 *                 description: Study duration in minutes
 *                 example: 25
 *               breakDuration:
 *                 type: number
 *                 minimum: 0
 *                 description: Break duration in minutes
 *                 example: 5
 *               checklist:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/ChecklistItem'
 *               status:
 *                 type: string
 *                 enum: [pending, active, completed]
 *                 example: pending
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 description: Must be a future date
 *                 example: "2026-04-01T09:00:00.000Z"
 *     responses:
 *       201:
 *         description: Study session created successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Study session created successfully
 *                 studySession:
 *                   $ref: '#/components/schemas/StudySession'
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
 *                   example: Error creating study session
 */

export async function GET() {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ message: 'User is not authenticated!' }, { status: 401 });
    }

    const studySessions = await prisma.studySession.findMany({
      where: {
        study_session_user: {
          some: {
            user_id: session.id,
          },
        },
      },
      include: {
        study_session_user: true,
      },
      orderBy: {
        study_session_scheduled_at: 'asc',
      },
    });

    return NextResponse.json(
      { message: 'Study sessions retrieved successfully', studySessions },
      { status: 200 },
    );
  } catch (error) {
    return NextResponse.json({ message: 'Error retrieving study sessions', error }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    // Get the session to get the userID currently logged in
    const session = await getSession();
    
    if(!session) {
      return NextResponse.json({ message: "User is not authenticated!" }, { status: 401 })
    }
    // Take the authenticated userId
    const userId = session.id; 

    let body: unknown;

    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createStudySchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: z.flattenError(parsed.error).fieldErrors },
        { status: 400 },
      );
    }

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ message: 'No fields provided for update' }, { status: 400 });
    }

    const {
      study_session_name,
      study_session_description,
      focus_minutes,
      break_minutes,
      total_pomodoros,
      total_minutes,
      study_session_scheduled_at,
      checklist_json,
      task_id,
      attachment_id,
    } = parsed.data;

    const newStudySession = await prisma.studySession.create({
      data: {
        study_session_name,
        study_session_description,
        focus_minutes,
        break_minutes,
        total_pomodoros,
        total_minutes,
        study_session_scheduled_at,
        // If the input is null for the json checklist, make the database store SQL NULL in the checklist_json column
        checklist_json: checklist_json === null ? Prisma.DbNull : checklist_json,
        // Also create the junction table: study_session_user 
        // Required field: user_id, 
        // Optional fields: task_id, attachment_id. Where the option fields are only filled when the Study Session is linked with a task
        study_session_user: {
          create: {
            user_id: userId,
            task_id: task_id || null,
            attachment_id: attachment_id || null,
          },
        },
      },
      include: {
        study_session_user: true,
      },
    });

    return NextResponse.json(
      { message: 'Study session created successfully', studySession: newStudySession },
      { status: 201 },
    );
  } catch (error) {
    return NextResponse.json({ message: 'Error creating study session', error }, { status: 500 });
  }
}