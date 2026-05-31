"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { CheckCircle2 } from "lucide-react";

interface TaskCompleteButtonProps {
  taskId: number;
}

export function TaskCompleteButton({ taskId }: TaskCompleteButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    setPending(true);
    try {
      const res = await fetch(`/api/task/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "Completed" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? "Failed to mark complete");
      }
      toast.success("Task marked complete");
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not update task");
      setPending(false);
    }
  };

  return (
    <Button
      onClick={handleClick}
      disabled={pending}
      className="flex-1 bg-green-600 hover:bg-green-600/90 text-white font-semibold"
    >
      <CheckCircle2 className="h-4 w-4 mr-2" />
      {pending ? "Marking..." : "Mark complete"}
    </Button>
  );
}
