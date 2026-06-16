"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { isPast, isToday } from "date-fns";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskCard } from "@/app/components/tasks/task-card";
import { TaskSelectionToolbar } from "@/app/components/tasks/task-selection-toolbar";
import { cn } from "@/lib/utils";
import type { Task } from "@/types";

type TaskSectionKey = Task["status"] | "Expired";
type SortKey = "priority" | "deadline" | "created";

type TaskRow = {
  task: Task;
  source: "personal" | "project";
  projectName?: string | null;
};

const TASK_SECTIONS: Array<{
  key: TaskSectionKey;
  label: string;
  dotClassName: string;
}> = [
  {
    key: "Pending",
    label: "Pending",
    dotClassName: "bg-muted-foreground",
  },
  {
    key: "In_Progress",
    label: "In Progress",
    dotClassName: "bg-blue-500",
  },
  {
    key: "Completed",
    label: "Completed",
    dotClassName: "bg-green-500",
  },
  {
    key: "Expired",
    label: "Expired",
    dotClassName: "bg-red-500",
  },
];

const DEFAULT_VISIBLE_SECTIONS = TASK_SECTIONS.map((section) => section.key);

// A task is expired/overdue once its deadline has passed and it isn't done.
// Overdue tasks are surfaced only under the Expired group, not active lists.
const isExpiredTask = (task: Task) => {
  if (task.status === "Completed") return false;
  const deadline = new Date(task.deadline);
  return isPast(deadline) && !isToday(deadline);
};

interface TasksToolbarProps {
  tasks: Task[];
  projectTasks: (Task & { projectName: string | null })[];
}

const getTaskSectionKey = (task: Task): TaskSectionKey => {
  if (isExpiredTask(task)) return "Expired";
  return task.status;
};

const sortRows = (rows: TaskRow[], sort: SortKey) => {
  return [...rows].sort((a, b) => {
    if (sort === "priority") return b.task.priority - a.task.priority;
    if (sort === "deadline") {
      return (
        new Date(a.task.deadline).getTime() -
        new Date(b.task.deadline).getTime()
      );
    }

    return (
      new Date(b.task.createdAt).getTime() -
      new Date(a.task.createdAt).getTime()
    );
  });
};

const getTaskEndpoint = (row: TaskRow) =>
  row.source === "project"
    ? `/api/project/task/${row.task.id}`
    : `/api/task/${row.task.id}`;

