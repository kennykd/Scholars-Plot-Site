import { NextResponse } from 'next/server';
import { z } from 'zod';
import { createStudySchema } from '../../../lib/validation/study';
import { getStudySessionsForUser, createStudySessionForUser, StudySessionServiceError } from '@/lib/services/studySessionService';
import { getSession } from '@/lib/firebase/auth';
import { TaskServiceError } from '@/lib/services/taskService';
import { ensureUserRecordForSession } from '@/lib/services/userService';
import { foreignKeyRepairMessage, isPrismaForeignKeyError } from '@/lib/services/prismaErrors';

/**
 * @swagger
 * components:
 *   schemas:
 *     ChecklistItem:
 *       type: object
 *       required: [id, text, completed]
 *       properties:
 *         id:
 *           type: string
 *           format: uuid
 *         text:
 *           type: string
 *           minLength: 1
 *         completed:
 *           type: boolean
 *     StudySession:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           description: Stringified numeric study session ID.
 *         title:
 *           type: string
 *         notes:
 *           type: string
 *         attachments:
 *           type: array
 *           items:
 *             type: object
 *         scheduledAt:
 *           type: string
 *           format: date-time
 *         focusMinutes:
 *           type: integer
 *         breakMinutes:
 *           type: integer
 *         totalMinutes:
 *           type: integer
 *         sessionStatus:
 *           type: string
 *           enum: [idle, running, paused, completed]
 *         createdAt:
 *           type: string
 *           format: date-time
 *         reminderEnabled:
 *           type: boolean
 *         reminderOffsets:
 *           type: array
 *           items:
 *             type: integer
 *         isTimerOnly:
 *           type: boolean
 *         current_time:
 *           type: integer
 *
 * /api/study:
 *   get:
 *     summary: Get the authenticated user's study sessions
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
 *                 studySessions:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/StudySession'
 *       401:
 *         description: User is not authenticated.
 *       500:
 *         description: Error retrieving study sessions.
 *   post:
 *     summary: Create one or more study sessions for the authenticated user
 *     description: >
 *       Creates a study session and optionally expands repeats into multiple sessions
 *       bounded by the linked task deadline. Writes study_session and study_session_user
 *       rows and may link an existing attachment.
 *     tags:
 *       - Study Sessions
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - study_session_name
 *               - focus_minutes
 *               - break_minutes
 *               - total_pomodoros
 *               - total_minutes
 *               - checklist_json
 *               - study_session_scheduled_at
 *             properties:
 *               study_session_name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               study_session_description:
 *                 type: string
 *               focus_minutes:
 *                 type: integer
 *                 minimum: 1
 *               break_minutes:
 *                 type: integer
 *                 minimum: 0
 *               total_pomodoros:
 *                 type: integer
 *                 minimum: 1
 *               total_minutes:
 *                 type: integer
 *                 minimum: 1
 *               task_id:
 *                 type: integer
 *                 nullable: true
 *                 minimum: 1
 *               attachment_id:
 *                 type: integer
 *                 nullable: true
 *                 minimum: 1
 *               checklist_json:
 *                 type: array
 *                 nullable: true
 *                 items:
 *                   $ref: '#/components/schemas/ChecklistItem'
 *               reminder_enabled:
 *                 type: boolean
 *               reminders:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 0
 *               repeat_enabled:
 *                 type: boolean
 *               repeat_every:
 *                 type: integer
 *               repeat_unit:
 *                 type: string
 *                 enum: [days, weeks]
 *               study_session_scheduled_at:
 *                 type: string
 *                 format: date-time
 *                 description: Must be in the future.
 *     responses:
 *       201:
 *         description: Study session created successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 studySession:
 *                   type: object
 *                 sessionIds:
 *                   type: array
 *                   items:
 *                     type: integer
 *       400:
 *         description: Validation failed, invalid JSON, repeat without task, or no sessions fit.
 *       401:
 *         description: User is not authenticated.
 *       403:
 *         description: No access to linked task.
 *       404:
 *         description: Linked task not found.
 *       409:
 *         description: Account record needs repair (foreign key error).
 *       500:
 *         description: Error creating study session.
 */

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: 'User is not authenticated!' }, { status: 401 });
    }

    const studySessions = await getStudySessionsForUser(session.id);

    return NextResponse.json({ message: 'Study sessions retrieved successfully', studySessions }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: 'Error retrieving study sessions', error }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();

    if(!session) {
      return NextResponse.json({ message: "User is not authenticated!" }, { status: 401 })
    }
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

    await ensureUserRecordForSession(session);

    const { studySession, sessionIds } = await createStudySessionForUser(userId, parsed.data);

    return NextResponse.json({ message: 'Study session created successfully', studySession, sessionIds }, { status: 201 });
  } catch (error) {
    if (error instanceof TaskServiceError || error instanceof StudySessionServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (isPrismaForeignKeyError(error)) {
      console.error('[api/study] Foreign key error while creating study session:', error);
      return NextResponse.json({ message: foreignKeyRepairMessage() }, { status: 409 });
    }

    console.error('[api/study] Error creating study session:', error);
    return NextResponse.json({ message: 'Error creating study session' }, { status: 500 });
  }
}
