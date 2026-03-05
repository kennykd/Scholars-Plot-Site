import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StarRating } from "@/app/components/common/star-rating";
import { TaskDeleteButton } from "../../../components/tasks/task-delete-button";
import { mockTasks } from "@/lib/mock-data";
import { format, formatDistanceToNow } from "date-fns";
import { ArrowLeft, Paperclip, Timer } from "lucide-react";
import { cn } from "@/lib/utils";

const statusColors: Record<string, string> = {
  todo: "bg-muted text-muted-foreground",
  "in-progress": "bg-blue-500/20 text-blue-400 border-blue-500/30",
  done: "bg-green-500/20 text-green-400 border-green-500/30",
};

export default function TaskDetailPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const task = mockTasks.find((t) => t.id === id);

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

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-6">
      <Button variant="ghost" size="sm" asChild className="font-mono text-xs">
        <Link href="/tasks">
          <ArrowLeft className="h-4 w-4 mr-1" /> Tasks
        </Link>
      </Button>
      <Card className="bg-card/80 backdrop-blur-sm border-border/50">
        <CardHeader
          className={cn(
            "border-t-4 rounded-t-xl",
            `priority-${Math.round(task.priority)}`,
          )}
        >
          <div className="flex items-start justify-between gap-3">
            <CardTitle className="font-display text-2xl font-bold text-foreground leading-tight">
              {task.title}
            </CardTitle>
            <Badge
              className={cn(
                "shrink-0 font-mono text-xs border",
                statusColors[task.status],
              )}
              variant="outline"
            >
              {task.status.replace("-", " ").toUpperCase()}
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
                {format(task.deadline, "PPP")}
              </p>
              <p className="font-mono text-xs text-muted-foreground">
                {formatDistanceToNow(task.deadline, { addSuffix: true })}
              </p>
            </div>
            {task.reminder && task.reminder !== "none" && (
              <div>
                <p className="font-mono text-xs text-muted-foreground tracking-wider mb-1">
                  REMINDER
                </p>
                <p className="text-sm font-medium capitalize">
                  {task.reminder.replace("-", " ")}
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
          {task.attachments && task.attachments.length > 0 && (
            <div>
              <p className="font-mono text-xs text-muted-foreground tracking-wider mb-2">
                ATTACHMENTS
              </p>
              <div className="space-y-1">
                {task.attachments.map((file) => (
                  <div
                    key={file}
                    className="flex items-center gap-2 text-sm text-muted-foreground"
                  >
                    <Paperclip className="h-3.5 w-3.5" /> {file}
                  </div>
                ))}
              </div>
            </div>
          )}
          <div className="flex gap-3 pt-2">
            <Button
              asChild
              className="flex-1 bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
            >
              <Link href="/study/timer">
                <Timer className="h-4 w-4 mr-2" /> Start Study Session
              </Link>
            </Button>
            <Button variant="outline" disabled className="font-mono text-xs">
              Edit
            </Button>
            <TaskDeleteButton taskTitle={task.title} />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
