import type { Task } from "@/types";

/** Badge background/text colours per task status. */
export const taskStatusColors: Record<Task["status"], string> = {
  Pending: "bg-muted text-muted-foreground",
  In_Progress: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  Completed: "bg-green-500/20 text-green-400 border-green-500/30",
};

/** Human-readable, uppercase labels per task status. */
export const taskStatusLabels: Record<Task["status"], string> = {
  Pending: "PENDING",
  In_Progress: "IN PROGRESS",
  Completed: "COMPLETED",
};
