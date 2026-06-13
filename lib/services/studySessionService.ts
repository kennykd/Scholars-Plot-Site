import prisma from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import { getFileUrl } from "@/lib/bucket";
import { serializeAttachment } from "@/lib/services/attachmentService";
import type {
  CreateStudyBatchInput,
  CreateStudyInput,
  UpdateStudyInput,
} from "@/lib/validation/study";
import { requireTaskAccess } from "@/lib/services/taskService";
import type { StudySession } from "@/types";

const MAX_GENERATED_SESSIONS = 50;

type StudySessionRow = Prisma.StudySessionGetPayload<{
  include: {
    study_session_user: true;
    study_session_attachments: {
      include: {
        attachment: true;
      };
    };
  };
}>;

function mapStudySessionRow(row: StudySessionRow): StudySession {
  const userStudySession = row.study_session_user?.[0];
  const rawStatus = userStudySession?.status;

  return {
    id: String(row.study_session_id),
    title: row.study_session_name ?? "Study Session",
    notes: row.study_session_description ?? "",
    attachments:
      row.study_session_attachments?.map((link) =>
        serializeAttachment(link.attachment, ""),
      ) ?? [],
    scheduledAt: row.study_session_scheduled_at.toISOString(),
    focusMinutes: row.focus_minutes ?? 25,
    breakMinutes: row.break_minutes ?? 5,
    totalMinutes: row.total_minutes ?? 60,
    sessionStatus:
      rawStatus === "running" || rawStatus === "paused"
        ? rawStatus
        : rawStatus === "completed"
          ? "completed"
          : "idle",
    createdAt: row.study_session_created_at.toISOString(),
    reminderEnabled: row.study_session_reminder_enabled,
    reminderOffsets: row.study_session_remind_at_minutes ?? [],
    isTimerOnly: false,
    current_time: userStudySession?.current_time,
  };
}

export class StudySessionServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "StudySessionServiceError";
  }
}

function checklistFromNotes(notes: string | undefined, enabled?: boolean) {
  if (!enabled) return null;

  const items = (notes ?? "")
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((text) => ({
      id: crypto.randomUUID(),
      text,
      completed: false,
    }));

  return items.length > 0 ? items : null;
}

function combineDateAndTime(date: Date, time: string) {
  const [hours, minutes] = time.split(":").map(Number);
  const scheduled = new Date(date);
  scheduled.setHours(hours, minutes, 0, 0);
  return scheduled;
}

function generateSessionsFromTracks(
  tracks: CreateStudyBatchInput["tracks"],
  deadline: Date,
  now = new Date(),
) {
  const generated: Array<{
    track: CreateStudyBatchInput["tracks"][number];
    scheduledAt: Date;
  }> = [];

  for (const track of tracks) {
    const cursor = new Date(now);
    cursor.setHours(0, 0, 0, 0);
    const selectedWeekdays = new Set(track.weekdays);

    while (cursor <= deadline) {
      if (selectedWeekdays.has(cursor.getDay())) {
        const scheduledAt = combineDateAndTime(cursor, track.time);
        if (scheduledAt > now && scheduledAt <= deadline) {
          generated.push({ track, scheduledAt });
        }
      }

      cursor.setDate(cursor.getDate() + 1);
    }
  }

  return generated
    .sort((a, b) => a.scheduledAt.getTime() - b.scheduledAt.getTime())
    .slice(0, MAX_GENERATED_SESSIONS);
}

export async function getStudySessionsForUser(userId: string) {
  const rows = await prisma.studySession.findMany({
    where: {
      study_session_user: {
        some: {
          user_id: userId,
        },
      },
    },
    include: {
      study_session_user: true,
      study_session_attachments: {
        where: { user_id: userId },
        include: { attachment: true },
      },
    },
    orderBy: {
      study_session_scheduled_at: "asc",
    },
  });

  return rows.map(mapStudySessionRow);
}

export async function getStudySessionsForDashboard(userId: string) {
  return getStudySessionsForUser(userId);
}

export async function createStudySessionForUser(
  userId: string,
  payload: CreateStudyInput,
) {
  const {
    study_session_name,
    study_session_description,
    focus_minutes,
    break_minutes,
    total_pomodoros,
    total_minutes,
    study_session_scheduled_at,
    checklist_json,
    reminder_enabled,
    reminders,
    task_id,
    attachment_id,
  } = payload;

  const reminderMinutes = (reminders ?? []).map((reminderMinute: number) => Math.max(0, reminderMinute));

  const studySession = await prisma.studySession.create({
    data: {
      study_session_name,
      study_session_description,
      focus_minutes,
      break_minutes,
      total_pomodoros,
      total_minutes,
      study_session_scheduled_at,
      checklist_json: checklist_json === null ? Prisma.DbNull : checklist_json,
      study_session_reminder_enabled: reminder_enabled ?? reminderMinutes.length > 0,
      study_session_remind_at_minutes: reminderMinutes,
      study_session_user: {
        create: {
          user_id: userId,
          task_id: task_id || null,
          attachment_id: attachment_id || null,
        },
      },
    },
    include: {
      study_session_user: true,
      study_session_attachments: {
        where: { user_id: userId },
        include: { attachment: true },
      },
    },
  });

  return studySession;
}

