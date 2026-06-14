"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { PlayCircle } from "lucide-react";

interface TaskInProgressButtonProps {
  taskId: number;
}

export function TaskInProgressButton({ taskId }: TaskInProgressButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleClick = async () => {
    setPending(true);
    try {
      const res = await fetch(`/api/task/${taskId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "In_Progress" }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? "Failed to update status");
      }
      toast.success("Marked in progress");
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
      variant="outline"
      className="flex-1 border-blue-500/40 text-blue-500 hover:bg-blue-500/10 font-semibold"
    >
      <PlayCircle className="h-4 w-4 mr-2" />
      {pending ? "Updating..." : "Mark in progress"}
    </Button>
  );
}
