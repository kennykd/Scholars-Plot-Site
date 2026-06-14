import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  addAttachmentToProjectTask,
  AttachmentServiceError,
  listProjectTaskAttachments,
} from '@/lib/services/attachmentService';
import { getSession } from '@/lib/firebase/auth';
import { ensureUserRecordForSession } from '@/lib/services/userService';
import { foreignKeyRepairMessage, isPrismaForeignKeyError } from '@/lib/services/prismaErrors';

type RouteContext = {
  params: Promise<{ id: string }>;
};

const idSchema = z.coerce.number().int().positive();
const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function GET(_: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ message: 'Invalid task id' }, { status: 400 });
    }

    const attachments = await listProjectTaskAttachments(parsedId.data, session.id);
    return NextResponse.json(
      { message: 'Attachments retrieved successfully', attachments },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof AttachmentServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    return NextResponse.json({ message: 'Error retrieving attachments' }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;
    const parsedId = idSchema.safeParse(id);
    if (!parsedId.success) {
      return NextResponse.json({ message: 'Invalid task id' }, { status: 400 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ message: 'Invalid form data' }, { status: 400 });
    }

    const file = formData.get('file');
    if (!(file instanceof File)) {
      return NextResponse.json({ message: 'No file provided' }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { message: `File exceeds ${MAX_FILE_BYTES / 1024 / 1024}MB limit` },
        { status: 400 },
      );
    }

    await ensureUserRecordForSession(session);

    const buffer = Buffer.from(await file.arrayBuffer());
    const attachment = await addAttachmentToProjectTask(parsedId.data, session.id, {
      name: file.name,
      type: file.type || 'application/octet-stream',
      buffer,
    });

    return NextResponse.json(
      { message: 'Attachment uploaded successfully', attachment },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AttachmentServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (isPrismaForeignKeyError(error)) {
      console.error('[api/project/task/attachment] Foreign key error while uploading:', error);
      return NextResponse.json({ message: foreignKeyRepairMessage() }, { status: 409 });
    }

    console.error('[api/project/task/attachment] Error uploading attachment:', error);
    return NextResponse.json({ message: 'Error uploading attachment' }, { status: 500 });
  }
}
