import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/firebase/auth";
import {
  deleteStudyAttachmentForSession,
  AttachmentServiceError,
} from "@/lib/services/attachmentService";

type RouteContext = {
  params: Promise<{
    id: string;
    attachmentId: string;
  }>;
};

const idSchema = z.coerce.number().int().positive();

/**
 * @swagger
 * /api/study/{id}/attachment/{attachmentId}:
 *   delete:
 *     summary: Unlink and possibly delete a study session attachment
 *     tags:
 *       - Study Sessions
 *     description: >
 *       Requires the session cookie. Removes the authenticated user's study-session
 *       attachment link. If the attachment is no longer linked to any study session
 *       and is not tied to a task, the stored file and attachment row are deleted.
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
 *         description: Invalid attachment id.
 *       401:
 *         description: Not authenticated.
 *       404:
 *         description: Attachment link not found.
 *       500:
 *         description: Error deleting attachment.
 */
export async function DELETE(_: Request, context: RouteContext) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    const { id, attachmentId } = await context.params;
    const parsedStudySessionId = idSchema.safeParse(id);
    const parsedAttachmentId = idSchema.safeParse(attachmentId);

    if (!parsedStudySessionId.success || !parsedAttachmentId.success) {
      return NextResponse.json({ message: "Invalid attachment id" }, { status: 400 });
    }

    await deleteStudyAttachmentForSession(
      parsedStudySessionId.data,
      parsedAttachmentId.data,
      session.id,
    );

    return NextResponse.json(
      { message: "Attachment deleted successfully" },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof AttachmentServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    return NextResponse.json({ message: "Error deleting attachment", error }, { status: 500 });
  }
}
