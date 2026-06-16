import { NextResponse } from "next/server";
import { deleteFile } from "@/lib/bucket";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/firebase/auth";
import { requireTaskAccess, TaskServiceError } from "@/lib/services/taskService";

/**
 * @swagger
 * /api/attachment/{id}:
 *   delete:
 *     summary: Delete a stored file by file name
 *     tags:
 *       - Attachments
 *     description: >
 *       Requires the session cookie. The dynamic `id` path parameter is not used by the
 *       handler; it expects multipart form data with `fileName`. If the file is linked
 *       to a task, task access is checked before deleting the object from storage.
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Present in the route path but not read by the implementation.
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required: [fileName]
 *             properties:
 *               fileName:
 *                 type: string
 *                 description: Storage key to delete.
 *     responses:
 *       200:
 *         description: File deleted from storage.
 *       400:
 *         description: No file name provided.
 *       401:
 *         description: Not authenticated.
 *       403:
 *         description: No access to the linked task.
 *       404:
 *         description: Linked task not found.
 *       500:
 *         description: Delete failed.
 */
export async function DELETE(req: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
    }

    const formData = await req.formData();
    const fileName = formData.get("fileName");

    if (typeof fileName !== "string" || fileName.length === 0) {
      return NextResponse.json({ error: "No file name provided" }, { status: 400 });
    }

    // If this file is tracked as a task attachment, enforce task ownership.
    const row = await prisma.attachment.findFirst({
      where: { file_path: fileName },
    });

    if (row?.task_id != null) {
      await requireTaskAccess(row.task_id, session.id);
    }

    await deleteFile(fileName);

    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TaskServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Delete error:", error);
    return NextResponse.json({ error: "Delete failed" }, { status: 500 });
  }
}
