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
import { getAnalyticsByUserId, updateAnalyticsByUserId } from "@/lib/services/analyticService";

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

type BatchReminderSettings = {
  reminderEnabled?: boolean;
  reminders?: number[];
};

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

function parseLocalDateString(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(year, month - 1, day);

  if (
    date.getFullYear() !== year ||
    date.getMonth() !== month - 1 ||
    date.getDate() !== day
  ) {
    return null;
  }

  return date;
}

// Convert a repeat cadence into the number of days between occurrences. Shared
// by the batch planner and the single/standalone create flow so both expand
// recurrence identically (1-30 days, 1-12 weeks).
function repeatStepDays(
  enabled: boolean | undefined,
  every: number | undefined,
  unit: "days" | "weeks" | undefined,
) {
  if (!enabled) return 0;

  const repeatEvery = Math.round(Number(every) || 1);

  if (unit === "days") {
    return Math.max(1, Math.min(30, repeatEvery));
  }

  return Math.max(1, Math.min(12, repeatEvery)) * 7;
}

function getRepeatDays(plan: CreateStudyBatchInput["plans"][number]) {
  if (plan.repeat_enabled === true) {
    return repeatStepDays(true, plan.repeat_every, plan.repeat_unit);
  }

  if (plan.repeat_enabled === false) return 0;

  if (plan.repeat === "weekly") return 7;
  if (plan.repeat === "biweekly") return 14;
  return 0;
}

function expandOccurrences(first: Date, stepDays: number, bound: Date) {
  if (stepDays <= 0) return [first];

  const occurrences: Date[] = [];
  const cursor = new Date(first);

  while (
    occurrences.length < MAX_GENERATED_SESSIONS &&
    cursor <= bound
  ) {
    occurrences.push(new Date(cursor));
    cursor.setDate(cursor.getDate() + stepDays);
  }

  return occurrences.length > 0 ? occurrences : [first];
}

