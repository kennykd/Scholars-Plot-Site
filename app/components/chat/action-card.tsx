"use client";

import { useState } from "react";
import type { ActionStatus } from "../../../lib/generated/prisma/client";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProposedSession {
  task_id: number;
  task_name: string;
  study_session_name: string;
  study_session_scheduled_at: Date;
  focus_minutes: number;
  break_minutes: number;
  total_pomodoros: number;
  total_minutes: number;
}

export interface StudyPlanPayload {
  proposed_sessions: ProposedSession[];
  warnings: string[];
  total_scheduled_minutes: number;
}

export interface TaskPayload {
  title: string;
  description: string | null;
  deadline: string;
  priority?: number;
}

export interface ActionCardProps {
  messageId: number;
  conversationId: number;
  userId: string;
  actionType: "CREATE_STUDY_PLAN" | "CREATE_TASK" | "UPDATE_SCHEDULE";
  payload: StudyPlanPayload | TaskPayload | Record<string, unknown>;
  initialStatus: ActionStatus;
}

// ─── ConfirmBar ───────────────────────────────────────────────────────────────

interface ConfirmBarProps {
  onConfirm: () => void;
  onDismiss: () => void;
  loading: boolean;
  status: ActionStatus;
}

function ConfirmBar({ onConfirm, onDismiss, loading, status }: ConfirmBarProps) {
  if (status === "confirmed") {
    return (
      <div className="confirm-bar confirm-bar--confirmed">
        <span className="confirm-bar__icon">✓</span>
        <span>Done</span>
      </div>
    );
  }

  if (status === "dismissed") {
    return (
      <div className="confirm-bar confirm-bar--dismissed">
        <span>Dismissed</span>
      </div>
    );
  }

  return (
    <div className="confirm-bar">
      <button
        className="confirm-bar__btn confirm-bar__btn--dismiss"
        onClick={onDismiss}
        disabled={loading}
        aria-label="Dismiss this suggestion"
      >
        Dismiss
      </button>
      <button
        className="confirm-bar__btn confirm-bar__btn--confirm"
        onClick={onConfirm}
        disabled={loading}
        aria-label="Confirm and apply this suggestion"
      >
        {loading ? "Applying..." : "Apply"}
      </button>
    </div>
  );
}

// ─── StudyPlanCard ────────────────────────────────────────────────────────────

interface StudyPlanCardProps {
  payload: StudyPlanPayload;
}

