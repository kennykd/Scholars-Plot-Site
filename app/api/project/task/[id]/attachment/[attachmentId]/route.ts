import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  AttachmentServiceError,
  deleteProjectTaskAttachmentById,
} from '@/lib/services/attachmentService';
import { getSession } from '@/lib/firebase/auth';

type RouteContext = {
  params: Promise<{ id: string; attachmentId: string }>;
};

const idSchema = z.coerce.number().int().positive();

export async function DELETE(_: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const { id, attachmentId } = await context.params;
    const parsedTaskId = idSchema.safeParse(id);
    const parsedAttachmentId = idSchema.safeParse(attachmentId);

    if (!parsedTaskId.success) {
      return NextResponse.json({ message: 'Invalid task id' }, { status: 400 });
    }

    if (!parsedAttachmentId.success) {
      return NextResponse.json({ message: 'Invalid attachment id' }, { status: 400 });
    }

    await deleteProjectTaskAttachmentById(
      parsedTaskId.data,
      parsedAttachmentId.data,
      session.id,
    );

    return NextResponse.json({ message: 'Attachment deleted successfully' }, { status: 200 });
  } catch (error) {
    if (error instanceof AttachmentServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: 'Error deleting attachment' }, { status: 500 });
  }
}
