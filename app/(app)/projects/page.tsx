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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

import { StarRating } from "@/app/components/common/star-rating";
import { AiSuggestionsButton } from "@/app/components/common/ai-suggestions-button";
import {
  ProjectMember,
  ProjectRole,
  ProjectTaskStatus,
} from "@/types";
import { cn } from "@/lib/utils";
import { AI_READABLE_ATTACHMENT_HELPER_TEXT } from "@/lib/ai/attachmentSupport";
import {
  fetchProjects,
  createProjectApi,
  addProjectMemberApi,
  createProjectTaskApi,
  updateProjectTaskApi,
  deleteProjectApi,
  type StoredProject,
  type StoredProjectTask,
} from "@/app/api/project/client";

import {
  Paperclip,
  Plus,
  Settings,
  Trash2,
  X,
} from "lucide-react";
import { toast } from "sonner";

type CurrentUser = {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
};

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

const PRIORITY_STYLES: Record<number, string> = {
  1: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  2: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900/30 dark:text-yellow-400",
  3: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
};

const ROLE_STYLES: Record<ProjectRole, string> = {
  owner: "bg-accent/15 text-accent border-accent/30",
  collaborator: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
};

const MAX_TASK_ATTACHMENT_BYTES = 10 * 1024 * 1024;

type TaskDraftPreview = {
  draft: {
    title: string;
    description: string;
    priority: number;
    reasoning?: string;
    skippedAttachments?: {
      fileName: string;
      fileType: string;
      reason: string;
    }[];
  };
  attachmentIds: number[];
};

const createMemberFromUser = (user: CurrentUser, role: ProjectRole): ProjectMember => {
  const displayName = user.name ?? user.email.split("@")[0] ?? "User";
  return {
    id: user.id,
    name: displayName,
    email: user.email,
    role,
  };
};

