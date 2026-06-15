import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/firebase/auth';
import { addDraftAttachmentForUser, AttachmentServiceError } from '@/lib/services/attachmentService';
import { AiDraftServiceError, generateTaskDraft } from '@/lib/services/aiService';
import { ensureUserRecordForSession } from '@/lib/services/userService';
import { foreignKeyRepairMessage, isPrismaForeignKeyError } from '@/lib/services/prismaErrors';

export const runtime = 'nodejs';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const formSchema = z.object({
  title: z.string().max(100).default(''),
  description: z.string().max(4000).default(''),
  deadline: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return null;
      const date = new Date(value);
      return Number.isNaN(date.getTime()) ? null : date;
    }),
  priority: z
    .string()
    .optional()
    .transform((value) => {
      if (!value) return null;
      const number = Number(value);
      return Number.isFinite(number) ? number : null;
    }),
});

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    let formData: FormData;
    try {
      formData = await request.formData();
    } catch {
      return NextResponse.json({ message: 'Invalid form data' }, { status: 400 });
    }

    const parsed = formSchema.safeParse({
      title: formData.get('title')?.toString() ?? '',
      description: formData.get('description')?.toString() ?? '',
      deadline: formData.get('deadline')?.toString() || undefined,
      priority: formData.get('priority')?.toString() || undefined,
    });

    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: z.flattenError(parsed.error).fieldErrors },
        { status: 400 },
      );
    }

    const files = formData.getAll('file').filter((entry): entry is File => entry instanceof File);
    for (const file of files) {
      if (file.size > MAX_FILE_BYTES) {
        return NextResponse.json(
          { message: `File exceeds ${MAX_FILE_BYTES / 1024 / 1024}MB limit` },
          { status: 400 },
        );
      }
    }

    await ensureUserRecordForSession(session);

    const attachments = [];
    for (const file of files) {
      const buffer = Buffer.from(await file.arrayBuffer());
      const attachment = await addDraftAttachmentForUser(session.id, {
        name: file.name,
        type: file.type || 'application/octet-stream',
        buffer,
      });
      attachments.push(attachment);
    }

    const draft = await generateTaskDraft({
      title: parsed.data.title,
      description: parsed.data.description,
      deadline: parsed.data.deadline,
      priority: parsed.data.priority,
      attachments: attachments.map((attachment) => ({
        fileName: attachment.fileName,
        fileType: attachment.fileType,
        url: attachment.url,
      })),
    });

    return NextResponse.json({
      draft,
      attachmentIds: attachments.map((attachment) => attachment.id),
    });
  } catch (error) {
    if (error instanceof AiDraftServiceError) {
      return NextResponse.json(
        { code: error.code, message: error.message },
        { status: error.code === 'AI_TIMEOUT' ? 504 : 400 },
      );
    }

    if (error instanceof AttachmentServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    if (isPrismaForeignKeyError(error)) {
      console.error('[api/ai/task-draft] Foreign key error while uploading draft:', error);
      return NextResponse.json({ message: foreignKeyRepairMessage() }, { status: 409 });
    }

    console.error('[api/ai/task-draft] Error generating task draft:', error);
    return NextResponse.json({ message: 'Error generating task draft' }, { status: 500 });
  }
}
