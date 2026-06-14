import prisma from '../prisma';
import { MessageRole, ActionStatus } from "../generated/prisma/client";
import { getUserPendingTasks, getUserAvailability } from "./scheduleService";
import { getCurrentWeights } from "./weightService";
import { getScheduledSessionsForWeek, getOverloadWarningsForUser } from "./overloadService";

// ─── Context Types ────────────────────────────────────────────────────────────

export interface ContextTask {
  task_id: number;
  task_name: string;
  task_deadline: string;
  hours_until_deadline: number;
  estimated_minutes: number | null;
  ai_priority_score: number | null;
  grade_weight_percent: number | null;
  task_status: string;
}

export interface ContextAvailability {
  day_of_week: number;
  day_name: string;
  start_time: string;
  end_time: string;
  available_minutes: number;
}

export interface ContextSession {
  study_session_name: string;
  scheduled_at: string;
  total_minutes: number;
  task_name: string | null;
  status: string;
}

export interface ContextBehaviorProfile {
  peak_productivity_hours: string | null;
  avg_estimation_accuracy: string | null;
  preferred_session_length_minutes: number | null;
  tends_to_overcommit: boolean | null;
  high_effort_subjects: string[];
}

export interface ChatContext {
  meta: {
    current_datetime: string;
    timezone: string;
    day_of_week: string;
  };
  pending_tasks: ContextTask[];
  availability: ContextAvailability[];
  scheduled_sessions: ContextSession[];
  active_overload_warning: {
    severity: string;
    summary: string | null;
  } | null;
  formula_weights: {
    w_impact: number;
    w_ease: number;
    w_urgency: number;
  };
  behavior_profile: ContextBehaviorProfile | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAY_NAMES = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];

function hoursUntilDeadline(deadline: Date, now: Date): number {
  return Math.round((deadline.getTime() - now.getTime()) / (1000 * 60 * 60));
}

function slotMinutes(start: string, end: string): number {
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  return (eh * 60 + em) - (sh * 60 + sm);
}

function getWeekBounds(now: Date): { start: Date; end: Date } {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 7);
  return { start, end };
}

// ─── Context Builder ──────────────────────────────────────────────────────────

export async function buildChatContext(userId: string): Promise<ChatContext> {
  const now = new Date();
  const { start: weekStart, end: weekEnd } = getWeekBounds(now);

  // Fetch all data in parallel
  const [rawTasks, rawAvailability, rawSessions, rawWarnings, weights, user] =
    await Promise.all([
      getUserPendingTasks(userId),
      getUserAvailability(userId),
      getScheduledSessionsForWeek(userId, weekStart, weekEnd),
      getOverloadWarningsForUser(userId, 1),
      getCurrentWeights(userId),
      prisma.user.findUnique({
        where: { user_id: userId },
        select: { ai_behavior_profile: true },
      }),
    ]);

  // Build pending tasks — top 10 by priority, always include tasks due < 24h
  const sorted = [...rawTasks].sort(
    (a, b) => (b.ai_priority_score ?? 0) - (a.ai_priority_score ?? 0)
  );
  const top10 = sorted.slice(0, 10);
  const urgentOverflow = sorted.slice(10).filter(
    (t) => hoursUntilDeadline(new Date(t.task_deadline), now) <= 24
  );
  const taskPool = [...top10, ...urgentOverflow].slice(0, 15);

  const pending_tasks: ContextTask[] = taskPool.map((t) => ({
    task_id: t.task_id,
    task_name: t.task_name,
    task_deadline: new Date(t.task_deadline).toISOString(),
    hours_until_deadline: hoursUntilDeadline(new Date(t.task_deadline), now),
    estimated_minutes: t.estimated_minutes ?? null,
    ai_priority_score: t.ai_priority_score ?? null,
    grade_weight_percent: t.grade_weight_percent
      ? Number(t.grade_weight_percent)
      : null,
    task_status: t.task_status,
  }));

  // Build availability — active slots only, next 7 days
  const availability: ContextAvailability[] = rawAvailability
    .filter((a) => a.is_active)
    .map((a) => ({
      day_of_week: a.day_of_week,
      day_name: DAY_NAMES[a.day_of_week],
      start_time: a.start_time,
      end_time: a.end_time,
      available_minutes: slotMinutes(a.start_time, a.end_time),
    }));

  // Build scheduled sessions
  const scheduled_sessions: ContextSession[] = rawSessions.map((s) => {
    const sessionDate = s.scheduled_at;
    const isValidDate = sessionDate && !isNaN(sessionDate.getTime());
    const formattedDate = isValidDate ? sessionDate.toISOString() : new Date().toISOString();

    return {
      study_session_name: s.study_session_name,
      scheduled_at: formattedDate, 
      total_minutes: s.total_minutes,
      task_name: s.task_name,
      // 1. Add the missing status property here!
      // Try s.status, s.sessionStatus, or use a fallback string if it isn't on the database object
      status: (s as any).status || (s as any).sessionStatus || "idle", 
    };
  });

  // Active overload warning — most recent unread only
  const latestWarning = rawWarnings.find((w) => !w.is_read) ?? null;
  const active_overload_warning = latestWarning
    ? {
      severity: (latestWarning.warnings as any)?.severity ?? "unknown",
      summary: (latestWarning.warnings as any)?.summary ?? null,
    }
    : null;

  // Formula weights — fall back to defaults if not set
  const formula_weights = weights
    ? {
      w_impact: Number(weights.w_impact),
      w_ease: Number(weights.w_ease),
      w_urgency: Number(weights.w_urgency),
    }
    : { w_impact: 3.0, w_ease: 3.0, w_urgency: 4.0 };

  // Behavior profile — only inject if it exists
  const rawProfile = user?.ai_behavior_profile as ContextBehaviorProfile | null;
  const behavior_profile: ContextBehaviorProfile | null = rawProfile
    ? {
      peak_productivity_hours: rawProfile.peak_productivity_hours ?? null,
      avg_estimation_accuracy: rawProfile.avg_estimation_accuracy ?? null,
      preferred_session_length_minutes:
        rawProfile.preferred_session_length_minutes ?? null,
      tends_to_overcommit: rawProfile.tends_to_overcommit ?? null,
      high_effort_subjects: rawProfile.high_effort_subjects ?? [],
    }
    : null;

  // Meta
  const tzOffset = "+07:00"; // Asia/Jakarta
  const isoWithTz = now.toISOString().replace("Z", tzOffset);

  return {
    meta: {
      current_datetime: isoWithTz,
      timezone: "Asia/Jakarta",
      day_of_week: DAY_NAMES[now.getDay()],
    },
    pending_tasks,
    availability,
    scheduled_sessions,
    active_overload_warning,
    formula_weights,
    behavior_profile,
  };
}