export function TasksToolbar({ tasks, projectTasks }: TasksToolbarProps) {
  const router = useRouter();
  const [visibleSections, setVisibleSections] = useState<TaskSectionKey[]>(
    DEFAULT_VISIBLE_SECTIONS,
  );
  const [sort, setSort] = useState<SortKey>("priority");
  const [selectedIds, setSelectedIds] = useState<number[]>([]);
  const [isDeleting, setIsDeleting] = useState(false);

  const allRows: TaskRow[] = [
    ...tasks.map((task) => ({ task, source: "personal" as const })),
    ...projectTasks.map((task) => ({
      task,
      source: "project" as const,
      projectName: task.projectName,
    })),
  ];

  const sectionCounts = TASK_SECTIONS.reduce<Record<TaskSectionKey, number>>(
    (acc, section) => {
      acc[section.key] = allRows.filter(
        (row) => getTaskSectionKey(row.task) === section.key,
      ).length;
      return acc;
    },
    {
      Pending: 0,
      In_Progress: 0,
      Completed: 0,
      Expired: 0,
    },
  );

  const groupedRows = TASK_SECTIONS.map((section) => ({
    ...section,
    rows: sortRows(
      allRows.filter((row) => getTaskSectionKey(row.task) === section.key),
      sort,
    ),
  }));

  const visibleGroups = groupedRows.filter(
    (group) => visibleSections.includes(group.key) && group.rows.length > 0,
  );
  const visibleRows = visibleGroups.flatMap((group) => group.rows);
  const selectedRows = allRows.filter((row) =>
    selectedIds.includes(row.task.id),
  );

  const toggleSelect = (taskId: number) => {
    setSelectedIds((prev) =>
      prev.includes(taskId)
        ? prev.filter((id) => id !== taskId)
        : [...prev, taskId],
    );
  };

  const selectVisible = () => {
    setSelectedIds(visibleRows.map((row) => row.task.id));
  };

  const deselectAll = () => {
    setSelectedIds([]);
  };

  const toggleSection = (sectionKey: TaskSectionKey) => {
    setVisibleSections((current) =>
      current.includes(sectionKey)
        ? current.filter((key) => key !== sectionKey)
        : [...current, sectionKey],
    );
  };

  const markDoneSelected = async () => {
    const confirmed = window.confirm(
      "Are you sure you want to mark the selected task(s) as done?",
    );
    if (!confirmed) return;

    try {
      const responses = await Promise.all(
        selectedRows.map((row) =>
          fetch(getTaskEndpoint(row), {
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
        selectedRows.map((row) =>
          fetch(getTaskEndpoint(row), {
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
        selectedRows.map((row) =>
          fetch(getTaskEndpoint(row), { method: "DELETE" }),
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

    const row = allRows.find((candidate) => candidate.task.id === taskId);
    if (!row) return;

    if (row.source === "project") {
      const projectId = row.task.projectId
        ? `?projectId=project-${row.task.projectId}`
        : "";
      router.push(`/projects${projectId}`);
      return;
    }

    router.push(`/tasks/${taskId}`);
  };

  // Only offer a status change when at least one selected task isn't already in
  // that state, so completed/in-progress selections don't get redundant actions.
  const showMarkDone = selectedRows.some(
    (row) => row.task.status !== "Completed",
  );
  const showMarkInProgress = selectedRows.some(
    (row) => row.task.status !== "In_Progress",
  );

  return (
    <>
      <TaskSelectionToolbar
        selectedCount={selectedIds.length}
        allCount={visibleRows.length}
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
        <div
          aria-label="Task status filters"
          className="flex flex-1 flex-wrap gap-2"
        >
          {TASK_SECTIONS.map((section) => {
            const active = visibleSections.includes(section.key);

            return (
              <Button
                key={section.key}
                type="button"
                size="sm"
                variant={active ? "default" : "outline"}
                aria-pressed={active}
                onClick={() => toggleSection(section.key)}
                className={cn(
                  "gap-2 font-mono text-xs",
                  active
                    ? "shadow-sm"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  aria-hidden="true"
                  className={cn("h-2 w-2 rounded-full", section.dotClassName)}
                />
                {section.label}
                <span className="rounded-full bg-background/60 px-1.5 py-0.5 text-[10px] text-foreground">
                  {sectionCounts[section.key]}
                </span>
              </Button>
            );
          })}
        </div>

        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-auto min-w-[12rem] font-mono text-xs">
            <SelectValue placeholder="Sort by" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="priority">Priority (High to Low)</SelectItem>
            <SelectItem value="deadline">Deadline (Soonest)</SelectItem>
            <SelectItem value="created">Recently Added</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="space-y-4">
        {visibleRows.length === 0 ? (
          <div className="rounded-lg border border-dashed border-border/70 bg-card/70 px-4 py-8 text-sm text-muted-foreground">
            No tasks found.
          </div>
        ) : (
          visibleGroups.map((group) => (
            <section key={group.key} className="space-y-2">
              <div className="flex items-center gap-2 px-1">
                <span
                  aria-hidden="true"
                  className={cn("h-2 w-2 rounded-full", group.dotClassName)}
                />
                <h2 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  {group.label}
                </h2>
                <Badge variant="secondary" className="font-mono text-[10px]">
                  {group.rows.length}
                </Badge>
              </div>
              <div className="space-y-2">
                {group.rows.map((row) => (
                  <TaskCard
                    key={row.task.id}
                    task={row.task}
                    selected={selectedIds.includes(row.task.id)}
                    onToggleSelect={() => toggleSelect(row.task.id)}
                    isProjectTask={row.source === "project"}
                    projectName={row.projectName}
                    href={
                      row.source === "project"
                        ? `/projects${
                            row.task.projectId
                              ? `?projectId=project-${row.task.projectId}`
                              : ""
                          }`
                        : `/tasks/${row.task.id}`
                    }
                  />
                ))}
              </div>
            </section>
          ))
        )}
      </div>
    </>
  );
}
