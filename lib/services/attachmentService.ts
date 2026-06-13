import prisma from '@/lib/prisma';
import type { Attachment as PrismaAttachment } from '@/lib/generated/prisma/client';
import { uploadFile, getFileUrl, deleteFile } from '@/lib/bucket';
import { requireTaskAccess, TaskServiceError } from '@/lib/services/taskService';
import type { Attachment } from '@/types';

export function serializeAttachment(row: PrismaAttachment, url: string): Attachment {
  return {
    id: row.attachment_id,
    taskId: row.task_id,
    userId: row.user_id,
    fileName: row.file_name,
    fileKey: row.file_path,
    fileType: row.file_type,
    url,
    uploadedAt: row.attachment_uploaded_at.toISOString(),
  };
}

export class AttachmentServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'AttachmentServiceError';
  }
}

interface UploadInput {
  name: string;
  type: string;
  buffer: Buffer;
}

export async function addAttachmentToTask(
  taskId: number,
  userId: string,
  file: UploadInput,
): Promise<Attachment> {
  await requireTaskAccess(taskId, userId);

  const key = `uploads/${userId}-${crypto.randomUUID()}-${file.name}`;
  await uploadFile(file.buffer, key, file.type);

  const row = await prisma.attachment.create({
    data: {
      task_id: taskId,
      user_id: userId,
      file_name: file.name,
      file_path: key,
      file_type: file.type,
    },
  });

  const url = await getFileUrl(key);
  return serializeAttachment(row, url);
}

export async function addStudyAttachmentForUser(
  userId: string,
  file: UploadInput,
): Promise<Attachment> {
  const key = `uploads/${userId}-${crypto.randomUUID()}-${file.name}`;
  await uploadFile(file.buffer, key, file.type);

  const row = await prisma.attachment.create({
    data: {
      user_id: userId,
      file_name: file.name,
      file_path: key,
      file_type: file.type,
    },
  });

  const url = await getFileUrl(key);
  return serializeAttachment(row, url);
}

export async function listTaskAttachments(
  taskId: number,
  userId: string,
): Promise<Attachment[]> {
  await requireTaskAccess(taskId, userId);

  const rows = await prisma.attachment.findMany({
    where: { task_id: taskId },
    orderBy: { attachment_uploaded_at: 'asc' },
  });

  return Promise.all(
    rows.map(async (row) => serializeAttachment(row, await getFileUrl(row.file_path))),
  );
}

export async function deleteAttachmentById(attachmentId: number, userId: string) {
  const attachment = await prisma.attachment.findUnique({
    where: { attachment_id: attachmentId },
  });

  if (!attachment || attachment.task_id === null) {
    throw new AttachmentServiceError(404, 'Attachment not found');
  }

  try {
    await requireTaskAccess(attachment.task_id, userId);
  } catch (err) {
    if (err instanceof TaskServiceError) {
      throw new AttachmentServiceError(err.status, err.message);
    }
    throw err;
  }

  try {
    await deleteFile(attachment.file_path);
  } catch (err) {
    console.warn(`B2 delete failed for ${attachment.file_path}:`, err);
  }

  await prisma.attachment.delete({ where: { attachment_id: attachmentId } });
}

export async function deleteStudyAttachmentForSession(
  studySessionId: number,
  attachmentId: number,
  userId: string,
) {
  const link = await prisma.studySessionAttachment.findUnique({
    where: {
      study_session_id_attachment_id_user_id: {
        study_session_id: studySessionId,
        attachment_id: attachmentId,
        user_id: userId,
      },
    },
    include: {
      attachment: true,
    },
  });

  if (!link) {
    throw new AttachmentServiceError(404, 'Attachment not found');
  }

  await prisma.studySessionAttachment.delete({
    where: {
      study_session_id_attachment_id_user_id: {
        study_session_id: studySessionId,
        attachment_id: attachmentId,
        user_id: userId,
      },
    },
  });

  if (link.attachment.task_id !== null) return;

  const remainingLinks = await prisma.studySessionAttachment.count({
    where: { attachment_id: attachmentId },
  });

  if (remainingLinks > 0) return;

  try {
    await deleteFile(link.attachment.file_path);
  } catch (err) {
    console.warn(`B2 delete failed for ${link.attachment.file_path}:`, err);
  }

  await prisma.attachment.delete({ where: { attachment_id: attachmentId } });
}