function StudyPlanCard({ payload }: StudyPlanCardProps) {
  const { proposed_sessions, warnings, total_scheduled_minutes } = payload;

  return (
    <div className="action-card__body">
      <div className="study-plan__meta">
        <span className="study-plan__total">
          {Math.round(total_scheduled_minutes / 60)}h {total_scheduled_minutes % 60}m scheduled
        </span>
        <span className="study-plan__count">
          {proposed_sessions.length} session{proposed_sessions.length !== 1 ? "s" : ""}
        </span>
      </div>

      {warnings.length > 0 && (
        <ul className="study-plan__warnings">
          {warnings.map((w, i) => (
            <li key={i} className="study-plan__warning">
              {w}
            </li>
          ))}
        </ul>
      )}

      <ul className="study-plan__sessions">
        {proposed_sessions.map((session, i) => {
          const date = new Date(session.study_session_scheduled_at);
          const dateLabel = date.toLocaleDateString("en-ID", {
            weekday: "short",
            month: "short",
            day: "numeric",
          });
          const timeLabel = date.toLocaleTimeString("en-ID", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });

          return (
            <li key={i} className="study-plan__session">
              <div className="study-plan__session-header">
                <span className="study-plan__session-name">{session.study_session_name}</span>
                <span className="study-plan__session-task">{session.task_name}</span>
              </div>
              <div className="study-plan__session-meta">
                <span>{dateLabel} · {timeLabel}</span>
                <span>{session.total_minutes} min · {session.total_pomodoros} pomodoros</span>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

// ─── TaskCard ─────────────────────────────────────────────────────────────────

interface TaskCardProps {
  payload: TaskPayload;
}

function TaskCard({ payload }: TaskCardProps) {
  const { title, description, deadline, priority } = payload;

  const deadlineDate = new Date(deadline);
  const deadlineLabel = deadlineDate.toLocaleDateString("en-ID", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
  });

  const priorityLabel = (p?: number) => {
    if (p === undefined || p === null) return "Not set";
    if (p >= 4) return "High";
    if (p >= 2.5) return "Medium";
    return "Low";
  };

  const priorityText = priorityLabel(priority);

  return (
    <div className="action-card__body">
      <div className="task-card__row">
        <span className="task-card__label">Task</span>
        <span className="task-card__value task-card__value--name">{title}</span>
      </div>
      {description && (
        <div className="task-card__row">
          <span className="task-card__label">Notes</span>
          <span className="task-card__value">{description}</span>
        </div>
      )}
      <div className="task-card__row">
        <span className="task-card__label">Deadline</span>
        <span className="task-card__value">{deadlineLabel}</span>
      </div>
      <div className="task-card__row">
        <span className="task-card__label">Priority</span>
        <span className={`task-card__value task-card__priority task-card__priority--${priorityText.toLowerCase().replace(" ", "-")}`}>
          {priorityText}
        </span>
      </div>
    </div>
  );
}

// ─── ActionCard (base) ────────────────────────────────────────────────────────

export function ActionCard({
  messageId,
  conversationId,
  userId,
  actionType,
  payload,
  initialStatus,
}: ActionCardProps) {
  const [status, setStatus] = useState<ActionStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const titleMap: Record<string, string> = {
    CREATE_STUDY_PLAN: "Study Plan",
    CREATE_TASK: "New Task",
    UPDATE_SCHEDULE: "Schedule Update",
  };

  async function patchMessageStatus(nextStatus: "confirmed" | "dismissed") {
    await fetch(`/api/chat/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        user_id: userId,
        message_id: messageId,
        action_status: nextStatus,
      }),
    });
  }

  async function handleConfirm() {
    setLoading(true);
    setError(null);

    try {
      if (actionType === "CREATE_STUDY_PLAN") {
        // Call the schedule confirm endpoint with the proposed sessions
        const res = await fetch("/api/study", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            user_id: userId,
            sessions: (payload as StudyPlanPayload).proposed_sessions,
          }),
        });
        if (!res.ok) throw new Error("Failed to confirm study plan.");
      }

      if (actionType === "CREATE_TASK") {
        const taskPayload = payload as TaskPayload;

        // /api/task's createTaskSchema expects `description` as optional
        // (string | undefined), not nullable — so a null value must be
        // omitted entirely rather than sent as null.
        const body: Record<string, unknown> = {
          title: taskPayload.title,
          deadline: taskPayload.deadline,
        };
        if (taskPayload.description) {
          body.description = taskPayload.description;
        }
        if (taskPayload.priority !== undefined && taskPayload.priority !== null) {
          body.priority = taskPayload.priority;
        }

        const res = await fetch("/api/task", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) throw new Error("Failed to create task.");
      }

      // Patch the message status after the action succeeds
      await patchMessageStatus("confirmed");
      setStatus("confirmed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDismiss() {
    setLoading(true);
    try {
      await patchMessageStatus("dismissed");
      setStatus("dismissed");
    } catch {
      setError("Failed to dismiss.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className={`action-card action-card--${actionType.toLowerCase().replace(/_/g, "-")} action-card--${status}`}>
      <div className="action-card__header">
        <span className="action-card__type-label">{titleMap[actionType] ?? actionType}</span>
      </div>

      {actionType === "CREATE_STUDY_PLAN" && (
        <StudyPlanCard payload={payload as StudyPlanPayload} />
      )}
      {actionType === "CREATE_TASK" && (
        <TaskCard payload={payload as TaskPayload} />
      )}
      {actionType === "UPDATE_SCHEDULE" && (
        <div className="action-card__body">
          {((payload as any).suggestions ?? []).map((s: string, i: number) => (
            <p key={i} className="update-schedule__suggestion">{s}</p>
          ))}
        </div>
      )}

      {error && <p className="action-card__error">{error}</p>}

      <ConfirmBar
        onConfirm={handleConfirm}
        onDismiss={handleDismiss}
        loading={loading}
        status={status}
      />
    </div>
  );
}