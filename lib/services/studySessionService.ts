import prisma from "@/lib/prisma";
import { Prisma } from "@/lib/generated/prisma/client";
import type { StudySession } from "@/types";

type StudySessionRow = Prisma.StudySessionGetPayload<{
  include: {
    study_session_user: true;
  };
}>;

function mapStudySessionRow(row: StudySessionRow): StudySession {
  const userStudySession = row.study_session_user?.[0];
  const rawStatus = userStudySession?.status;

  return {
    id: String(row.study_session_id),
    title: row.study_session_name ?? "Study Session",
    notes: row.study_session_description ?? "",
    attachments: [],
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

export async function createStudySessionForUser(userId: string, payload: any) {
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
    },
  });

  return studySession;
}

export async function getStudySessionForUserById(studySessionId: number, userId: string) {
  const studySession = await prisma.studySession.findUnique({
    where: { study_session_id: studySessionId },
    include: {
      study_session_user: {
        where: { user_id: userId },
      },
    },
  });

  return studySession;
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

export async function updateStudySessionForMember(studySessionId: number, userId: string, parsedData: any) {
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