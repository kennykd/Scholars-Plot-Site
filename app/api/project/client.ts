/**
 * Client-side API utilities for project operations
 * Handles serialization between API responses and frontend types
 */

import type {
  ProjectMember,
  ProjectRole,
  ProjectTaskStatus,
} from "@/types";

// ─── Types ──────────────────────────────────────────────────────────────────

export type StoredProjectTask = {
  id: string;
  title: string;
  description?: string;
  attachments?: string[];
  reminder?: string;
  priority: string;
  status: ProjectTaskStatus;
  assignedTo?: string;
  createdAt: string;
};

export type StoredProject = {
  id: string;
  name: string;
  description?: string;
  deadline?: string;
  project_status: "active" | "completed" | "archived";
  priority: number;
  ownerId?: string;
  members: ProjectMember[];
  tasks: StoredProjectTask[];
  createdAt: string;
};

export interface ApiProject {
  project_id: number;
  project_name: string;
  project_description: string | null;
  project_deadline: string | null;
  project_status: string;
  project_priority: number | null;
  project_created_at: string;
  project_user: Array<{
    project_id: number;
    user_id: string;
    project_user_role: string;
    user?: {
      user_name: string;
      user_email: string;
    };
  }>;
  tasks: ApiProjectTask[];
}

export interface ApiProjectTask {
  task_id: number;
  project_id: number;
  task_name: string;
  task_description: string | null;
  task_deadline: string;
  task_priority: number;
  task_status: string;
  task_created_at: string;
  task_completed_at: string | null;
  task_users?: Array<{ user_id: string }>;
}

export interface ApiProjectMember {
  project_id: number;
  user_id: string;
  project_user_role: string;
}

// ─── Serialization ──────────────────────────────────────────────────────────

/**
 * Convert API project response to frontend StoredProject format
 * NOTE: This doesn't include member details beyond IDs - members are fetched separately
 */
export function serializeProject(apiProject: ApiProject): StoredProject {
  // Extract assigned user from task_users if available, otherwise undefined
  const tasks: StoredProjectTask[] = apiProject.tasks.map((task) => ({
    id: `proj-task-${task.task_id}`,
    title: task.task_name,
    description: task.task_description || undefined,
    attachments: [],
    reminder: "none" as const,
    priority: priorityFromNumber(task.task_priority),
    status: statusFromTaskStatus(task.task_status),
    assignedTo: task.task_users?.[0]?.user_id || undefined,
    createdAt: task.task_created_at,
  }));

  return {
    id: `project-${apiProject.project_id}`,
    name: apiProject.project_name,
    description: apiProject.project_description || undefined,
    deadline: apiProject.project_deadline || undefined,
    project_status: projectStatusFromApi(apiProject.project_status),
    priority: apiProject.project_priority || 3,
    ownerId: apiProject.project_user.find((pu) => pu.project_user_role === "owner")
      ?.user_id,
    members: apiProject.project_user.map((pu) => ({
      id: pu.user_id,
      name: pu.user?.user_name ?? pu.user_id,
      email: pu.user?.user_email,
      role: pu.project_user_role as ProjectRole,
    })),  
    tasks,
    createdAt: apiProject.project_created_at,
  };
}

/**
 * Convert API task to frontend ProjectTask format
 */
export function serializeProjectTask(task: ApiProjectTask): StoredProjectTask {
  return {
    id: `proj-task-${task.task_id}`,
    title: task.task_name,
    description: task.task_description || undefined,
    attachments: [],
    reminder: "none" as const,
    priority: priorityFromNumber(task.task_priority),
    status: statusFromTaskStatus(task.task_status),
    assignedTo: task.task_users?.[0]?.user_id || undefined,
    createdAt: task.task_created_at,
  };
}

/**
 * Convert number priority to string priority
 */
function priorityFromNumber(value: number): string {
  if (value >= 4) return "high";
  if (value >= 2.5) return "medium";
  return "low";
}

/**
 * Convert string priority to number
 */
function priorityToNumber(priority: string): number {
  switch (priority) {
    case "high":
      return 4;
    case "medium":
      return 3;
    case "low":
      return 1;
    default:
      return 3;
  }
}

function statusFromTaskStatus(status: string): ProjectTaskStatus {
  if (status === "Completed") return "done";
  if (status === "In_Progress" || status === "In Progress") return "pending";
  return "not-done";
}

function statusToTaskStatus(status: ProjectTaskStatus) {
  if (status === "done") return "Completed";
  if (status === "pending") return "In_Progress";
  return "Pending";
}

function projectStatusFromApi(status: string): StoredProject["project_status"] {
  if (status === "completed" || status === "archived") return status;
  return "active";
}

// ─── API Methods ────────────────────────────────────────────────────────────

/**
 * Fetch all projects
 */
