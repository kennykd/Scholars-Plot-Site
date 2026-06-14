"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PlayCircle, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";
import type { TaskStatus } from "@/types";

interface TaskInProgressButtonProps {
  taskId: number;
  initialStatus?: TaskStatus;
}

export function TaskInProgressButton({
  taskId,
  initialStatus = "Pending",
}: TaskInProgressButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<TaskStatus>(initialStatus);

  useEffect(() => {
    setCurrentStatus(initialStatus);
  }, [initialStatus]);

  const isInProgress = currentStatus === "In_Progress";

  const handleClick = async () => {
    setPending(true);
    const nextStatus: TaskStatus = isInProgress ? "Pending" : "In_Progress";

    try {
      const res = await fetch(`/api/task/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? "Failed to update status");
      }
      toast.success(
        `Task marked as ${nextStatus === "In_Progress" ? "in progress" : "pending"}`,
      );
      setCurrentStatus(nextStatus);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update task");
    } finally {
      setPending(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={pending}
      variant="outline"
      className={cn(
        "flex-1 font-semibold",
        isInProgress
          ? "border-border text-muted-foreground hover:bg-muted/40"
          : "border-blue-500/40 text-blue-500 hover:bg-blue-500/10",
      )}
    >
      {isInProgress ? (
        <Undo2 className="h-4 w-4 mr-2" />
      ) : (
        <PlayCircle className="h-4 w-4 mr-2" />
      )}
      {pending ? "Updating..." : isInProgress ? "Mark incomplete" : "Mark in progress"}
    </Button>
  );
}
