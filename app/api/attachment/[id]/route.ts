import { NextResponse } from "next/server";
import { deleteFile } from "@/lib/bucket";
import prisma from "@/lib/prisma";
import { getSession } from "@/lib/firebase/auth";
import { requireTaskAccess, TaskServiceError } from "@/lib/services/taskService";

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
