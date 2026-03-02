"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TaskCard } from "@/app/components/tasks/task-card";
import { mockTasks } from "@/lib/mock-data";
import { Task } from "@/lib/types";
import { Plus } from "lucide-react";

type FilterTab = "all" | "todo" | "in-progress" | "done";
type SortKey = "priority" | "deadline" | "created";

export default function TasksPage() {
  const [filter, setFilter] = useState<FilterTab>("all");
  const [sort, setSort] = useState<SortKey>("priority");

  const filtered = mockTasks.filter((t) => {
    if (filter === "all") return true;
    if (filter === "todo") return t.status === "todo";
    if (filter === "in-progress") return t.status === "in-progress";
    if (filter === "done") return t.status === "done";
    return true;
  });

  const sorted = [...filtered].sort((a: Task, b: Task) => {
    if (sort === "priority") return b.priority - a.priority;
    if (sort === "deadline") return a.deadline.getTime() - b.deadline.getTime();
    return b.createdAt.getTime() - a.createdAt.getTime();
  });

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            TASKS
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">
            {filtered.length} task{filtered.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button
          asChild
          className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold"
        >
          <Link href="/tasks/new">
            <Plus className="h-4 w-4 mr-1" /> New Task
          </Link>
        </Button>
      </div>

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
            <TabsTrigger value="todo" className="font-mono text-xs">
              To Do
            </TabsTrigger>
            <TabsTrigger value="in-progress" className="font-mono text-xs">
              In Progress
            </TabsTrigger>
            <TabsTrigger value="done" className="font-mono text-xs">
              Done
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
    </div>
  );
}