function generateSessionsFromPlans(
  plans: CreateStudyBatchInput["plans"],
  deadline: Date,
  now = new Date(),
) {
  const generated: Array<{
    plan: CreateStudyBatchInput["plans"][number];
    scheduledAt: Date;
  }> = [];
  const seen = new Set<string>();

  const addCandidate = (
    plan: CreateStudyBatchInput["plans"][number],
    date: Date,
  ) => {
    const scheduledAt = combineDateAndTime(date, plan.time);
    if (scheduledAt < now || scheduledAt > deadline) return;

    const key = `${plan.client_plan_id}:${scheduledAt.getTime()}`;
    if (seen.has(key)) return;

    seen.add(key);
    generated.push({ plan, scheduledAt });
  };

  for (const plan of plans) {
    const startDate = parseLocalDateString(plan.start_date);
    if (!startDate) continue;

    const repeatDays = getRepeatDays(plan);
    const cursor = new Date(startDate);

    while (cursor <= deadline) {
      addCandidate(plan, cursor);

      if (repeatDays === 0) break;
      cursor.setDate(cursor.getDate() + repeatDays);
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
    repeat_enabled,
    repeat_every,
    repeat_unit,
  } = payload;

  const reminderMinutes = (reminders ?? []).map((reminderMinute: number) => Math.max(0, reminderMinute));
  const reminderEnabled = reminder_enabled ?? reminderMinutes.length > 0;

  if (repeat_enabled && !task_id) {
    throw new StudySessionServiceError(
      400,
      "Choose a task before repeating a study session",
    );
  }

  // Resolving the task blocks linking to a task the user does not own and
  // supplies the deadline used to bound repeats.
  let bound: Date | null = null;
  if (task_id) {
    const task = await requireTaskAccess(task_id, userId);
    bound = task.task_deadline;
  }

  const stepDays = repeatStepDays(repeat_enabled, repeat_every, repeat_unit);
  const occurrences =
    stepDays > 0 && bound
      ? expandOccurrences(study_session_scheduled_at, stepDays, bound)
      : [study_session_scheduled_at];

  const include = {
    study_session_user: true,
    study_session_attachments: {
      where: { user_id: userId },
      include: { attachment: true },
    },
  } satisfies Prisma.StudySessionInclude;

  const dataFor = (scheduledAt: Date): Prisma.StudySessionUncheckedCreateInput => ({
    study_session_name,
    study_session_description,
    focus_minutes,
    break_minutes,
    total_pomodoros,
    total_minutes,
    study_session_scheduled_at: scheduledAt,
    checklist_json: checklist_json === null ? Prisma.DbNull : checklist_json,
    study_session_reminder_enabled: reminderEnabled,
    study_session_remind_at_minutes: reminderMinutes,
    study_session_user: {
      create: {
        user_id: userId,
        task_id: task_id || null,
        attachment_id: attachment_id || null,
      },
    },
  });

  // The common (non-repeating) case stays a single create; repeats fan out
  // inside one transaction so a failure rolls back the whole series.
  if (occurrences.length === 1) {
    const studySession = await prisma.studySession.create({
      data: dataFor(occurrences[0]),
      include,
    });

    return { studySession, sessionIds: [studySession.study_session_id] };
  }

  const studySessions = await prisma.$transaction((tx) =>
    Promise.all(
      occurrences.map((scheduledAt) =>
        tx.studySession.create({ data: dataFor(scheduledAt), include }),
      ),
    ),
  );

  return {
    studySession: studySessions[0],
    sessionIds: studySessions.map((row) => row.study_session_id),
  };
}

export async function createStudySessionsForTask(
  userId: string,
  taskId: number,
  plans: CreateStudyBatchInput["plans"],
  reminderSettings: BatchReminderSettings = {},
) {
  const task = await requireTaskAccess(taskId, userId);
  const generatedSessions = generateSessionsFromPlans(
    plans,
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
    const createdByPlan: Record<string, number[]> = {};
    const reminderMinutes = (reminderSettings.reminders ?? []).map(
      (reminderMinute) => Math.max(0, reminderMinute),
    );
    const reminderEnabled =
      reminderSettings.reminderEnabled ?? reminderMinutes.length > 0;

    for (const generated of generatedSessions) {
      const { plan, scheduledAt } = generated;
      const totalMinutes =
        (Math.max(1, plan.focus_minutes) + Math.max(0, plan.break_minutes)) *
        Math.max(1, plan.total_pomodoros);
      const checklist = checklistFromNotes(
        plan.notes,
        plan.description_as_checklist,
      );

      const created = await tx.studySession.create({
          data: {
            study_session_name: plan.title,
            study_session_description: plan.notes?.trim() || undefined,
            focus_minutes: plan.focus_minutes,
            break_minutes: plan.break_minutes,
            total_pomodoros: plan.total_pomodoros,
            total_minutes: totalMinutes,
            study_session_scheduled_at: scheduledAt,
            checklist_json: checklist === null ? Prisma.DbNull : checklist,
            study_session_reminder_enabled: reminderEnabled,
            study_session_remind_at_minutes: reminderEnabled
              ? reminderMinutes
              : [],
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
      createdByPlan[plan.client_plan_id] = [
        ...(createdByPlan[plan.client_plan_id] ?? []),
        created.study_session_id,
      ];
    }

    return { studySessions, createdByPlan };
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

  // Linking/relinking a task requires ownership of that task; null unlinks it.
  if (parsedData.task_id != null) {
    await requireTaskAccess(parsedData.task_id, userId);
  }

  // When the parsed data status is changing to completed from a non-completed status,
  // it means the user is completing the study session.
  const isCompleting = parsedData.status === "completed" && membership.status !== "completed";

  // task_id lives on the StudySessionUser junction, so route it with the other
  // user-scoped fields (a null value unlinks the task).
  const userFields = ['status', 'started_at', 'current_time', 'completed_at', 'actual_duration', 'task_id'];
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
    // `reminder_enabled` / `reminders` are API field names, not columns — pull
    // them out and map onto the actual StudySession reminder columns (mirrors
    // the create path) so the spread below only contains real Prisma fields.
    const { reminder_enabled, reminders, ...rest } = sessionUpdates as {
      reminder_enabled?: boolean;
      reminders?: number[];
      [key: string]: unknown;
    };

    const data = Object.fromEntries(Object.entries(rest).filter(([, v]) => v !== undefined)) as Prisma.StudySessionUpdateInput;

    if (reminder_enabled !== undefined) {
      data.study_session_reminder_enabled = reminder_enabled;
    }
    if (reminders !== undefined) {
      data.study_session_remind_at_minutes = reminders.map((minute) =>
        Math.max(0, Number(minute) || 0),
      );
    }

    if ('checklist_json' in sessionUpdates && sessionUpdates.checklist_json === null) {
      data.checklist_json = Prisma.DbNull;
    }

    updatedStudySession = await prisma.studySession.update({
      where: { study_session_id: studySessionId },
      data,
    });
  }

  // When the user is 
  if (isCompleting) {
    const focusSecondsGiven = Number(parsedData.actual_duration);

    if (!isNaN(focusSecondsGiven) && focusSecondsGiven > 0) {
      const focusedMinutesGiven = Math.round(focusSecondsGiven / 60);

      if (focusedMinutesGiven > 0) {
        const currentAnalytics = await getAnalyticsByUserId(userId);

        if (currentAnalytics) {
          // Access totalFocusMinutes from the structured AnalyticsData view object
          await updateAnalyticsByUserId(userId, {
            total_focus_minutes: currentAnalytics.totalFocusMinutes + focusedMinutesGiven,
            streak_activity: true, // signal the streak activity when study session is completed
          });
        }
      }
    }
  }

  return { notFound: false, updatedStudySession };
}
