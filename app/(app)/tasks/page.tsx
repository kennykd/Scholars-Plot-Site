import Link from "next/link";
import { redirect } from "next/navigation";
import { Button } from "@/components/ui/button";
import { TasksToolbar } from "@/app/components/tasks/tasks-toolbar";
import { getSession } from "@/lib/firebase/auth";
import { getTasks, serializeTask, getProjectTask } from "@/lib/services/taskService";
import { Plus } from "lucide-react";

export default async function TasksPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const [rows, projectRows] = await Promise.all([
    getTasks(session.id),
    getProjectTask(session.id),
  ]);

  const tasks = rows.map((row) => serializeTask(row));
  const projectTasks = projectRows.map((row) => ({
    ...serializeTask(row),
    projectName: row.project?.project_name ?? null,
  }));

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
            TASKS
          </h1>
          <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">
            {tasks.length + projectTasks.length} task{tasks.length + projectTasks.length !== 1 ? "s" : ""}
          </p>
        </div>
        <Button asChild className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold">
          <Link href="/tasks/new">
            <Plus className="h-4 w-4 mr-1" /> New Task
          </Link>
        </Button>
      </div>

      <TasksToolbar tasks={tasks} projectTasks={projectTasks} />
    </div>
  );
}