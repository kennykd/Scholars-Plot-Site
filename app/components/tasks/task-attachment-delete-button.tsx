"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X } from "lucide-react";

interface TaskAttachmentDeleteButtonProps {
  taskId: number;
  attachmentId: number;
  fileName: string;
}

export function TaskAttachmentDeleteButton({
  taskId,
  attachmentId,
  fileName,
}: TaskAttachmentDeleteButtonProps) {
  const router = useRouter();
  const [pending, setPending] = useState(false);

  const handleDelete = async () => {
    setPending(true);
    try {
      const res = await fetch(
        `/api/task/${taskId}/attachment/${attachmentId}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.message ?? "Delete failed");
      }
      toast.success(`Removed "${fileName}"`);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Could not remove file");
      setPending(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleDelete}
      disabled={pending}
      aria-label={`Delete ${fileName}`}
      className="text-muted-foreground hover:text-destructive transition-colors disabled:opacity-50"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
