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

/**
 * @swagger
 * /api/project/task/{id}/attachment/{attachmentId}:
 *   delete:
 *     summary: Delete an attachment from a project task
 *     tags:
 *       - Projects
 *     description: >
 *       Requires the session cookie. Owners and assigned members can manage task
 *       attachments. Deletes the stored file best-effort, then deletes the attachment row.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *       - in: path
 *         name: attachmentId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Attachment deleted successfully.
 *       400:
 *         description: Invalid task id or attachment id.
 *       401:
 *         description: Not authenticated.
 *       403:
 *         description: User cannot manage attachments for this project task.
 *       404:
 *         description: Project task or attachment not found.
 *       500:
 *         description: Error deleting attachment.
 */
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
