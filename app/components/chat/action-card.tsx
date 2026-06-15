"use client";

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  BookOpen,
  Calendar,
  Check,
  Clock,
  FileText,
  Loader2,
  Sparkles,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type ActionStatus = "none" | "pending" | "confirmed" | "dismissed";
type ActionType = "CREATE_TASK_DRAFT" | "CREATE_STUDY_TRACK_DRAFT";

export interface TaskDraftPayload {
  title: string;
  description?: string | null;
  deadline?: string | null;
  priority?: number | null;
  reasoning?: string | null;
}

export interface StudyTrackPlan {
  client_plan_id: string;
  title: string;
  start_date: string;
  repeat_enabled?: boolean;
  repeat_every?: number;
  repeat_unit?: "days" | "weeks";
  time: string;
  focus_minutes: number;
  break_minutes: number;
  total_pomodoros: number;
  notes?: string;
  description_as_checklist?: boolean;
}

export interface StudyTrackDraftPayload {
  task_id: number;
  task_title: string;
  plans: StudyTrackPlan[];
  warnings?: string[];
  reasoning?: string | null;
}

export interface ActionCardProps {
  messageId: number;
  conversationId: number;
  actionType: ActionType;
  payload: TaskDraftPayload | StudyTrackDraftPayload | Record<string, unknown>;
  initialStatus: ActionStatus;
  onStatusChange?: (messageId: number, status: ActionStatus) => void;
}

function isTaskDraftPayload(payload: ActionCardProps["payload"]): payload is TaskDraftPayload {
  return typeof (payload as TaskDraftPayload).title === "string";
}

function isStudyDraftPayload(
  payload: ActionCardProps["payload"],
): payload is StudyTrackDraftPayload {
  return (
    typeof (payload as StudyTrackDraftPayload).task_id === "number" &&
    Array.isArray((payload as StudyTrackDraftPayload).plans)
  );
}

function formatDate(value?: string | null) {
  if (!value) return "Missing";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Invalid";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function priorityLabel(priority?: number | null) {
  if (priority === undefined || priority === null) return "Not set";
  if (priority >= 4) return "High";
  if (priority >= 2.5) return "Medium";
  return "Low";
}

function statusLabel(status: ActionStatus) {
  if (status === "confirmed") return "Done";
  if (status === "dismissed") return "Dismissed";
  return "Pending";
}

