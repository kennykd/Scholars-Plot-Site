import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/auth";
import {
  addStudyAttachmentForUser,
  AttachmentServiceError,
} from "@/lib/services/attachmentService";
import {
  linkAttachmentToStudySessions,
  StudySessionServiceError,
} from "@/lib/services/studySessionService";
import { ensureUserRecordForSession } from "@/lib/services/userService";
import { foreignKeyRepairMessage, isPrismaForeignKeyError } from "@/lib/services/prismaErrors";

const MAX_FILE_BYTES = 10 * 1024 * 1024;

function parseStudySessionIds(raw: FormDataEntryValue | null) {
  if (typeof raw !== "string") return null;

  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return null;
    const ids = parsed
      .map((value) => Number(value))
      .filter((value) => Number.isInteger(value) && value > 0);
    return ids.length > 0 ? Array.from(new Set(ids)) : null;
  } catch {
    return null;
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: "Not authenticated" }, { status: 401 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ message: "Invalid form data" }, { status: 400 });
    }

    const file = formData.get("file");
    if (!(file instanceof File)) {
      return NextResponse.json({ message: "No file provided" }, { status: 400 });
    }

    if (file.size > MAX_FILE_BYTES) {
      return NextResponse.json(
        { message: `File exceeds ${MAX_FILE_BYTES / 1024 / 1024}MB limit` },
        { status: 400 },
      );
    }

    const studySessionIds = parseStudySessionIds(formData.get("studySessionIds"));
    if (!studySessionIds) {
      return NextResponse.json(
        { message: "At least one study session id is required" },
        { status: 400 },
      );
    }

    await ensureUserRecordForSession(session);

    const buffer = Buffer.from(await file.arrayBuffer());
    const attachment = await addStudyAttachmentForUser(session.id, {
      name: file.name,
      type: file.type || "application/octet-stream",
      buffer,
    });

    await linkAttachmentToStudySessions(
      session.id,
      attachment.id,
      studySessionIds,
    );

    return NextResponse.json(
      { message: "Attachment uploaded successfully", attachment },
      { status: 201 },
    );
  } catch (error) {
    if (error instanceof AttachmentServiceError || error instanceof StudySessionServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }
    if (isPrismaForeignKeyError(error)) {
      console.error("[api/study/attachment] Foreign key error while uploading attachment:", error);
      return NextResponse.json({ message: foreignKeyRepairMessage() }, { status: 409 });
    }

    console.error("[api/study/attachment] Error uploading attachment:", error);
    return NextResponse.json({ message: "Error uploading attachment" }, { status: 500 });
  }
}