// ─── Conversation CRUD ────────────────────────────────────────────────────────

export async function createConversation(userId: string, title?: string) {
  return prisma.chatConversation.create({
    data: {
      user_id: userId,
      title: title ?? null,
    },
  });
}

export async function getConversation(conversationId: number, userId: string) {
  return prisma.chatConversation.findFirst({
    where: { id: conversationId, user_id: userId },
    include: { messages: { orderBy: { created_at: "asc" } } },
  });
}

export async function listConversations(userId: string) {
  return prisma.chatConversation.findMany({
    where: { user_id: userId },
    orderBy: { updated_at: "desc" },
    include: {
      messages: {
        orderBy: { created_at: "desc" },
        take: 1, // last message preview
      },
    },
  });
}

export async function deleteConversation(conversationId: number, userId: string) {
  // Verify ownership before deleting
  const conv = await prisma.chatConversation.findFirst({
    where: { id: conversationId, user_id: userId },
  });
  if (!conv) return null;

  return prisma.chatConversation.delete({
    where: { id: conversationId },
  });
}

// ─── Message Persistence ──────────────────────────────────────────────────────

export async function getConversationHistory(conversationId: number) {
  return prisma.chatMessage.findMany({
    where: { conversation_id: conversationId },
    orderBy: { created_at: "asc" },
  });
}

export async function saveMessagePair(
  conversationId: number,
  userText: string,
  assistantRawResponse: string,
  assistantStructuredJson: object | null
) {
  // Save both in a transaction — never leave a dangling user message
  const [userMessage, assistantMessage] = await prisma.$transaction([
    prisma.chatMessage.create({
      data: {
        conversation_id: conversationId,
        role: MessageRole.user,
        text_content: userText,
        structured_json: undefined,
        action_status: ActionStatus.none,
      },
    }),
    prisma.chatMessage.create({
      data: {
        conversation_id: conversationId,
        role: MessageRole.assistant,
        text_content: assistantRawResponse,
        structured_json: assistantStructuredJson ?? undefined,
        action_status: assistantStructuredJson
          ? ActionStatus.pending
          : ActionStatus.none,
      },
    }),
  ]);

  // Bump conversation updated_at
  await prisma.chatConversation.update({
    where: { id: conversationId },
    data: { updated_at: new Date() },
  });

  return { userMessage, assistantMessage };
}

export async function updateMessageActionStatus(
  messageId: number,
  userId: string,
  status: ActionStatus
) {
  // Verify the message belongs to this user via conversation ownership
  const message = await prisma.chatMessage.findFirst({
    where: {
      id: messageId,
      conversation: { user_id: userId },
    },
  });
  if (!message) return null;

  return prisma.chatMessage.update({
    where: { id: messageId },
    data: { action_status: status },
  });
}

// ─── Auto-title ───────────────────────────────────────────────────────────────

export async function setConversationTitle(
  conversationId: number,
  firstUserMessage: string
) {
  const title =
    firstUserMessage.length > 60
      ? firstUserMessage.slice(0, 57) + "..."
      : firstUserMessage;

  return prisma.chatConversation.update({
    where: { id: conversationId },
    data: { title },
  });
}