export async function createStudySessionsForTask(
  userId: string,
  taskId: number,
  tracks: CreateStudyBatchInput["tracks"],
) {
  const task = await requireTaskAccess(taskId, userId);
  const generatedSessions = generateSessionsFromTracks(
    tracks,
    task.task_deadline,
  );

  if (generatedSessions.length === 0) {
    throw new StudySessionServiceError(
      400,
      "No sessions fit before this task deadline",
    );
  }

  return prisma.$transaction(async (tx) => {
    const studySessions = [];
    const createdByTrack: Record<string, number[]> = {};

    for (const generated of generatedSessions) {
      const { track, scheduledAt } = generated;
      const totalMinutes =
        (Math.max(1, track.focus_minutes) + Math.max(0, track.break_minutes)) *
        Math.max(1, track.total_pomodoros);
      const checklist = checklistFromNotes(
        track.notes,
        track.description_as_checklist,
      );

      const created = await tx.studySession.create({
          data: {
            study_session_name: track.title,
            study_session_description: track.notes?.trim() || undefined,
            focus_minutes: track.focus_minutes,
            break_minutes: track.break_minutes,
            total_pomodoros: track.total_pomodoros,
            total_minutes: totalMinutes,
            study_session_scheduled_at: scheduledAt,
            checklist_json: checklist === null ? Prisma.DbNull : checklist,
            study_session_reminder_enabled: false,
            study_session_remind_at_minutes: [],
            study_session_user: {
              create: {
                user_id: userId,
                task_id: taskId,
              },
            },
          },
          include: {
            study_session_user: true,
            study_session_attachments: {
              where: { user_id: userId },
              include: { attachment: true },
            },
          },
        });

      studySessions.push(created);
      createdByTrack[track.client_track_id] = [
        ...(createdByTrack[track.client_track_id] ?? []),
        created.study_session_id,
      ];
    }

    return { studySessions, createdByTrack };
  });
}

export async function getStudySessionForUserById(studySessionId: number, userId: string) {
  const studySession = await prisma.studySession.findUnique({
    where: { study_session_id: studySessionId },
    include: {
      study_session_user: {
        where: { user_id: userId },
      },
      study_session_attachments: {
        where: { user_id: userId },
        include: { attachment: true },
        orderBy: { linked_at: "asc" },
      },
    },
  });

  if (!studySession) return null;

  const studySessionAttachments = await Promise.all(
    studySession.study_session_attachments.map(async (link) => ({
      ...link,
      attachment: {
        ...link.attachment,
        url: await getFileUrl(link.attachment.file_path),
      },
    })),
  );

  return {
    ...studySession,
    study_session_attachments: studySessionAttachments,
  };
}

export async function linkAttachmentToStudySessions(
  userId: string,
  attachmentId: number,
  studySessionIds: number[],
) {
  const attachment = await prisma.attachment.findUnique({
    where: { attachment_id: attachmentId },
  });

  if (!attachment || attachment.user_id !== userId) {
    throw new StudySessionServiceError(404, "Attachment not found");
  }

  const uniqueStudySessionIds = Array.from(new Set(studySessionIds));
  const ownedSessions = await prisma.studySessionUser.findMany({
    where: {
      user_id: userId,
      study_session_id: { in: uniqueStudySessionIds },
    },
    select: { study_session_id: true },
  });

  if (ownedSessions.length !== uniqueStudySessionIds.length) {
    throw new StudySessionServiceError(404, "Study session not found");
  }

  await prisma.studySessionAttachment.createMany({
    data: uniqueStudySessionIds.map((studySessionId) => ({
      study_session_id: studySessionId,
      attachment_id: attachmentId,
      user_id: userId,
    })),
    skipDuplicates: true,
  });

  return true;
}

export async function deleteStudySessionIfMember(studySessionId: number, userId: string) {
  const membership = await prisma.studySessionUser.findUnique({
    where: {
      study_session_id_user_id: {
        study_session_id: studySessionId,
        user_id: userId,
      },
    },
  });

  if (!membership) return false;

  await prisma.studySessionUser.deleteMany({ where: { study_session_id: studySessionId } });
  await prisma.studySession.delete({ where: { study_session_id: studySessionId } });

  return true;
}

export async function updateStudySessionForMember(
  studySessionId: number,
  userId: string,
  parsedData: UpdateStudyInput,
) {
  const membership = await prisma.studySessionUser.findUnique({
    where: {
      study_session_id_user_id: {
        study_session_id: studySessionId,
        user_id: userId,
      },
    },
  });

  if (!membership) return { notFound: true };

  const userFields = ['status', 'started_at', 'current_time', 'completed_at', 'actual_duration'];
  const userUpdates = Object.fromEntries(Object.entries(parsedData).filter(([key]) => userFields.includes(key)));
  const sessionUpdates = Object.fromEntries(Object.entries(parsedData).filter(([key]) => !userFields.includes(key)));

  if (Object.keys(userUpdates).length > 0) {
    const userDataToUpdate = Object.fromEntries(Object.entries(userUpdates).filter(([, v]) => v !== undefined));
    await prisma.studySessionUser.update({
      where: {
        study_session_id_user_id: {
          study_session_id: studySessionId,
          user_id: userId,
        },
      },
      data: userDataToUpdate as Prisma.StudySessionUserUpdateInput,
    });
  }

  let updatedStudySession = null;
  if (Object.keys(sessionUpdates).length > 0) {
    const data = Object.fromEntries(Object.entries(sessionUpdates).filter(([, v]) => v !== undefined)) as Prisma.StudySessionUpdateInput;

    if ('checklist_json' in sessionUpdates && sessionUpdates.checklist_json === null) {
      data.checklist_json = Prisma.DbNull;
    }

    updatedStudySession = await prisma.studySession.update({
      where: { study_session_id: studySessionId },
      data,
    });
  }

  return { notFound: false, updatedStudySession };
}