export default function ProjectsPage() {
  const [currentUser, setCurrentUser] = useState<CurrentUser | null>(null);
  const [projects, setProjects] = useState<StoredProject[]>([]);
  const [activeProjectId, setActiveProjectId] = useState<string | null>(null);

  const [createProjectOpen, setCreateProjectOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [deletingProject, setDeletingProject] = useState(false);

  const [newProjectName, setNewProjectName] = useState("");
  const [newProjectDescription, setNewProjectDescription] = useState("");
  const [newProjectDeadline, setNewProjectDeadline] = useState<string | null>(null);
  const [newProjectPriorityRating, setNewProjectPriorityRating] = useState<number>(2.5);
  const [newProjectStatus, setNewProjectStatus] = useState<"active" | "completed" | "archived">("active");

  const [taskTitle, setTaskTitle] = useState("");
  const [taskDescription, setTaskDescription] = useState("");
  const [taskPriorityRating, setTaskPriorityRating] = useState(2.5);
  const [taskReminder, setTaskReminder] = useState("none");
  const [taskAttachment, setTaskAttachment] = useState<File | null>(null);
  const [taskDraftPreview, setTaskDraftPreview] = useState<TaskDraftPreview | null>(null);
  const [taskDraftAttachmentIds, setTaskDraftAttachmentIds] = useState<number[]>([]);
  const [taskDraftLoading, setTaskDraftLoading] = useState(false);

  const [inviteMemberQuery, setInviteMemberQuery] = useState("");
  const [invitingMemberId, setInvitingMemberId] = useState<string | null>(null);
  const [allUsers, setAllUsers] = useState<{ id: string; name: string | null; email: string }[]>([]);

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
      .catch(() => { });
  }, []);

  useEffect(() => {
    let isMounted = true;

    const loadProjects = async () => {
      try {
        console.log("=== DEBUG 1: Triggering fetchProjects ===");
        const fetchedProjects = await fetchProjects();
        console.log("=== DEBUG 2: Raw Projects from API ===", fetchedProjects);

        if (fetchedProjects && fetchedProjects.length > 0) {
          fetchedProjects.forEach(p => {
            console.log(`Project: "${p.name}" contains ${p.tasks?.length || 0} tasks.`);
            p.tasks?.forEach((t, i) => {
              console.log(`  -> Task [${i}] Title: "${t.title}" | Status: "${t.status}" | Priority: "${t.priority}" (Type: ${typeof t.priority})`);
            });
          });
        }

        if (isMounted) {
          setProjects(fetchedProjects);
          if (fetchedProjects.length > 0) {
            setActiveProjectId(fetchedProjects[0].id);
          }
        }
      } catch (error) {
        console.error("Failed to load projects:", error);
        toast.error("Failed to load projects");
      }
    };

    loadProjects();
    return () => { isMounted = false; };
  }, []);

  // fetch all users once when settings dialog opens
  useEffect(() => {
    if (!settingsOpen) return;

    fetch("/api/users")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.users) setAllUsers(data.users);
      })
      .catch(() => { });
  }, [settingsOpen]);

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
          (member.email &&
            member.email.toLowerCase() === currentUser.email.toLowerCase())
      ) ?? null
    );
  }, [activeProject, currentUser]);

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

  const handleCreateProject = async () => {
    if (!newProjectName.trim() || !currentUser) return;

    try {
      const newProject = await createProjectApi(
        newProjectName.trim(),
        currentUser.id,
        newProjectDescription.trim() || undefined,
        newProjectDeadline || undefined,
        newProjectPriorityRating,
        newProjectStatus,
      );

      newProject.members = [createMemberFromUser(currentUser, "owner")];

      setProjects((prev) => [newProject, ...prev]);
      setActiveProjectId(newProject.id);
      setNewProjectName("");
      setNewProjectDescription("");
      setNewProjectDeadline(null);
      setNewProjectPriorityRating(2.5);
      setNewProjectStatus("active");
      setCreateProjectOpen(false);
      toast.success("Project created successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create project";
      toast.error(message);
    }
  };

  const handleJoinProject = async () => {
    if (!activeProject || !currentUser) return;

    try {
      const newMember = await addProjectMemberApi(
        activeProject.id,
        currentUser.id,
        currentUser.name ?? currentUser.email.split("@")[0],
        currentUser.email,
        "collaborator",
      );

      updateProject(activeProject.id, (project) => ({
        ...project,
        members: [...project.members, newMember],
      }));

      toast.success("Joined project successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to join project";
      toast.error(message);
    }
  };

  const handleDeleteProject = async () => {
    if (!activeProject) return;
    setDeletingProject(true);
    try {
      await deleteProjectApi(activeProject.id);
      const deletedId = activeProject.id;
      const remaining = projects.filter((p) => p.id !== deletedId);
      setProjects(remaining);
      setActiveProjectId(remaining[0]?.id ?? null);
      setSettingsOpen(false);
      toast.success(`Deleted "${activeProject.name}"`);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete project";
      toast.error(message);
    } finally {
      setDeletingProject(false);
    }
  };

  const resetProjectTaskDraft = () => {
    setTaskDraftPreview(null);
    setTaskDraftAttachmentIds([]);
  };

  const acceptTaskAttachment = (file: File) => {
    if (file.size > MAX_TASK_ATTACHMENT_BYTES) {
      toast.error(`"${file.name}" exceeds 10MB and was skipped`);
      return;
    }
    resetProjectTaskDraft();
    setTaskAttachment(file);
  };

  const handleTaskDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) acceptTaskAttachment(file);
  };

  const handleTaskFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) acceptTaskAttachment(file);
    e.target.value = "";
  };

  const requestProjectTaskDraft = async () => {
    if (!taskTitle.trim() && !taskDescription.trim() && !taskAttachment) {
      toast.error("Add a title, description, or attachment before asking AI");
      return;
    }

    setTaskDraftLoading(true);
    try {
      const formData = new FormData();
      formData.set("title", taskTitle);
      formData.set("description", taskDescription);
      formData.set("priority", String(taskPriorityRating));
      if (taskAttachment) {
        formData.append("file", taskAttachment);
      }

      const response = await fetch("/api/ai/task-draft", {
        method: "POST",
        body: formData,
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        throw new Error(data?.message ?? "Could not generate AI suggestions");
      }

      setTaskDraftPreview({
        draft: data.draft,
        attachmentIds: data.attachmentIds ?? [],
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Could not generate AI suggestions");
    } finally {
      setTaskDraftLoading(false);
    }
  };

  const applyProjectTaskDraft = () => {
    if (!taskDraftPreview) return;
    setTaskTitle(taskDraftPreview.draft.title);
    setTaskDescription(taskDraftPreview.draft.description);
    setTaskPriorityRating(taskDraftPreview.draft.priority);
    setTaskDraftAttachmentIds(taskDraftPreview.attachmentIds);
    toast.success("AI suggestions applied");
  };

  const handleCreateTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeProject) return;
    if (!taskTitle.trim()) {
      toast.error("Task name is required");
      return;
    }

    try {
      const newTask = await createProjectTaskApi(
        activeProject.id,
        taskTitle.trim(),
        taskPriorityRating,
        taskDescription.trim() || undefined,
        undefined,
        taskDraftAttachmentIds,
        taskReminder as string,
      );

      if (taskAttachment && taskDraftAttachmentIds.length === 0) {
        const taskId = newTask.id.replace("proj-task-", "");
        const formData = new FormData();
        formData.append("file", taskAttachment);
        const uploadResponse = await fetch(`/api/project/task/${taskId}/attachment`, {
          method: "POST",
          body: formData,
        });

        if (!uploadResponse.ok) {
          toast.warning("Task created, but the attachment could not be uploaded");
        } else {
          newTask.attachments = [taskAttachment.name];
        }
      } else if (taskAttachment) {
        newTask.attachments = [taskAttachment.name];
      }

      const stringPriority = taskPriorityRating >= 4 ? "high" : taskPriorityRating >= 2.5 ? "medium" : "low";

      const normalizedTask: StoredProjectTask = {
        ...newTask,
        priority: stringPriority,
        status: newTask.status || "not-done",
      };

      updateProject(activeProject.id, (project) => ({
        ...project,
        tasks: [normalizedTask, ...project.tasks],
      }));

      setTaskTitle("");
      setTaskDescription("");
      setTaskPriorityRating(2.5);
      setTaskReminder("none");
      setTaskAttachment(null);
      setTaskDraftPreview(null);
      setTaskDraftAttachmentIds([]);
      setCreateTaskOpen(false);
      toast.success("Task created successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to create task";
      toast.error(message);
    }
  };

  const assignTask = async (taskId: string, memberId?: string) => {
    if (!activeProject) return;

    try {
      await updateProjectTaskApi(taskId, undefined, undefined, undefined, undefined, memberId);

      updateProject(activeProject.id, (project) => ({
        ...project,
        tasks: project.tasks.map((task) =>
          task.id === taskId ? { ...task, assignedTo: memberId } : task,
        ),
      }));

      toast.success("Task assigned successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to assign task";
      toast.error(message);
    }
  };

  const claimTask = (taskId: string) => {
    if (!activeProject || !currentMember) return;
    assignTask(taskId, currentMember.id);
  };

  const moveTask = async (taskId: string, direction: "next" | "prev") => {
    if (!activeProject) return;

    const task = activeProject.tasks.find((t) => t.id === taskId);
    if (!task) return;

    const currentIndex = STATUS_ORDER.indexOf(task.status);
    const nextIndex = direction === "next" ? currentIndex + 1 : currentIndex - 1;
    const nextStatus = STATUS_ORDER[nextIndex] ?? task.status;

    if (nextStatus === task.status) return;

    try {
      await updateProjectTaskApi(taskId, undefined, undefined, undefined, nextStatus);

      updateProject(activeProject.id, (project) => ({
        ...project,
        tasks: project.tasks.map((t) =>
          t.id === taskId ? { ...t, status: nextStatus } : t,
        ),
      }));

      toast.success("Task moved successfully");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to move task";
      toast.error(message);
    }
  };

  const handleInviteMember = async (email: string, userId?: string) => {
    if (!activeProject || !userId) return;

    try {
      setInvitingMemberId(userId);

      console.log("INVITE PAYLOAD:", {
        projectId: activeProject.id,
        targetUserEmail: email,
      });

      const res = await fetch("/api/project/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          projectId: Number(activeProject.id),
          targetUserId: userId,
        }),
      });

      const data = await res.json().catch(() => null);

      if (!res.ok) {
        throw new Error(data?.message || "Unable to complete invitation.");
      }

      toast.success("Invitation sent successfully!");
      setInviteMemberQuery("");
    } catch (err: any) {
      console.error("Invite Error Details:", err);
      toast.error(err?.message || "Something went wrong.");
    } finally {
      setInvitingMemberId(null);
    }
  };

  const inviteResults = useMemo(() => {
    const q = inviteMemberQuery.trim().toLowerCase();
    if (!q) return [];
    return allUsers.filter(
      (u) =>
        u.name?.toLowerCase().includes(q) ||
        u.email?.toLowerCase().includes(q)
    );
  }, [inviteMemberQuery, allUsers]);

  const tasksByStatus = useMemo(() => {
    if (!activeProject) return null;
    return STATUS_META.reduce<Record<ProjectTaskStatus, StoredProjectTask[]>>(
      (acc, column) => {
        acc[column.key] = activeProject.tasks.filter((task) => task.status === column.key);
        return acc;
      },
      { "not-done": [], pending: [], done: [] },
    );
  }, [activeProject]);

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
            value={activeProject?.id ?? ""}
            onValueChange={(value) => setActiveProjectId(value)}
          >
            <SelectTrigger className="min-w-55 font-mono text-xs">
              <SelectValue placeholder={projects.length ? "Select project" : "No projects yet"} />
            </SelectTrigger>
            <SelectContent>
              {projects.map((project) => (
                <SelectItem key={project.id} value={project.id}>
                  {project.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {activeProject && (
            <div className="flex items-center gap-2 text-xs">
              <div className="flex items-center gap-1 text-muted-foreground">
                {activeProject.members.length} member{activeProject.members.length !== 1 ? "s" : ""}
              </div>
              {currentMember ? (
                <Badge variant="outline" className={cn("text-[10px] font-mono", ROLE_STYLES[currentMember.role])}>
                  {currentMember.role.toUpperCase()}
                </Badge>
              ) : (
                <Badge variant="outline" className="text-[10px] font-mono">Not a member</Badge>
              )}
            </div>
          )}

          <Dialog open={createProjectOpen} onOpenChange={setCreateProjectOpen}>
            <DialogContent className="sm:max-w-3xl">
              <DialogHeader>
                <DialogTitle>Create Project</DialogTitle>
                <DialogDescription>Create a new collaboration space.</DialogDescription>
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
                  className="min-h-22.5"
                />
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <Label className="font-mono text-xs">Deadline</Label>
                    <Input
                      className="mt-1"
                      type="date"
                      value={newProjectDeadline ?? ""}
                      onChange={(e) => setNewProjectDeadline(e.target.value || null)}
                    />
                  </div>

                  <div>
                    <Label className="font-mono text-xs">Priority</Label>
                    <div className="mt-1 flex h-10 flex-nowrap items-center gap-2 whitespace-nowrap">
                      <StarRating value={newProjectPriorityRating} onChange={setNewProjectPriorityRating} />
                      <span className="font-mono text-sm text-muted-foreground">
                        {newProjectPriorityRating.toFixed(1)} / 5.0
                      </span>
                    </div>
                  </div>

                  <div>
                    <Label className="font-mono text-xs">Status</Label>
                    <Select
                      value={newProjectStatus}
                      onValueChange={(v) => setNewProjectStatus(v as "active" | "completed" | "archived")}
                    >
                      <SelectTrigger className="mt-1 w-full font-mono text-sm">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="active">Active</SelectItem>
                        <SelectItem value="completed">Completed</SelectItem>
                        <SelectItem value="archived">Archived</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </div>
              <DialogFooter>
                <DialogClose asChild>
                  <Button variant="outline">Cancel</Button>
                </DialogClose>
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleCreateProject}>
                  Create
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>

          {activeProject && (
            <Dialog open={settingsOpen} onOpenChange={setSettingsOpen}>
              <DialogTrigger asChild>
                <Button variant="outline">
                  <Settings className="h-4 w-4 mr-2" /> Project Settings
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Project Settings</DialogTitle>
                </DialogHeader>
                <div className="space-y-4">
                  <div>
                    <p className="text-sm font-medium text-foreground">{activeProject.name}</p>
                    <p className="text-xs text-muted-foreground">{activeProject.description ?? "No description provided."}</p>
                  </div>

                  {/* Members list */}
                  <div className="space-y-2">
                    <p className="text-xs font-mono tracking-wider text-muted-foreground">MEMBERS</p>
                    <div className="divide-y divide-border/40 rounded-lg border border-border/50">
                      {activeProject.members.map((member) => (
                        <div key={member.id} className="flex items-center justify-between px-3 py-2">
                          <div>
                            <p className="text-sm font-medium">{member.name}</p>
                            <p className="text-[10px] text-muted-foreground font-mono">{member.email}</p>
                          </div>
                          <Badge variant="outline" className={cn("text-[10px] font-mono", ROLE_STYLES[member.role])}>
                            {member.role.toUpperCase()}
                          </Badge>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Invite by email (owner only) */}
                  {isOwner && (
                    <div className="space-y-2">
                      <p className="text-xs font-mono tracking-wider text-muted-foreground">INVITE MEMBER</p>
                      <div className="relative">
                        <Input
                          placeholder="Search by name or email..."
                          value={inviteMemberQuery}
                          onChange={(e) => setInviteMemberQuery(e.target.value)}
                          className="font-mono text-sm"
                        />

                        {/* dropdown results */}
                        {inviteResults.length > 0 && (
                          <div className="absolute z-50 mt-1 w-full rounded-lg border border-border/50 bg-popover shadow-md overflow-hidden">
                            {inviteResults.map((user) => {
                              const alreadyMember = activeProject.members.some((m) => m.id === user.id);
                              return (
                                <button
                                  key={user.id}
                                  type="button"
                                  disabled={alreadyMember || invitingMemberId === user.id}

                                  onClick={() => handleInviteMember(user.email, user.id)}
                                  className="flex w-full items-center justify-between px-3 py-2 text-left hover:bg-accent/10 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                                >
                                  <div>
                                    <p className="text-sm font-medium">{user.name ?? "—"}</p>
                                    <p className="text-[10px] text-muted-foreground font-mono">{user.email}</p>
                                  </div>
                                  <span className="text-[10px] font-mono text-muted-foreground">
                                    {alreadyMember ? "Already added" : invitingMemberId === user.id ? "Adding..." : "Add"}
                                  </span>
                                </button>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* Danger zone */}
                  {isOwner && (
                    <div className="space-y-2 border-t border-destructive/30 pt-4">
                      <p className="text-xs font-mono text-destructive tracking-wider">DANGER ZONE</p>
                      <AlertDialog>
                        <AlertDialogTrigger asChild>
                          <Button variant="destructive" className="font-mono text-xs">
                            <Trash2 className="h-4 w-4 mr-2" /> Delete project
                          </Button>
                        </AlertDialogTrigger>
                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle>Delete &quot;{activeProject.name}&quot;?</AlertDialogTitle>
                            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel disabled={deletingProject}>Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={handleDeleteProject}
                              disabled={deletingProject}
                              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                            >
                              {deletingProject ? "Deleting..." : "Delete"}
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </AlertDialog>
                    </div>
                  )}
                </div>
              </DialogContent>
            </Dialog>
          )}

          {activeProject && isOwner && (
            <Dialog open={createTaskOpen} onOpenChange={setCreateTaskOpen}>
              <DialogTrigger asChild>
                <Button className="bg-accent hover:bg-accent/90 text-accent-foreground">
                  <Plus className="h-4 w-4 mr-2" /> New Task
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Create Task</DialogTitle>
                </DialogHeader>
                <form onSubmit={handleCreateTask} className="space-y-5">
                  <div className="space-y-1.5">
                    <Label className="font-mono text-xs tracking-wider">TASK NAME *</Label>
                    <Input
                      placeholder="e.g. Finalize onboarding docs"
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-mono text-xs tracking-wider">DESCRIPTION</Label>
                    <Textarea
                      placeholder="Optional task description..."
                      value={taskDescription}
                      onChange={(e) => setTaskDescription(e.target.value)}
                      className="resize-y min-h-20"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-mono text-xs tracking-wider">ATTACHMENT</Label>
                    <p className="font-mono text-[10px] text-muted-foreground">{AI_READABLE_ATTACHMENT_HELPER_TEXT}</p>
                    {taskAttachment ? (
                      <div className="flex items-center gap-2 rounded-lg border border-border/50 bg-muted/30 px-3 py-2">
                        <Paperclip className="h-4 w-4 text-muted-foreground" />
                        <span className="text-sm flex-1 truncate">{taskAttachment.name}</span>
                        <button
                          type="button"
                          onClick={() => {
                            resetProjectTaskDraft();
                            setTaskAttachment(null);
                          }}
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
                        <span className="font-mono text-xs text-muted-foreground">Drop file here or click to browse</span>
                        <input type="file" className="hidden" onChange={handleTaskFileSelect} />
                      </label>
                    )}
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-mono text-xs tracking-wider">PRIORITY</Label>
                    <div className="flex items-center gap-3">
                      <StarRating value={taskPriorityRating} onChange={setTaskPriorityRating} size="lg" />
                      <span className="font-mono text-sm text-muted-foreground">{taskPriorityRating.toFixed(1)} / 5.0</span>
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="font-mono text-xs tracking-wider">REMINDER</Label>
                    <Select value={taskReminder} onValueChange={setTaskReminder}>
                      <SelectTrigger className="font-mono text-sm"><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">None</SelectItem>
                        <SelectItem value="daily">Daily</SelectItem>
                        <SelectItem value="every-3-days">Every 3 Days</SelectItem>
                        <SelectItem value="weekly">Weekly</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <AiSuggestionsButton
                    description="Get project task ideas from the title, description, and file."
                    loading={taskDraftLoading}
                    onClick={requestProjectTaskDraft}
                  />

                  {taskDraftPreview && (
                    <div className="space-y-3 rounded-lg border border-accent/30 bg-accent/5 p-4">
                      <div>
                        <p className="font-mono text-xs tracking-wider text-muted-foreground">AI DRAFT</p>
                        <h3 className="mt-1 text-base font-semibold">{taskDraftPreview.draft.title}</h3>
                        <p className="mt-2 text-sm text-muted-foreground whitespace-pre-line">{taskDraftPreview.draft.description}</p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <Button type="button" size="sm" onClick={applyProjectTaskDraft}>Apply suggestions</Button>
                        <Button type="button" size="sm" variant="outline" onClick={() => setTaskDraftPreview(null)}>Dismiss</Button>
                      </div>
                    </div>
                  )}

                  <DialogFooter>
                    <DialogClose asChild><Button variant="outline">Cancel</Button></DialogClose>
                    <Button type="submit" className="bg-accent hover:bg-accent/90 text-accent-foreground">Create Task</Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {activeProject && !currentMember && (
            <Button size="sm" className="bg-accent hover:bg-accent/90 text-accent-foreground" onClick={handleJoinProject}>
              Join Project
            </Button>
          )}
          <Button onClick={() => setCreateProjectOpen(true)} className="bg-accent hover:bg-accent/90 text-accent-foreground font-semibold">
            <Plus className="h-4 w-4 mr-1" /> New Project
          </Button>
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
              <section key={column.key} className="rounded-xl border border-border/50 bg-card/40">
                <div className="px-4 py-3 border-b border-border/40">
                  <h3 className="font-display text-base font-bold tracking-wide">{column.label}</h3>
                  <p className="text-xs text-muted-foreground">{column.helper}</p>
                </div>
                <div className="px-4 py-2">
                  {tasksByStatus[column.key].length === 0 ? (
                    <p className="text-sm text-muted-foreground py-4">No tasks in this column.</p>
                  ) : (
                    <div className="divide-y divide-border/40">
                      {tasksByStatus[column.key].map((task) => {
                        const assignedMember = activeProject.members.find((member) => member.id === task.assignedTo);
                        const isAssignedToCurrent = currentMember && task.assignedTo === currentMember.id;
                        const isAssignedElsewhere = task.assignedTo && (!currentMember || task.assignedTo !== currentMember.id);
                        const canMove = Boolean(isAssignedToCurrent);
                        const dimTask = isAssignedElsewhere && task.status !== "done";

                        const currentIndex = STATUS_ORDER.indexOf(task.status);
                        const prevStatus = STATUS_ORDER[currentIndex - 1] ?? null;
                        const nextStatus = STATUS_ORDER[currentIndex + 1] ?? null;

                        return (
                          <div key={task.id} className={cn("py-3 space-y-2", dimTask && "opacity-60")}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <p className="font-medium text-foreground">{task.title}</p>
                                {task.description && <p className="text-xs text-muted-foreground">{task.description}</p>}
                              </div>
                              <Badge
                                className={cn(
                                  "text-[10px] px-2 py-0.5",
                                  PRIORITY_STYLES[Number(task.priority)] || "bg-gray-100 text-gray-800"
                                )}
                              >
                                {Number(task.priority) >= 3 ? "HIGH" : Number(task.priority) === 2 ? "MEDIUM" : "LOW"}
                              </Badge>
                            </div>

                            <div className="flex flex-wrap gap-2 text-[10px] text-muted-foreground font-mono">
                              <span>{assignedMember ? `Assigned: ${assignedMember.name}` : "Unassigned"}</span>
                            </div>

                            <div className="flex flex-wrap items-center gap-2">
                              {isOwner && (
                                <Select
                                  value={task.assignedTo ?? "unassigned"}
                                  onValueChange={(value) => assignTask(task.id, value === "unassigned" ? undefined : value)}
                                >
                                  <SelectTrigger className="h-8 text-xs font-mono">
                                    <SelectValue placeholder="Assign" />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="unassigned">Unassigned</SelectItem>
                                    {activeProject.members.map((member) => (
                                      <SelectItem key={member.id} value={member.id}>
                                        {member.name} ({member.role})
                                      </SelectItem>
                                    ))}
                                  </SelectContent>
                                </Select>
                              )}

                              {!isOwner && !task.assignedTo && currentMember && (
                                <Button size="sm" variant="outline" className="text-xs" onClick={() => claimTask(task.id)}>
                                  Claim Task
                                </Button>
                              )}

                              {prevStatus && (
                                <Button size="sm" variant="outline" className="text-xs" onClick={() => moveTask(task.id, "prev")} disabled={!canMove}>
                                  Move Back
                                </Button>
                              )}
                              {nextStatus && (
                                <Button size="sm" className="text-xs bg-accent hover:bg-accent/90 text-accent-foreground" onClick={() => moveTask(task.id, "next")} disabled={!canMove}>
                                  Move Forward
                                </Button>
                              )}
                            </div>
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