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

/**
 * @swagger
 * /api/project/task/{id}/attachment:
 *   get:
 *     summary: List attachments for a project task
 *     tags:
 *       - Projects
 *     description: Requires the session cookie and project task membership.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Attachments retrieved successfully.
 *       400:
 *         description: Invalid task id.
 *       401:
 *         description: Not authenticated.
 *       403:
 *         description: User is not a project member.
 *       404:
 *         description: Project task not found.
 *       500:
 *         description: Error retrieving attachments.
 *   post:
 *     summary: Upload an attachment for a project task
 *     tags:
 *       - Projects
 *     description: >
 *       Requires the session cookie. Owners and assigned members can manage task
 *       attachments. Uploads the file to storage and creates an attachment row.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [file]
 *             properties:
 *               file:
 *                 type: string
 *                 format: binary
 *                 description: Required file, maximum 10MB.
 *     responses:
 *       201:
 *         description: Attachment uploaded successfully.
 *       400:
 *         description: Invalid task id, invalid form data, missing file, or file exceeds 10MB.
 *       401:
 *         description: Not authenticated.
 *       403:
 *         description: User cannot manage attachments for this project task.
 *       404:
 *         description: Project task not found.
 *       409:
 *         description: Account record needs repair (foreign key error).
 *       500:
 *         description: Error uploading attachment.
 */
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
