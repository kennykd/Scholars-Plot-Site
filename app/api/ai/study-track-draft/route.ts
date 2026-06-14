import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/firebase/auth';
import { AiDraftServiceError, generateStudyTrackDraft } from '@/lib/services/aiDraftService';
import { listTaskAttachments, AttachmentServiceError } from '@/lib/services/attachmentService';
import { getTaskById, TaskServiceError } from '@/lib/services/taskService';
import {
  getUserAvailability,
  getUserBehaviorProfile,
  getUserStudyPreferences,
} from '@/lib/services/scheduleService';

export const runtime = 'nodejs';

const requestSchema = z.object({
  taskId: z.coerce.number().int().positive(),
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

    const [task, preferences, availability, behaviorProfile, attachments] =
      await Promise.all([
        getTaskById(parsed.data.taskId, session.id),
        getUserStudyPreferences(session.id),
        getUserAvailability(session.id),
        getUserBehaviorProfile(session.id),
        listTaskAttachments(parsed.data.taskId, session.id),
      ]);

    const draft = await generateStudyTrackDraft({
      task: {
        id: task.task_id,
        title: task.task_name,
        description: task.task_description,
        deadline: task.task_deadline,
        priority: Number(task.task_priority),
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
