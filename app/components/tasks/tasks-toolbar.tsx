"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
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

type FilterTab = "all" | "Pending" | "In_Progress" | "Completed";
type SortKey = "priority" | "deadline" | "created";

interface TasksToolbarProps {
  tasks: Task[];
}

export function TasksToolbar({ tasks }: TasksToolbarProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<FilterTab>("all");
  const [sort, setSort] = useState<SortKey>("priority");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const filtered = tasks.filter((t) =>
    filter === "all" ? true : t.status === filter,
  );

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

  return (
    <>
      <TaskSelectionToolbar
        selectedCount={selectedIds.length}
        allCount={sorted.length}
        isDeleting={isDeleting}
        canEdit={selectedIds.length === 1}
        onSelectAll={selectVisible}
        onDeselectAll={deselectAll}
        onEditSelected={editSelected}
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
