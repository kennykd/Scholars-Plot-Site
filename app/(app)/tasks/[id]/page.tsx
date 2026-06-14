import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StarRating } from "@/app/components/common/star-rating";
import { TaskDeleteButton } from "../../../components/tasks/task-delete-button";
import { TaskAttachmentDeleteButton } from "../../../components/tasks/task-attachment-delete-button";
import { TaskCompleteButton } from "../../../components/tasks/task-complete-button";
import { getSession } from "@/lib/firebase/auth";
import {
  getStudySessionsForTask,
  getTaskById,
  serializeTask,
  TaskServiceError,
} from "@/lib/services/taskService";
import { listTaskAttachments } from "@/lib/services/attachmentService";
import type { Attachment, Task } from "@/types";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowLeft, BookOpen, Paperclip } from "lucide-react";
import { cn } from "@/lib/utils";
import { taskStatusColors, taskStatusLabels } from "@/lib/tasks/task-status";
import { AI_READABLE_ATTACHMENT_HELPER_TEXT } from "@/lib/ai/attachmentSupport";

interface LinkedStudySession {
  id: number;
  title: string;
  scheduledAt: string;
  focusMinutes: number;
}

export default async function TaskDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { id } = await params;
  const numericId = Number(id);

  let task: Task | null = null;
  let attachments: Attachment[] = [];
  let sessions: LinkedStudySession[] = [];
  if (Number.isFinite(numericId) && numericId > 0) {
    try {
      const [row, atts, sessionRows] = await Promise.all([
        getTaskById(numericId, session.id),
        listTaskAttachments(numericId, session.id),
        getStudySessionsForTask(numericId, session.id),
      ]);
      attachments = atts;
      sessions = sessionRows.map((row) => ({
        id: row.study_session_id,
        title: row.study_session.study_session_name,
        scheduledAt: row.study_session.study_session_scheduled_at.toISOString(),
        focusMinutes: row.study_session.focus_minutes,
      }));
      task = serializeTask(row, attachments);
    } catch (err) {
      if (!(err instanceof TaskServiceError)) throw err;
      task = null;
    }
  }

  if (!task)
    return (
      <div className="p-6 flex flex-col items-center justify-center min-h-[60vh] gap-4">
        <p className="font-display text-2xl font-bold text-muted-foreground">
          Task not found
        </p>
        <Button asChild variant="outline">
          <Link href="/tasks">Back to Tasks</Link>
        </Button>
      </div>
    );

  const deadlineDate = new Date(task.deadline);

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild className="font-mono text-xs">
        <Link href="/tasks">
          <ArrowLeft className="h-4 w-4 mr-1" /> Tasks
        </Link>
      </Button>
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader className={cn(`priority-${Math.round(task.priority)}`)}>
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="font-display text-2xl font-bold text-foreground leading-tight">
              {task.title}
            </CardTitle>
            <Badge
              className={cn(
                "shrink-0 font-mono text-xs border",
                taskStatusColors[task.status],
              )}
              variant="outline"
            >
              {taskStatusLabels[task.status]}
            </Badge>
          </div>
          <StarRating value={task.priority} size="lg" readOnly />
        </CardHeader>
        <CardContent className="space-y-5 pt-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="font-mono text-xs text-muted-foreground tracking-wider mb-1">
                DEADLINE
              </p>
              <p className="text-sm font-medium">
                {format(deadlineDate, "PPP")}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {formatDistanceToNow(deadlineDate, { addSuffix: true })}
              </p>
            </div>
            {task.completedAt && (
              <div>
                <p className="font-mono text-xs text-muted-foreground tracking-wider mb-1">
                  COMPLETED
                </p>
                <p className="text-sm font-medium">
                  {format(new Date(task.completedAt), "PPP")}
                </p>
              </div>
            )}
          </div>
          {task.description && (
            <div>
              <p className="font-mono text-xs text-muted-foreground tracking-wider mb-2">
                DESCRIPTION
              </p>
              <p className="text-sm text-foreground/80 leading-relaxed">
                {task.description}
              </p>
            </div>
          )}
          <div>
            <p className="font-mono text-xs text-muted-foreground tracking-wider mb-2">
              STUDY SESSIONS
            </p>
            {sessions.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No study sessions planned yet.
                </p>
            ) : (
              <ul className="space-y-1.5">
                {sessions.map((s) => (
                  <li key={s.id}>
                    <Link
                      href={`/study/${s.id}`}
                      className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2 hover:bg-muted/40 transition-colors"
                    >
                      <BookOpen className="h-4 w-4 text-muted-foreground shrink-0" />
                      <span className="text-sm flex-1 truncate text-foreground">
                        {s.title}
                      </span>
                      <span className="font-mono text-[10px] text-muted-foreground shrink-0">
                        {format(new Date(s.scheduledAt), "MMM d, p")}
                      </span>
                    </Link>
                  </li>
                ))}
              </ul>
            )}
          </div>
          {attachments.length > 0 && (
            <div>
              <p className="font-mono text-xs text-muted-foreground tracking-wider mb-2">
                ATTACHMENTS
              </p>
              <p className="font-mono text-[10px] text-muted-foreground mb-2">
                {AI_READABLE_ATTACHMENT_HELPER_TEXT}
              </p>
              <ul className="space-y-1.5">
                {attachments.map((att) => (
                  <li
                    key={att.id}
                    className="flex items-center gap-2 rounded-lg border border-border/40 bg-muted/20 px-3 py-2"
                  >
                    <Paperclip className="h-4 w-4 text-muted-foreground shrink-0" />
                    <a
                      href={att.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-sm flex-1 truncate text-foreground hover:text-accent transition-colors"
                    >
                      {att.fileName}
                    </a>
                    <TaskAttachmentDeleteButton
                      taskId={task.id}
                      attachmentId={att.id}
                      fileName={att.fileName}
                    />
                  </li>
                ))}
              </ul>
            </div>
          )}
          {task.status !== "Completed" && (
            <TaskCompleteButton taskId={task.id} />
          )}
          <div className="flex gap-3 pt-2">
            <Button variant="outline" disabled className="font-mono text-xs">
              Edit
            </Button>
            <TaskDeleteButton taskId={task.id} taskTitle={task.title} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
