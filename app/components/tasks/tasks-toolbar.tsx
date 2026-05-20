"use client";

import { useState } from "react";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskCard } from "@/app/components/tasks/task-card";
import type { Task } from "@/types";

type FilterTab = "all" | "Pending" | "In_Progress" | "Completed";
type SortKey = "priority" | "deadline" | "created";

interface TasksToolbarProps {
  tasks: Task[];
}

export function TasksToolbar({ tasks }: TasksToolbarProps) {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [sort, setSort] = useState<SortKey>("priority");

  const filtered = tasks.filter((t) =>
    filter === "all" ? true : t.status === filter,
  );

  const sorted = [...filtered].sort((a, b) => {
    if (sort === "priority") return b.priority - a.priority;
    if (sort === "deadline")
      return new Date(a.deadline).getTime() - new Date(b.deadline).getTime();
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
  });

  return (
    <>
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
          <SelectTrigger className="w-44 font-mono text-xs">
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
          <div className="text-center py-16 text-muted-foreground">
            <p className="font-mono text-sm">No tasks found.</p>
          </div>
        ) : (
          sorted.map((task) => <TaskCard key={task.id} task={task} />)
        )}
      </div>
    </>
  );
}
