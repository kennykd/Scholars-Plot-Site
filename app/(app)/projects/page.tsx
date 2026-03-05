"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

import { StarRating } from "@/app/components/common/star-rating";
import { mockProjects } from "@/lib/mock-data";
import {
  Project,
  ProjectMember,
  ProjectRole,
  ProjectTask,
  ProjectTaskPriority,
  ProjectTaskStatus,
} from "@/lib/types";
import { cn } from "@/lib/utils";

import {
  Crown,
  Paperclip,
  Plus,
  Settings,
  ShieldCheck,
  UserPlus,
  Users,
  X,
} from "lucide-react";
import { toast } from "sonner";

type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

type StoredProjectTask = Omit<ProjectTask, "createdAt"> & {
  createdAt: string;
};

type StoredProject = Omit<Project, "createdAt" | "tasks"> & {
  createdAt: string;
  tasks: StoredProjectTask[];
};

const STORAGE_KEY = "scholarsPlot.projects";

const STATUS_ORDER: ProjectTaskStatus[] = ["not-done", "pending", "done"];

const STATUS_META: Array<{
  key: ProjectTaskStatus;
  label: string;
  helper: string;
}> = [
  {
    key: "not-done",
    label: "Not Done",
    helper: "Backlog and newly created tasks.",
  },
  {
    key: "pending",
    label: "Pending",
    helper: "In progress or awaiting review.",
  },
  {
    key: "done",
    label: "Done",
    helper: "Completed tasks ready to archive.",
  },
];

const PRIORITY_STYLES: Record<ProjectTaskPriority, string> = {
  low: "bg-muted text-muted-foreground border-border",
  medium: "bg-amber-500/15 text-amber-400 border-amber-500/30",
  high: "bg-red-500/15 text-red-400 border-red-500/30",
};

const ROLE_STYLES: Record<ProjectRole, string> = {
  owner: "bg-accent/15 text-accent border-accent/30",
  moderator: "bg-blue-500/15 text-blue-400 border-blue-500/30",
  member: "bg-muted text-muted-foreground border-border",
};

const toStoredProjects = (projects: Project[]): StoredProject[] =>
  projects.map((project) => ({
    ...project,
    createdAt: project.createdAt.toISOString(),
    tasks: project.tasks.map((task) => ({
      ...task,
      createdAt: task.createdAt.toISOString(),
    })),
  }));

const createMemberFromUser = (
  user: CurrentUser,
  role: ProjectRole,
): ProjectMember => {
  const displayName = user.name ?? user.email.split("@")[0] ?? "User";
  return {
    id: user.id,
    name: displayName,
    handle: user.email,
    role,
  };
};

const priorityFromRating = (value: number): ProjectTaskPriority => {
  if (value >= 4) return "high";
  if (value >= 2.5) return "medium";
  return "low";
};

