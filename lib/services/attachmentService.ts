import prisma from '@/lib/prisma';
import type { Attachment as PrismaAttachment } from '@/lib/generated/prisma/client';
import { uploadFile, getFileUrl, deleteFile } from '@/lib/bucket';
import { requireTaskAccess, TaskServiceError } from '@/lib/services/taskService';
import {
  ProjectServiceError,
  requireProjectTaskAttachmentAccess,
} from '@/lib/services/projectService';
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

async function uploadAttachmentRecord(
  userId: string,
  file: UploadInput,
  taskId: number | null = null,
): Promise<PrismaAttachment> {
  const safeName = file.name.replace(/[^\w.\-()[\] ]+/g, '_');
  const key = `uploads/${userId}-${crypto.randomUUID()}-${safeName}`;
  await uploadFile(file.buffer, key, file.type);

  return prisma.attachment.create({
    data: {
      task_id: taskId,
      user_id: userId,
      file_name: file.name,
      file_path: key,
      file_type: file.type,
    },
  });
}

export async function addAttachmentToTask(
  taskId: number,
  userId: string,
  file: UploadInput,
): Promise<Attachment> {
  await requireTaskAccess(taskId, userId);

  const row = await uploadAttachmentRecord(userId, file, taskId);

  const url = await getFileUrl(row.file_path);
  return serializeAttachment(row, url);
}

export async function addStudyAttachmentForUser(
  userId: string,
  file: UploadInput,
): Promise<Attachment> {
  const row = await uploadAttachmentRecord(userId, file);

  const url = await getFileUrl(row.file_path);
  return serializeAttachment(row, url);
}

export async function addDraftAttachmentForUser(
  userId: string,
  file: UploadInput,
): Promise<Attachment> {
  const row = await uploadAttachmentRecord(userId, file);
  const url = await getFileUrl(row.file_path);
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

export async function addAttachmentToProjectTask(
  taskId: number,
  userId: string,
  file: UploadInput,
): Promise<Attachment> {
  try {
    await requireProjectTaskAttachmentAccess(taskId, userId, 'manage');
  } catch (err) {
    if (err instanceof ProjectServiceError) {
      throw new AttachmentServiceError(err.status, err.message);
    }
    throw err;
  }

  const row = await uploadAttachmentRecord(userId, file, taskId);
  const url = await getFileUrl(row.file_path);
  return serializeAttachment(row, url);
}

export async function listProjectTaskAttachments(
  taskId: number,
  userId: string,
): Promise<Attachment[]> {
  try {
    await requireProjectTaskAttachmentAccess(taskId, userId, 'view');
  } catch (err) {
    if (err instanceof ProjectServiceError) {
      throw new AttachmentServiceError(err.status, err.message);
    }
    throw err;
  }

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

export async function deleteProjectTaskAttachmentById(
  taskId: number,
  attachmentId: number,
  userId: string,
) {
  try {
    await requireProjectTaskAttachmentAccess(taskId, userId, 'manage');
  } catch (err) {
    if (err instanceof ProjectServiceError) {
      throw new AttachmentServiceError(err.status, err.message);
    }
    throw err;
  }

  const attachment = await prisma.attachment.findUnique({
    where: { attachment_id: attachmentId },
  });

  if (!attachment || attachment.task_id !== taskId) {
    throw new AttachmentServiceError(404, 'Attachment not found');
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
