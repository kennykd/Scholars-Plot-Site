import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/firebase/auth';
import { AiDraftServiceError, generateStudyTrackDraft } from '@/lib/services/aiService';
import { listTaskAttachments, AttachmentServiceError } from '@/lib/services/attachmentService';
import { getTaskById, TaskServiceError } from '@/lib/services/taskService';
import {
  getUserAvailability,
  getUserBehaviorProfile,
  getUserStudyPreferences,
} from '@/lib/services/scheduleService';

export const runtime = 'nodejs';

/**
 * @swagger
 * /api/ai/study-track-draft:
 *   post:
 *     summary: Generate an AI study-session or study-track draft
 *     description: >
 *       Builds study-session suggestions from the current study form. taskId is optional;
 *       when provided, the route loads that task and its attachments as extra planning
 *       context. The user's availability, preferences, and behavior profile are also used.
 *       Authenticated; the user comes from the session cookie.
 *     tags:
 *       - AI
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               taskId:
 *                 type: integer
 *                 minimum: 1
 *                 description: Optional task ID to use as additional study context.
 *               title:
 *                 type: string
 *                 maxLength: 100
 *                 description: Current study-session title.
 *               notes:
 *                 type: string
 *                 maxLength: 3000
 *                 description: Current study-session notes or checklist text.
 *               scheduledDate:
 *                 type: string
 *                 format: date
 *                 nullable: true
 *               scheduledTime:
 *                 type: string
 *                 pattern: "^\\d{2}:\\d{2}$"
 *                 nullable: true
 *               focusMinutes:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 240
 *               breakMinutes:
 *                 type: integer
 *                 minimum: 0
 *                 maximum: 120
 *               totalPomodoro:
 *                 type: integer
 *                 minimum: 1
 *                 maximum: 12
 *               descriptionAsChecklist:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Draft generated.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 draft:
 *                   type: object
 *       400:
 *         description: Invalid JSON body or validation failure.
 *       401:
 *         description: Not authenticated.
 *       403:
 *         description: No access to this task.
 *       404:
 *         description: Task not found.
 *       504:
 *         description: AI request timed out.
 *       500:
 *         description: Error generating study track draft.
 */

const nullableText = (max: number) =>
  z.string().trim().max(max).nullable().optional();

const requestSchema = z.object({
  taskId: z.coerce.number().int().positive().optional(),
  title: nullableText(100),
  notes: nullableText(3000),
  scheduledDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .nullable()
    .optional(),
  scheduledTime: z
    .string()
    .regex(/^\d{2}:\d{2}$/)
    .nullable()
    .optional(),
  focusMinutes: z.coerce.number().int().min(1).max(240).optional(),
  breakMinutes: z.coerce.number().int().min(0).max(120).optional(),
  totalPomodoro: z.coerce.number().int().min(1).max(12).optional(),
  descriptionAsChecklist: z.coerce.boolean().optional(),
});

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

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: z.flattenError(parsed.error).fieldErrors },
        { status: 400 },
      );
    }

    const [preferences, availability, behaviorProfile] =
      await Promise.all([
        getUserStudyPreferences(session.id),
        getUserAvailability(session.id),
        getUserBehaviorProfile(session.id),
      ]);

    const [task, attachments] = parsed.data.taskId
      ? await Promise.all([
          getTaskById(parsed.data.taskId, session.id),
          listTaskAttachments(parsed.data.taskId, session.id),
        ])
      : [null, []];

    const draft = await generateStudyTrackDraft({
      task: task
        ? {
            id: task.task_id,
            title: task.task_name,
            description: task.task_description,
            deadline: task.task_deadline,
            priority: Number(task.task_priority),
          }
        : null,
      session: {
        title: parsed.data.title ?? null,
        notes: parsed.data.notes ?? null,
        scheduled_date: parsed.data.scheduledDate ?? null,
        scheduled_time: parsed.data.scheduledTime ?? null,
        focus_minutes: parsed.data.focusMinutes ?? null,
        break_minutes: parsed.data.breakMinutes ?? null,
        total_pomodoros: parsed.data.totalPomodoro ?? null,
        description_as_checklist: parsed.data.descriptionAsChecklist ?? null,
      },
      preferences,
      availability: availability.map((slot) => ({
        day_of_week: slot.day_of_week,
        start_time: slot.start_time,
        end_time: slot.end_time,
      })),
      behaviorProfile: behaviorProfile as object | null,
      attachments: attachments.map((attachment) => ({
        fileName: attachment.fileName,
        fileType: attachment.fileType,
        url: attachment.url,
      })),
      now: new Date(),
    });

    return NextResponse.json({ draft });
  } catch (error) {
    if (error instanceof AiDraftServiceError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.code === 'AI_TIMEOUT' ? 504 : 400 },
      );
    }

    if (error instanceof TaskServiceError || error instanceof AttachmentServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    console.error('[api/ai/study-track-draft] Error generating study track:', error);
    return NextResponse.json({ message: 'Error generating study track draft' }, { status: 500 });
  }
}