export default function ProjectsPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);

  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");

  const [inviteHandle, setInviteHandle] = useState("");
  const [inviteRole, setInviteRole] = useState<ProjectRole>("member");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriorityRating, setTaskPriorityRating] = useState(3);
  const [taskReminder, setTaskReminder] = useState("none");
  const [taskAttachment, setTaskAttachment] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/users/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((user) => {
        if (user) {
          setCurrentUser({
            id: user.id,
            email: user.email,
            name: user.name ?? null,
            image: user.image ?? null,
          });
        }
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const stored =
      typeof window !== "undefined" ? localStorage.getItem(STORAGE_KEY) : null;

    if (stored) {
      try {
        const parsed = JSON.parse(stored) as StoredProject[];
        setProjects(parsed);
        setActiveProjectId(parsed[0]?.id ?? null);
      } catch {
        const seeded = toStoredProjects(mockProjects);
        setProjects(seeded);
        setActiveProjectId(seeded[0]?.id ?? null);
      }
    } else {
      const seeded = toStoredProjects(mockProjects);
      setProjects(seeded);
      setActiveProjectId(seeded[0]?.id ?? null);
    }
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (!hydrated) return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(projects));
  }, [hydrated, projects]);

  const activeProject = useMemo(
    () => projects.find((project) => project.id === activeProjectId) ?? null,
    [projects, activeProjectId],
  );

  const currentMember = useMemo(() => {
    if (!activeProject || !currentUser) return null;
    return (
      activeProject.members.find(
        (member) =>
          member.id === currentUser.id ||
          (member.handle &&
            member.handle.toLowerCase() === currentUser.email.toLowerCase()),
      ) ?? null
    );
  }, [activeProject, currentUser]);

  const isOwnerOrModerator =
    currentMember?.role === "owner" || currentMember?.role === "moderator";
  const isOwner = currentMember?.role === "owner";

  const updateProject = (
    projectId: string,
    updater: (project: StoredProject) => StoredProject,
  ) => {
    setProjects((prev) =>
      prev.map((project) =>
        project.id === projectId ? updater(project) : project,
      ),
    );
  };

  const handleCreateProject = () => {
    if (!newProjectName.trim() || !currentUser) return;
    const newProject: StoredProject = {
      id: `project-${Date.now()}`,
      name: newProjectName.trim(),
      description: newProjectDescription.trim() || undefined,
      ownerId: currentUser.id,
      members: [createMemberFromUser(currentUser, "owner")],
      tasks: [],
      createdAt: new Date().toISOString(),
    };

    setProjects((prev) => [newProject, ...prev]);
    setActiveProjectId(newProject.id);
    setNewProjectName("");
    setNewProjectDescription("");
    setCreateProjectOpen(false);
  };

  const handleJoinProject = () => {
    if (!activeProject || !currentUser) return;
    updateProject(activeProject.id, (project) => {
      const alreadyMember = project.members.some(
        (member) =>
          member.id === currentUser.id ||
          (member.handle &&
            member.handle.toLowerCase() === currentUser.email.toLowerCase()),
      );
      if (alreadyMember) return project;
      return {
        ...project,
        members: [
          ...project.members,
          createMemberFromUser(currentUser, "member"),
        ],
      };
    });
  };

  const handleInviteMember = () => {
    if (!activeProject || !inviteHandle.trim()) return;
    updateProject(activeProject.id, (project) => ({
      ...project,
      members: [
        ...project.members,
        {
          id: `member-${Date.now()}`,
          name: inviteHandle.trim(),
          handle: inviteHandle.trim(),
          role: inviteRole,
        },
      ],
    }));
    setInviteHandle("");
    setInviteRole("member");
  };

  const handleTaskDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) setTaskAttachment(file.name);
  };

  const handleTaskFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) setTaskAttachment(file.name);
  };

  const handleCreateTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    if (!taskTitle.trim()) {
      toast.error("Task name is required");
      return;
    }
    const priority = priorityFromRating(taskPriorityRating);
    const attachments = taskAttachment ? [taskAttachment] : [];

    updateProject(activeProject.id, (project) => ({
      ...project,
      tasks: [
        {
          id: `proj-task-${Date.now()}`,
          title: taskTitle.trim(),
          description: taskDescription.trim() || undefined,
          attachments,
          reminder: taskReminder as ProjectTask["reminder"],
          priority,
          status: "not-done",
          createdAt: new Date().toISOString(),
        },
        ...project.tasks,
      ],
    }));

    setTaskTitle("");
    setTaskDescription("");
    setTaskPriorityRating(3);
    setTaskReminder("none");
    setTaskAttachment(null);
    setCreateTaskOpen(false);
  };

  const assignTask = (taskId: string, memberId?: string) => {
    if (!activeProject) return;
    updateProject(activeProject.id, (project) => ({
      ...project,
      tasks: project.tasks.map((task) =>
        task.id === taskId ? { ...task, assignedTo: memberId } : task,
      ),
    }));
  };

  const claimTask = (taskId: string) => {
    if (!activeProject || !currentMember) return;
    assignTask(taskId, currentMember.id);
  };

  const moveTask = (taskId: string, direction: "next" | "prev") => {
    if (!activeProject) return;
    updateProject(activeProject.id, (project) => ({
      ...project,
      tasks: project.tasks.map((task) => {
        if (task.id !== taskId) return task;
        const currentIndex = STATUS_ORDER.indexOf(task.status);
        const nextIndex =
          direction === "next" ? currentIndex + 1 : currentIndex - 1;
        const nextStatus = STATUS_ORDER[nextIndex] ?? task.status;
        return { ...task, status: nextStatus };
      }),
    }));
  };

  const tasksByStatus = useMemo(() => {
    if (!activeProject) return null;
    return STATUS_META.reduce<Record<ProjectTaskStatus, StoredProjectTask[]>>(
      (acc, column) => {
        acc[column.key] = activeProject.tasks.filter(
          (task) => task.status === column.key,
        );
        return acc;
      },
      {
        "not-done": [],
        pending: [],
        done: [],
      },
    );
  }, [activeProject]);

  const projectSelectValue = activeProject?.id ?? "";

  return (
    <div className="p-6 space-y-6">
      <div>
        <h1 className="font-display text-3xl font-extrabold tracking-tight text-foreground">
          PROJECTS
        </h1>
        <p className="font-mono text-xs text-muted-foreground mt-1 tracking-widest">
          COLLABORATION HUB
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
        <div className="flex flex-wrap items-center gap-3">
          <Select
            value={projectSelectValue}
            onValueChange={(value) => {
              if (value === "__new_project__") {
                setCreateProjectOpen(true);
              } else {
                setActiveProjectId(value);
              }
            }}
          >
            <SelectTrigger className="min-w-[220px] font-mono text-xs">
              <SelectValue
                placeholder={
                  projects.length ? "Select project" : "No projects yet"
                }
              />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
              <SelectItem
                value="__new_project__"
                className="font-mono text-xs text-accent"
              >
                <span className="flex items-center gap-1">
                  <Plus className="h-3 w-3" />
                  New Project
                </span>
              </SelectItem>
            </SelectContent>
          </Select>

          <Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
                <DialogDescription>
                  Create a new collaboration space and invite teammates.
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <Input
                  placeholder="Project name"
                  value={newProjectName}
                  onChange={(e) => setNewProjectName(e.target.value)}
                />
                <Textarea
                  placeholder="Optional description"
                  value={newProjectDescription}
                  onChange={(e) => setNewProjectDescription(e.target.value)}
                  className="min-h-[90px]"
                />
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button
                  className="bg-accent hover:bg-accent/90 text-accent-foreground"
                  onClick={handleCreateProject}
                >
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {activeProject && (
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" />
                  Project Settings
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Project Settings</DialogTitle>
                  <DialogDescription>
                    Manage members and access for this project.
                  </DialogDescription>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {activeProject.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {activeProject.description ?? "No description provided."}
                    </p>
                  </div>

                  <div className="space-y-2">
                    <p className="text-xs font-mono text-muted-foreground tracking-wider">
                      MEMBERS
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {activeProject.members.map((member) => (
                        <Badge
                          key={member.id}
                          variant="outline"
                          className={cn(
                            "text-xs font-mono",
                            ROLE_STYLES[member.role],
                          )}
                        >
                          {member.role === "owner" && (
                            <Crown className="h-3 w-3 mr-1" />
                          )}
                          {member.role === "moderator" && (
                            <ShieldCheck className="h-3 w-3 mr-1" />
                          )}
                          {member.name}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  {isOwner && (
                    <div className="space-y-3">
                      <p className="text-xs font-mono text-muted-foreground tracking-wider">
                        INVITE MEMBERS
                      </p>
                      <Input
                        placeholder="Email or username"
                        value={inviteHandle}
                        onChange={(e) => setInviteHandle(e.target.value)}
                      />
                      <Select
                        value={inviteRole}
                        onValueChange={(value) =>
                          setInviteRole(value as ProjectRole)
                        }
                      >
                        <SelectTrigger className="font-mono text-xs">
                          <SelectValue placeholder="Role" />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="member">Member</SelectItem>
                          <SelectItem value="moderator">Moderator</SelectItem>
                        </SelectContent>
                      </Select>
                      <Button
                        onClick={handleInviteMember}
                        className="bg-accent hover:bg-accent/90 text-accent-foreground"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Send Invite
                      </Button>
                    </div>
                  )}
                </div>
                <DialogFooter showCloseButton />
              </DialogContent>
            </Dialog>
          )}

          {activeProject && isOwnerOrModerator && (
            <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
              <DialogTrigger asChild>
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Plus className="h-4 w-4 mr-2" />
                  New Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Task</DialogTitle>
                  <DialogDescription>
                    Add a task to the selected project.
                  </DialogDescription>
                </DialogHeader>
                <form onSubmit={handleCreateTask} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label className="font-mono text-xs tracking-wider">
                      TASK NAME *
                    </Label>
                    <Input
                      placeholder="e.g. Finalize onboarding docs"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-mono text-xs tracking-wider">
                      DESCRIPTION
                    </Label>
                    <Textarea
                      placeholder="Optional task description..."
                      value={taskDescription}
                      onChange={(e) => setTaskDescription(e.target.value)}
                      className="resize-y min-h-[80px]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-mono text-xs tracking-wider">
                      ATTACHMENT
                    </Label>
                    {taskAttachment ? (
                      <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm flex-1 truncate">
                          {taskAttachment}
                        </span>
                        <button
                          type="button"
                          onClick={() => setTaskAttachment(null)}
                        >
                          <X className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                        </button>
                      </div>
                    ) : (
                      <label
                        className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed border-border/50 bg-muted/20 px-4 py-6 cursor-pointer hover:border-accent/50 transition-colors"
                        onDragOver={(e) => e.preventDefault()}
                        onDrop={handleTaskDrop}
                      >
                        <Paperclip className="h-6 w-6 text-muted-foreground" />
                        <span className="font-mono text-xs text-muted-foreground">
                          Drop file here or click to browse
                        </span>
                        <input
                          type="file"
                          className="hidden"
                          onChange={handleTaskFileSelect}
                        />
                      </label>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-mono text-xs tracking-wider">
                      PRIORITY
                    </Label>
                    <div className="flex items-center gap-3">
                      <StarRating
                        value={taskPriorityRating}
                        onChange={setTaskPriorityRating}
                        size="lg"
                      />
                      <span className="font-mono text-sm text-muted-foreground">
                        {taskPriorityRating.toFixed(1)} / 5.0
                      </span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-mono text-xs tracking-wider">
                      REMINDER
                    </Label>
                    <Select
                      value={taskReminder}
                      onValueChange={setTaskReminder}
                    >
                      <SelectTrigger className="font-mono text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="every-3-days">
                          Every 3 Days
                        </SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <DialogFooter>
                    <DialogClose asChild>
                      <Button variant="outline">Cancel</Button>
                    </DialogClose>
                    <Button
                      type="submit"
                      className="bg-accent hover:bg-accent/90 text-accent-foreground"
                    >
                      Create Task
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {activeProject && (
            <>
              <div className="flex items-center gap-1 text-muted-foreground">
                <Users className="h-4 w-4" />
                {activeProject.members.length} member
                {activeProject.members.length !== 1 ? "s" : ""}
              </div>
              {currentMember ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "text-[10px] font-mono",
                    ROLE_STYLES[currentMember.role],
                  )}
                >
                  {currentMember.role.toUpperCase()}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] font-mono">
                  Not a member
                </Badge>
              )}
            </>
          )}
          {activeProject && !currentMember && (
            <Button
              size="sm"
              className="bg-accent hover:bg-accent/90 text-accent-foreground"
              onClick={handleJoinProject}
            >
              Join Project
            </Button>
          )}
        </div>
      </div>

      {!activeProject ? (
        <div className="rounded-xl border border-border/50 bg-muted/10 p-10 text-center text-muted-foreground">
          Create or select a project to view tasks.
        </div>
      ) : (
        tasksByStatus && (
          <div className="grid gap-4 lg:grid-cols-3">
            {STATUS_META.map((column) => (
              <section
                key={column.key}
                className="rounded-xl border border-border/50 bg-card/40"
              >
                <div className="px-4 py-3 border-b border-border/40">
                  <h3 className="font-display text-base font-bold tracking-wide">
                    {column.label}
                  </h3>
                  <p className="text-xs text-muted-foreground">
                    {column.helper}
                  </p>
                </div>
                <div className="px-4 py-2">
                  {tasksByStatus[column.key].length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">
                      No tasks in this column.
                    </p>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {tasksByStatus[column.key].map((task) => {
                        const assignedMember = activeProject.members.find(
                          (member) => member.id === task.assignedTo,
                        );
                        const isAssignedToCurrent =
                          currentMember && task.assignedTo === currentMember.id;
                        const isAssignedElsewhere =
                          task.assignedTo &&
                          (!currentMember ||
                            task.assignedTo !== currentMember.id);
                        const canMove = Boolean(isAssignedToCurrent);
                        const dimTask =
                          isAssignedElsewhere && task.status !== "done";

                        const currentIndex = STATUS_ORDER.indexOf(task.status);
                        const prevStatus =
                          STATUS_ORDER[currentIndex - 1] ?? null;
                        const nextStatus =
                          STATUS_ORDER[currentIndex + 1] ?? null;

                        return (
                          <div
                            key={task.id}
                            className={cn(
                              "py-3 space-y-2",
                              dimTask && "opacity-60",
                            )}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-medium text-foreground">
                                  {task.title}
                                </p>
                                {task.description && (
                                  <p className="text-xs text-muted-foreground">
                                    {task.description}
                                  </p>
                                )}
                              </div>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "text-[10px] font-mono",
                                  PRIORITY_STYLES[task.priority],
                                )}
                              >
                                {task.priority.toUpperCase()}
                              </Badge>
                            </div>

                            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground font-mono">
                              <span>
                                {assignedMember
                                  ? `Assigned: ${assignedMember.name}`
                                  : "Unassigned"}
                              </span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {isOwnerOrModerator && (
                                <Select
                                  value={task.assignedTo ?? "unassigned"}
                                  onValueChange={(value) =>
                                    assignTask(
                                      task.id,
                                      value === "unassigned"
                                        ? undefined
                                        : value,
                                    )
                                  }
                                >
                                  <SelectTrigger className="h-8 text-xs font-mono">
                                    <SelectValue placeholder="Assign" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unassigned">
                                      Unassigned
                                    </SelectItem>
                                    {activeProject.members.map((member) => (
                                      <SelectItem
                                        key={member.id}
                                        value={member.id}
                                      >
                                        {member.name} ({member.role})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}

                              {!isOwnerOrModerator &&
                                !task.assignedTo &&
                                currentMember && (
                                  <Button
                                    size="sm"
                                    variant="outline"
                                    className="text-xs"
                                    onClick={() => claimTask(task.id)}
                                  >
                                    Claim Task
                                  </Button>
                                )}

                              {prevStatus && (
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="text-xs"
                                  onClick={() => moveTask(task.id, "prev")}
                                  disabled={!canMove}
                                >
                                  Move Back
                                </Button>
                              )}
                              {nextStatus && (
                                <Button
                                  size="sm"
                                  className="text-xs bg-accent hover:bg-accent/90 text-accent-foreground"
                                  onClick={() => moveTask(task.id, "next")}
                                  disabled={!canMove}
                                >
                                  Move Forward
                                </Button>
                              )}
                            </div>

                            {!canMove && task.assignedTo && (
                              <p className="text-[10px] text-muted-foreground font-mono">
                                Only the assigned member can move this task.
                              </p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </section>
            ))}
          </div>
        )
      )}
    </div>
  );
}