function TaskDraftCard({ payload }: { payload: TaskDraftPayload }) {
  const priority = priorityLabel(payload.priority);

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-accent/10 text-accent">
          <FileText className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {payload.title}
          </p>
          {payload.description && (
            <p className="mt-1 line-clamp-3 text-xs leading-5 text-muted-foreground">
              {payload.description}
            </p>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <Badge variant="outline" className="justify-start gap-1.5 font-mono text-[10px]">
          <Calendar className="h-3 w-3" />
          {formatDate(payload.deadline)}
        </Badge>
        <Badge
          variant="outline"
          className={cn(
            "justify-start font-mono text-[10px]",
            priority === "High" && "border-red-500/30 bg-red-500/10 text-red-500",
            priority === "Medium" &&
              "border-yellow-500/30 bg-yellow-500/10 text-yellow-600 dark:text-yellow-300",
            priority === "Low" && "border-green-500/30 bg-green-500/10 text-green-600",
          )}
        >
          Priority {priority}
        </Badge>
      </div>

      {payload.reasoning && (
        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
          {payload.reasoning}
        </p>
      )}
    </div>
  );
}

function StudyTrackDraftCard({ payload }: { payload: StudyTrackDraftPayload }) {
  const totalMinutes = useMemo(
    () =>
      payload.plans.reduce(
        (sum, plan) =>
          sum + plan.focus_minutes * plan.total_pomodoros + plan.break_minutes * Math.max(0, plan.total_pomodoros - 1),
        0,
      ),
    [payload.plans],
  );

  return (
    <div className="space-y-3">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-blue-500/10 text-blue-500">
          <BookOpen className="h-4 w-4" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-foreground">
            {payload.task_title}
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge variant="secondary" className="font-mono text-[10px]">
              {payload.plans.length} session{payload.plans.length === 1 ? "" : "s"}
            </Badge>
            <Badge variant="secondary" className="gap-1 font-mono text-[10px]">
              <Clock className="h-3 w-3" />
              {totalMinutes}m
            </Badge>
          </div>
        </div>
      </div>

      {payload.warnings && payload.warnings.length > 0 && (
        <div className="space-y-1 rounded-md border border-yellow-500/20 bg-yellow-500/10 p-2">
          {payload.warnings.map((warning) => (
            <p
              key={warning}
              className="flex gap-1.5 text-xs leading-5 text-yellow-700 dark:text-yellow-300"
            >
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
              <span>{warning}</span>
            </p>
          ))}
        </div>
      )}

      <div className="space-y-2">
        {payload.plans.map((plan) => (
          <div
            key={plan.client_plan_id}
            className="rounded-md border border-border/70 bg-background/50 px-3 py-2"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="min-w-0 truncate text-xs font-semibold text-foreground">
                {plan.title}
              </p>
              <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
                {plan.start_date} {plan.time}
              </Badge>
            </div>
            <div className="mt-1 flex flex-wrap gap-1.5 text-[11px] text-muted-foreground">
              <span>{plan.focus_minutes}m focus</span>
              <span>{plan.break_minutes}m break</span>
              <span>{plan.total_pomodoros} rounds</span>
              {plan.repeat_enabled && (
                <span>
                  repeats every {plan.repeat_every ?? 1} {plan.repeat_unit ?? "weeks"}
                </span>
              )}
            </div>
            {plan.notes && (
              <p className="mt-1 line-clamp-2 text-xs leading-5 text-muted-foreground">
                {plan.notes}
              </p>
            )}
          </div>
        ))}
      </div>

      {payload.reasoning && (
        <p className="rounded-md bg-muted/50 px-3 py-2 text-xs leading-5 text-muted-foreground">
          {payload.reasoning}
        </p>
      )}
    </div>
  );
}

export function ActionCard({
  messageId,
  conversationId,
  actionType,
  payload,
  initialStatus,
  onStatusChange,
}: ActionCardProps) {
  const [status, setStatus] = useState<ActionStatus>(initialStatus);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setStatus(initialStatus);
  }, [initialStatus]);

  const title =
    actionType === "CREATE_STUDY_TRACK_DRAFT" ? "Study Draft" : "Task Draft";
  const canApply =
    status === "pending" &&
    ((actionType === "CREATE_TASK_DRAFT" &&
      isTaskDraftPayload(payload) &&
      Boolean(payload.deadline)) ||
      (actionType === "CREATE_STUDY_TRACK_DRAFT" &&
        isStudyDraftPayload(payload) &&
        payload.plans.length > 0));

  async function patchMessageStatus(nextStatus: "confirmed" | "dismissed") {
    const response = await fetch(`/api/chat/${conversationId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        message_id: messageId,
        action_status: nextStatus,
      }),
    });

    if (!response.ok) {
      throw new Error("Could not save action status.");
    }
  }

  async function applyTaskDraft(taskPayload: TaskDraftPayload) {
    if (!taskPayload.deadline) {
      throw new Error("This task draft needs a deadline before it can be applied.");
    }

    const body: Record<string, unknown> = {
      title: taskPayload.title,
      deadline: taskPayload.deadline,
    };

    if (taskPayload.description) body.description = taskPayload.description;
    if (taskPayload.priority !== undefined && taskPayload.priority !== null) {
      body.priority = taskPayload.priority;
    }

    const response = await fetch("/api/task", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      throw new Error("Failed to create task.");
    }
  }

  async function applyStudyDraft(studyPayload: StudyTrackDraftPayload) {
    const response = await fetch("/api/study/batch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        task_id: studyPayload.task_id,
        plans: studyPayload.plans,
      }),
    });

    if (!response.ok) {
      throw new Error("Failed to create study sessions.");
    }
  }

  async function handleConfirm() {
    if (!canApply) return;

    setLoading(true);
    setError(null);

    try {
      if (actionType === "CREATE_TASK_DRAFT" && isTaskDraftPayload(payload)) {
        await applyTaskDraft(payload);
      }

      if (
        actionType === "CREATE_STUDY_TRACK_DRAFT" &&
        isStudyDraftPayload(payload)
      ) {
        await applyStudyDraft(payload);
      }

      await patchMessageStatus("confirmed");
      setStatus("confirmed");
      onStatusChange?.(messageId, "confirmed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setLoading(false);
    }
  }

  async function handleDismiss() {
    setLoading(true);
    setError(null);

    try {
      await patchMessageStatus("dismissed");
      setStatus("dismissed");
      onStatusChange?.(messageId, "dismissed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to dismiss draft.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div
      className={cn(
        "rounded-lg border border-border/70 bg-card shadow-sm",
        status !== "pending" && "opacity-75",
      )}
    >
      <div className="flex items-center justify-between gap-3 border-b border-border/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <Sparkles className="h-3.5 w-3.5 shrink-0 text-accent" />
          <span className="truncate font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            {title}
          </span>
        </div>
        <Badge variant="outline" className="shrink-0 font-mono text-[10px]">
          {statusLabel(status)}
        </Badge>
      </div>

      <div className="p-3">
        {actionType === "CREATE_TASK_DRAFT" && isTaskDraftPayload(payload) && (
          <TaskDraftCard payload={payload} />
        )}
        {actionType === "CREATE_STUDY_TRACK_DRAFT" &&
          isStudyDraftPayload(payload) && <StudyTrackDraftCard payload={payload} />}
      </div>

      {error && (
        <p className="mx-3 mb-3 rounded-md border border-red-500/20 bg-red-500/10 px-3 py-2 text-xs text-red-600">
          {error}
        </p>
      )}

      {status === "pending" ? (
        <div className="flex items-center gap-2 border-t border-border/60 px-3 py-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleDismiss}
            disabled={loading}
            className="h-8 flex-1 gap-1.5 font-mono text-xs"
          >
            <X className="h-3.5 w-3.5" />
            Dismiss
          </Button>
          <Button
            type="button"
            size="sm"
            onClick={handleConfirm}
            disabled={loading || !canApply}
            className="h-8 flex-1 gap-1.5 bg-accent font-mono text-xs text-accent-foreground hover:bg-accent/90"
          >
            {loading ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Apply
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2 border-t border-border/60 px-3 py-2 text-xs text-muted-foreground">
          {status === "confirmed" ? (
            <Check className="h-3.5 w-3.5 text-green-500" />
          ) : (
            <X className="h-3.5 w-3.5" />
          )}
          <span>{statusLabel(status)}</span>
        </div>
      )}
    </div>
  );
}
