import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/firebase/auth';
import { createStudyBatchSchema } from '@/lib/validation/study';
import {
  createStudySessionsForTask,
  StudySessionServiceError,
} from '@/lib/services/studySessionService';
import { TaskServiceError } from '@/lib/services/taskService';
import { ensureUserRecordForSession } from '@/lib/services/userService';
import { foreignKeyRepairMessage, isPrismaForeignKeyError } from '@/lib/services/prismaErrors';

/**
 * @swagger
 * /api/study/batch:
 *   post:
 *     summary: Create a batch of study sessions for a task
 *     tags:
 *       - Study Sessions
 *     description: >
 *       Requires the session cookie and access to the personal task. Generates one or
 *       more study sessions from client plans, bounded by the task deadline, and writes
 *       the study_session and study_session_user rows in a transaction.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [task_id, plans]
 *             properties:
 *               task_id:
 *                 type: integer
 *                 minimum: 1
 *               reminder_enabled:
 *                 type: boolean
 *               reminders:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 0
 *               plans:
 *                 type: array
 *                 minItems: 1
 *                 maxItems: 20
 *                 items:
 *                   type: object
 *                   required: [client_plan_id, title, start_date, time, focus_minutes, break_minutes, total_pomodoros]
 *                   properties:
 *                     client_plan_id:
 *                       type: string
 *                     title:
 *                       type: string
 *                       minLength: 1
 *                       maxLength: 100
 *                     start_date:
 *                       type: string
 *                       pattern: "^\\d{4}-\\d{2}-\\d{2}$"
 *                     repeat:
 *                       type: string
 *                       enum: [none, weekly, biweekly]
 *                     repeat_enabled:
 *                       type: boolean
 *                     repeat_every:
 *                       type: integer
 *                     repeat_unit:
 *                       type: string
 *                       enum: [days, weeks]
 *                     time:
 *                       type: string
 *                       pattern: "^([01]\\d|2[0-3]):[0-5]\\d$"
 *                     focus_minutes:
 *                       type: integer
 *                       minimum: 1
 *                     break_minutes:
 *                       type: integer
 *                       minimum: 0
 *                     total_pomodoros:
 *                       type: integer
 *                       minimum: 1
 *                     notes:
 *                       type: string
 *                     description_as_checklist:
 *                       type: boolean
 *     responses:
 *       201:
 *         description: Study sessions created successfully.
 *       400:
 *         description: Invalid JSON, validation failed, or no sessions fit before the task deadline.
 *       401:
 *         description: User is not authenticated.
 *       403:
 *         description: No access to this task.
 *       404:
 *         description: Task not found.
 *       409:
 *         description: Account record needs repair (foreign key error).
 *       500:
 *         description: Error creating study sessions.
 */
export async function POST(request: Request) {
  try {
    const session = await getSession();

    if (!session) {
      return NextResponse.json({ message: 'User is not authenticated!' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = createStudyBatchSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: z.flattenError(parsed.error).fieldErrors },
        { status: 400 },
      );
    }

    await ensureUserRecordForSession(session);

    const result = await createStudySessionsForTask(
      session.id,
      parsed.data.task_id,
      parsed.data.plans,
      {
        reminderEnabled: parsed.data.reminder_enabled ?? false,
        reminders: parsed.data.reminders ?? [],
      },
    );

    return NextResponse.json(
      {
        message: 'Study sessions created successfully',
        studySessions: result.studySessions,
        createdByPlan: result.createdByPlan,
      },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof TaskServiceError || error instanceof StudySessionServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (isPrismaForeignKeyError(error)) {
      console.error('[api/study/batch] Foreign key error while creating study sessions:', error);
      return NextResponse.json({ message: foreignKeyRepairMessage() }, { status: 409 });
    }

    console.error('[api/study/batch] Error creating study sessions:', error);
    return NextResponse.json({ message: 'Error creating study sessions' }, { status: 500 });
  }
}
