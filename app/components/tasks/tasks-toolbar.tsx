"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isPast, isToday } from "date-fns";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskCard } from "@/app/components/tasks/task-card";
import { TaskSelectionToolbar } from "@/app/components/tasks/task-selection-toolbar";
import type { Task } from "@/types";

type FilterTab = "all" | "Pending" | "In_Progress" | "Completed" | "Expired";
type SortKey = "priority" | "deadline" | "created";

// A task is expired/overdue once its deadline has passed and it isn't done.
// Overdue tasks are surfaced only under the Expired tab, not the active lists.
const isExpiredTask = (task: Task) => {
  if (task.status === "Completed") return false;
  const deadline = new Date(task.deadline);
  return isPast(deadline) && !isToday(deadline);
};

interface TasksToolbarProps {
  tasks: Task[];
  projectTasks: (Task & { projectName: string | null })[];
}

export function TasksToolbar({ tasks, projectTasks }: TasksToolbarProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [sort, setSort] = useState<SortKey>("priority");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = tasks.filter((t) => {
    switch (filter) {
      case "all":
        return !isExpiredTask(t);
      case "Completed":
        return t.status === "Completed";
      case "Expired":
        return isExpiredTask(t);
      default:
        // Pending / In_Progress — exclude overdue so they only show in Expired.
        return t.status === filter && !isExpiredTask(t);
    }
  });

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "priority") return b.priority - a.priority;
    if (sort === "deadline")
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  const toggleSelect = (taskId: number) => {
    setSelectedIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  };

  const selectVisible = () => {
    setSelectedIds(sorted.map((task) => task.id));
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  const markDoneSelected = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to mark the selected task(s) as done?",
    );
    if (!confirmed) return;

    try {
      const responses = await Promise.all(
        selectedIds.map((taskId) =>
          fetch(`/api/task/${taskId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "Completed" }),
          }),
        ),
      );

      if (!responses.every((res) => res.ok)) {
        toast.error("Some tasks could not be updated");
        return;
      }

      toast.success(
        `Marked ${selectedIds.length} task${selectedIds.length > 1 ? "s" : ""} complete`,
      );
      setSelectedIds([]);
      router.refresh();
    } catch {
      toast.error("Could not update tasks");
    }
  };

  const markInProgressSelected = async () => {
    try {
      const responses = await Promise.all(
        selectedIds.map((taskId) =>
          fetch(`/api/task/${taskId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "In_Progress" }),
          }),
        ),
      );

      if (!responses.every((res) => res.ok)) {
        toast.error("Some tasks could not be updated");
        return;
      }

      toast.success(
        `Marked ${selectedIds.length} task${selectedIds.length > 1 ? "s" : ""} in progress`,
      );
      setSelectedIds([]);
      router.refresh();
    } catch {
      toast.error("Could not update tasks");
    }
  };

  const deleteSelected = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to delete the selected task(s)?",
    );
    if (!confirmed) return;

    try {
      setIsDeleting(true);
      const responses = await Promise.all(
        selectedIds.map((taskId) =>
          fetch(`/api/task/${taskId}`, { method: "DELETE" }),
        ),
      );

      if (!responses.every((res) => res.ok)) {
        toast.error("Some tasks could not be deleted");
        return;
      }

      toast.success(
        `Deleted ${selectedIds.length} task${selectedIds.length > 1 ? "s" : ""}`,
      );
      setSelectedIds([]);
      router.refresh();
    } catch {
      toast.error("Could not delete tasks");
    } finally {
      setIsDeleting(false);
    }
  };

  const editSelected = () => {
    const taskId = selectedIds[0];
    if (taskId === undefined) return;
    router.push(`/tasks/${taskId}`);
  };

  // Only offer a status change when at least one selected task isn't already in
  // that state, so completed/in-progress selections don't get redundant actions.
  const selectedTasks = tasks.filter((t) => selectedIds.includes(t.id));
  const showMarkDone = selectedTasks.some((t) => t.status !== "Completed");
  const showMarkInProgress = selectedTasks.some(
    (t) => t.status !== "In_Progress",
  );

  return (
    <>
      <TaskSelectionToolbar
        selectedCount={selectedIds.length}
        allCount={sorted.length}
        isDeleting={isDeleting}
        canEdit={selectedIds.length === 1}
        showMarkInProgress={showMarkInProgress}
        showMarkDone={showMarkDone}
        onSelectAll={selectVisible}
        onDeselectAll={deselectAll}
        onEditSelected={editSelected}
        onMarkInProgress={markInProgressSelected}
        onMarkDone={markDoneSelected}
        onDeleteSelected={deleteSelected}
      />

      <div className="flex flex-col sm:flex-row gap-3 items-start sm:items-center">
        <Tabs
          value={filter}
          onValueChange={(v) => setFilter(v as FilterTab)}
          className="flex-1"
        >
          <TabsList className="bg-muted/50">
            <TabsTrigger value="all" className="font-mono text-xs">
              All
            </TabsTrigger>
            <TabsTrigger value="Pending" className="font-mono text-xs">
              Pending
            </TabsTrigger>
            <TabsTrigger value="In_Progress" className="font-mono text-xs">
              In Progress
            </TabsTrigger>
            <TabsTrigger value="Completed" className="font-mono text-xs">
              Completed
            </TabsTrigger>
            <TabsTrigger value="Expired" className="font-mono text-xs">
              Expired
            </TabsTrigger>
          </TabsList>
        </Tabs>

        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-auto min-w-[12rem] font-mono text-xs">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="priority">Priority (High → Low)</SelectItem>
            <SelectItem value="deadline">Deadline (Soonest)</SelectItem>
            <SelectItem value="created">Recently Added</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-2">
        {sorted.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-card/70 px-4 py-8 text-sm text-muted-foreground">
            No tasks found.
          </div>
        ) : (
          sorted.map((task) => (
            <TaskCard
              key={task.id}
              task={task}
              selected={selectedIds.includes(task.id)}
              onToggleSelect={() => toggleSelect(task.id)}
            />
          ))
        )}
      </div>
    </>
  );
}
