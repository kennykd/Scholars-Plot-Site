import { NextResponse } from 'next/server';
import { z } from 'zod';
import {
  addAttachmentToTask,
  listTaskAttachments,
  AttachmentServiceError,
} from '@/lib/services/attachmentService';
import { TaskServiceError } from '@/lib/services/taskService';
import { getSession } from '@/lib/firebase/auth';
import { ensureUserRecordForSession } from '@/lib/services/userService';
import { foreignKeyRepairMessage, isPrismaForeignKeyError } from '@/lib/services/prismaErrors';

/**
 * @swagger
 * /api/task/{id}/attachment:
 *   get:
 *     summary: List attachments for a task (owner only)
 *     description: Requires the session cookie and access to the personal task.
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
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 attachments:
 *                   type: array
 *                   items:
 *                     type: object
 *       400:
 *         description: Invalid task id
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: No access to this task
 *       404:
 *         description: Task not found
 *       500:
 *         description: Error retrieving attachments
 *   post:
 *     summary: Upload an attachment for a task (multipart/form-data with `file`)
 *     description: Requires the session cookie and task ownership. Uploads the file to storage and creates a task attachment record.
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
 *                 description: Required file, maximum 10MB.
 *     responses:
 *       201:
 *         description: Attachment uploaded successfully
 *       400:
 *         description: Invalid task id, invalid form data, missing file, or file exceeds 10MB
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: No access to this task
 *       404:
 *         description: Task not found
 *       409:
 *         description: Account record needs repair (foreign key error)
 *       500:
 *         description: Error uploading attachment
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

    await ensureUserRecordForSession(session);

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
    if (isPrismaForeignKeyError(error)) {
      console.error('[api/task/attachment] Foreign key error while uploading attachment:', error);
      return NextResponse.json({ message: foreignKeyRepairMessage() }, { status: 409 });
    }

    console.error('[api/task/attachment] Error uploading attachment:', error);
    return NextResponse.json({ message: 'Error uploading attachment' }, { status: 500 });
  }
}
