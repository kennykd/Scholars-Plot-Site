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
