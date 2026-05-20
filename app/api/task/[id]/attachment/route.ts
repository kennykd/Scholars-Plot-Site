import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  addAttachmentToTask,
  listTaskAttachments,
  AttachmentServiceError,
} from '@/lib/services/attachmentService';
import { TaskServiceError } from '@/lib/services/taskService';
import { getSession } from '@/lib/firebase/auth';

/**
 * @swagger
 * /api/task/{id}/attachment:
 *   get:
 *     summary: List attachments for a task (owner only)
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Attachments retrieved successfully
 *   post:
 *     summary: Upload an attachment for a task (multipart/form-data with `file`)
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *     responses:
 *       201:
 *         description: Attachment uploaded successfully
 */

type RouteContext = {
  params: Promise<{ id: string }>;
};

function parseTaskId(raw: string) {
  return z.coerce.number().int().positive().safeParse(raw);
}

const MAX_FILE_BYTES = 10 * 1024 * 1024;

export async function GET(_: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;
    const parsedId = parseTaskId(id);
    if (!parsedId.success) {
      return NextResponse.json({ message: 'Invalid task id' }, { status: 400 });
    }

    const attachments = await listTaskAttachments(parsedId.data, session.id);
    return NextResponse.json(
      { message: 'Attachments retrieved successfully', attachments },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof AttachmentServiceError || error instanceof TaskServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Error retrieving attachments', error }, { status: 500 });
  }
}

export async function POST(request: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    const { id } = await context.params;
    const parsedId = parseTaskId(id);
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

    const buffer = Buffer.from(await file.arrayBuffer());
    const attachment = await addAttachmentToTask(parsedId.data, session.id, {
      name: file.name,
      type: file.type || 'application/octet-stream',
      buffer,
    });

    return NextResponse.json(
      { message: 'Attachment uploaded successfully', attachment },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AttachmentServiceError || error instanceof TaskServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Error uploading attachment', error }, { status: 500 });
  }
}