export async function fetchProjects(): Promise<StoredProject[]> {
  const res = await fetch("/api/project", { method: "GET" });
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || "Failed to fetch projects");
  }
  const data = await res.json();
  return (data.projects || []).map((p: ApiProject) => serializeProject(p));
}

/**
 * Create a new project
 */
export async function createProjectApi(
  name: string,
  ownerId: string,
  description?: string,
  deadline?: string,
  priority?: number,
  project_status?: "active" | "completed" | "archived",
): Promise<StoredProject> {
  const res = await fetch("/api/project", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      description,
      ownerId,
      ...(deadline ? { deadline } : {}),
      ...(priority !== undefined ? { priority } : {}),
      ...(project_status ? { project_status } : { project_status: "active" }),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const firstError =
      body?.errors && typeof body.errors === "object"
        ? Object.values(body.errors).flat()[0]
        : null;
    throw new Error(firstError || body?.message || "Failed to create project");
  }

  const data = await res.json();
  return serializeProject(data.project);
}

/**
 * Update a project
 */
export async function updateProjectApi(
  projectId: string,
  name?: string,
  description?: string
): Promise<StoredProject> {
  const projectNumId = projectId.replace("project-", "");
  const res = await fetch(`/api/project/${projectNumId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(name && { name }),
      ...(description !== undefined && { description }),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const firstError =
      body?.errors && typeof body.errors === "object"
        ? Object.values(body.errors).flat()[0]
        : null;
    throw new Error(
      firstError || body?.message || "Failed to update project"
    );
  }

  const data = await res.json();
  return serializeProject(data.project);
}

/**
 * Delete a project
 */
export async function deleteProjectApi(projectId: string): Promise<void> {
  const projectNumId = projectId.replace("project-", "");
  const res = await fetch(`/api/project/${projectNumId}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || "Failed to delete project");
  }
}

/**
 * Add a member to a project
 */
export async function addProjectMemberApi(
  projectId: string,
  memberId: string,
  name: string,
  email: string,
  role: ProjectRole
): Promise<ProjectMember> {
  const projectNumId = projectId.replace("project-", "");
  const res = await fetch(`/api/project/${projectNumId}/member`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      id: memberId,
      name,
      email,
      role,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const firstError =
      body?.errors && typeof body.errors === "object"
        ? Object.values(body.errors).flat()[0]
        : null;
    throw new Error(
      firstError || body?.message || "Failed to add member"
    );
  }

  const data = await res.json();
  return {
    id: data.member.user_id,
    name: data.member.user?.user_name ?? data.member.user_id,
    email: data.member.user?.user_email,
    role: data.member.project_user_role as ProjectRole,
  };
}

/**
 * Create a task in a project
 */
export async function createProjectTaskApi(
  projectId: string,
  title: string,
  priority: number,
  description?: string,
  assignedTo?: string,
  attachmentIds?: number[],
  reminder?: string,
): Promise<StoredProjectTask> {
  const projectNumId = projectId.replace("project-", "");
  const res = await fetch("/api/project/task", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      projectId: parseInt(projectNumId),
      title,
      description,
      priority,
      status: "Pending",
      assignedTo,
      ...(attachmentIds?.length ? { attachmentIds } : {}),
      reminder,
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const firstError =
      body?.errors && typeof body.errors === "object"
        ? Object.values(body.errors).flat()[0]
        : null;
    throw new Error(
      firstError || body?.message || "Failed to create task"
    );
  }

  const data = await res.json();
  return serializeProjectTask(data.task);
}

/**
 * Update a task in a project
 */
export async function updateProjectTaskApi(
  projectTaskId: string,
  title?: string,
  description?: string,
  priority?: string,
  status?: ProjectTaskStatus,
  assignedTo?: string
): Promise<StoredProjectTask> {
  const taskNumId = projectTaskId.replace("proj-task-", "");
  const res = await fetch(`/api/project/task/${taskNumId}`, {
    method: "PATCH",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      ...(title && { title }),
      ...(description !== undefined && { description }),
      ...(priority && { priority: priorityToNumber(priority) }),
      ...(status && { status: statusToTaskStatus(status) }),
      ...(assignedTo !== undefined && { assignedTo }),
    }),
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const firstError =
      body?.errors && typeof body.errors === "object"
        ? Object.values(body.errors).flat()[0]
        : null;
    throw new Error(
      firstError || body?.message || "Failed to update task"
    );
  }

  const data = await res.json();
  return serializeProjectTask(data.task);
}

/**
 * Delete a task in a project
 */
export async function deleteProjectTaskApi(projectTaskId: string): Promise<void> {
  const taskNumId = projectTaskId.replace("proj-task-", "");
  const res = await fetch(`/api/project/task/${taskNumId}`, {
    method: "DELETE",
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.message || "Failed to delete task");
  }
}
