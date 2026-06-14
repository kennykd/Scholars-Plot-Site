"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2, Undo2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface TaskCompleteButtonProps {
  taskId: number;
  initialStatus?: string;
}

export function TaskCompleteButton({ taskId, initialStatus }: TaskCompleteButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [currentStatus, setCurrentStatus] = useState(initialStatus ?? "Pending");

  // Keep local state synced when server component data updates
  useEffect(() => {
    if (initialStatus) {
      setCurrentStatus(initialStatus);
    }
  }, [initialStatus]);

  const isCompleted = currentStatus === "Completed";

  const handleClick = async () => {
    setPending(true);
    const nextStatus = isCompleted ? "Pending" : "Completed";

    try {
      const res = await fetch(`/api/task/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: nextStatus }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? `Failed to mark ${nextStatus.toLowerCase()}`);
      }

      toast.success(`Task marked as ${nextStatus.toLowerCase()}`);
      setCurrentStatus(nextStatus);

      // Forces nextjs server component to refetch fresh database metrics
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
      className={cn(
        "flex-1 font-semibold transition-colors",
        isCompleted
          ? "bg-muted hover:bg-muted/80 text-muted-foreground border border-border"
          : "bg-green-600 hover:bg-green-600/90 text-white"
      )}
    >
      {isCompleted ? <Undo2 className="h-4 w-4 mr-2" /> : <CheckCircle2 className="h-4 w-4 mr-2" />}
      {pending ? "Updating..." : isCompleted ? "Mark incomplete" : "Mark complete"}
    </Button>
  );
}