import { NextResponse } from 'next/server';
import { z } from 'zod';
import { deleteAttachmentById, AttachmentServiceError } from '@/lib/services/attachmentService';
import { TaskServiceError } from '@/lib/services/taskService';
import { getSession } from '@/lib/firebase/auth';

/**
 * @swagger
 * /api/task/{id}/attachment/{attachmentId}:
 *   delete:
 *     summary: Delete an attachment from a task (owner only)
 *     tags:
 *       - Tasks
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Attachment deleted successfully
 */

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

    const { attachmentId } = await context.params;
    const parsedAttachmentId = idSchema.safeParse(attachmentId);

    if (!parsedAttachmentId.success) {
      return NextResponse.json({ message: 'Invalid attachment id' }, { status: 400 });
    }

    await deleteAttachmentById(parsedAttachmentId.data, session.id);

    return NextResponse.json({ message: 'Attachment deleted successfully' }, { status: 200 });
  } catch (error) {
    if (error instanceof AttachmentServiceError || error instanceof TaskServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: 'Error deleting attachment', error }, { status: 500 });
  }
}
