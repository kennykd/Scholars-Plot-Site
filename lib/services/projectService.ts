import prisma from '@/lib/prisma';
import type {
  AddProjectMemberInput,
  CreateProjectInput,
  CreateProjectTaskInput,
  UpdateProjectInput,
  UpdateProjectMemberInput,
  UpdateProjectTaskInput,
} from '@/lib/validation/project';

type ProjectUserRole = 'owner' | 'moderator' | 'member';

const projectManagerRoles: ProjectUserRole[] = ['owner', 'moderator'];

export class ProjectServiceError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = 'ProjectServiceError';
  }
}

const projectInclude = {
  project_user: true,
  tasks: true,
};

const taskInclude = {
  project: true,
  task_users: true,
};

function isProjectManagerRole(role: ProjectUserRole) {
  return projectManagerRoles.includes(role);
}

async function requireUsersExist(userIds: string[], label = 'Project member') {
  const uniqueIds = [...new Set(userIds.filter(Boolean))];

  if (uniqueIds.length === 0) {
    return;
  }

  const existingUsers = await prisma.user.findMany({
    where: {
      user_id: {
        in: uniqueIds,
      },
    },
    select: {
      user_id: true,
    },
  });
  const existingIds = new Set(existingUsers.map((user) => user.user_id));
  const missingIds = uniqueIds.filter((userId) => !existingIds.has(userId));

  if (missingIds.length > 0) {
    throw new ProjectServiceError(400, `${label} does not exist: ${missingIds.join(', ')}`);
  }
}

async function getProjectMemberRole(projectId: number, userId: string) {
  return prisma.projectUser.findUnique({
    where: {
      project_id_user_id: {
        project_id: projectId,
        user_id: userId,
      },
    },
    select: {
      project_user_role: true,
    },
  });
}

async function requireProjectManagerRole(projectId: number, userId: string) {
  const project = await prisma.project.findUnique({
    where: { project_id: projectId },
    select: { project_id: true },
  });

  if (!project) {
    throw new ProjectServiceError(404, 'Project not found');
  }

  const memberRole = await getProjectMemberRole(projectId, userId);

  if (!memberRole) {
    throw new ProjectServiceError(403, 'You are not a member of this project');
  }

  if (!isProjectManagerRole(memberRole.project_user_role as ProjectUserRole)) {
    throw new ProjectServiceError(403, 'Only moderators or owners can manage members and tasks');
  }

  return memberRole.project_user_role as ProjectUserRole;
}

async function requireProjectOwnerRole(projectId: number, userId: string) {
  const project = await prisma.project.findUnique({
    where: { project_id: projectId },
    select: { project_id: true },
  });

  if (!project) {
    throw new ProjectServiceError(404, 'Project not found');
  }

  const memberRole = await getProjectMemberRole(projectId, userId);

  if (!memberRole) {
    throw new ProjectServiceError(403, 'You are not a member of this project');
  }

  if (memberRole.project_user_role !== 'owner') {
    throw new ProjectServiceError(403, 'Only the project owner can perform this action');
  }

  return memberRole.project_user_role as ProjectUserRole;
}

async function requireProjectTaskAccess(taskId: number, userId: string) {
  const task = await prisma.task.findUnique({
    where: { task_id: taskId },
    include: {
      project: {
        include: {
          project_user: {
            where: {
              user_id: userId,
            },
            select: {
              project_user_role: true,
            },
          },
        },
      },
      task_users: {
        select: {
          user_id: true,
        },
      },
    },
  });

  if (!task || !task.project) {
    throw new ProjectServiceError(404, 'Project task not found');
  }

  const memberRole = task.project.project_user[0]?.project_user_role as ProjectUserRole | undefined;

  if (!memberRole) {
    throw new ProjectServiceError(403, 'You are not a member of this project');
  }

  const isManager = isProjectManagerRole(memberRole);
  const isAssigned = task.task_users.some((assignment: { user_id: string }) => assignment.user_id === userId);

  return {
    task,
    memberRole,
    isManager,
    isAssigned,
  };
}

export async function getProjects(userId: string) {
  return prisma.project.findMany({
    where: {
      project_user: { some: { user_id: userId } },
    },
    include: projectInclude,
    orderBy: {
      project_created_at: 'desc',
    },
  });
}

export async function createProject(userId: string, data: CreateProjectInput) {
  const ownerMember = {
    user_id: userId,
    project_user_role: 'owner' as ProjectUserRole,
  };

  const additionalMembers =
    data.members
      ?.filter((member) => member.id !== userId)
      .map((member) => ({
        user_id: member.id,
        project_user_role: member.role as ProjectUserRole,
      })) ?? [];

  await requireUsersExist(additionalMembers.map((member) => member.user_id));

  return prisma.project.create({
    data: {
      project_name: data.name,
      project_description: data.description,
      project_deadline: data.deadline,
      ...(data.project_status !== undefined ? { project_status: data.project_status } : {}),
      project_priority: data.priority,
      project_user: {
        create: [ownerMember, ...additionalMembers],
      },
    },
    include: projectInclude,
  });
}

export async function updateProjectById(projectId: number, userId: string, data: UpdateProjectInput) {
  await requireProjectManagerRole(projectId, userId);

  const existingProject = await prisma.project.findUnique({
    where: { project_id: projectId },
    include: {
      project_user: {
        where: {
          project_user_role: 'owner',
        },
      },
    },
  });

  if (!existingProject) {
    throw new ProjectServiceError(404, 'Project not found');
  }

  await prisma.project.update({
    where: { project_id: projectId },
    data: {
      ...(data.name ? { project_name: data.name } : {}),
      ...(data.description !== undefined ? { project_description: data.description } : {}),
      ...(data.deadline ? { project_deadline: data.deadline } : {}),
      ...(data.project_status !== undefined ? { project_status: data.project_status } : {}),
      ...(data.priority ? { project_priority: data.priority } : {}),
    },
  });

  if (data.members) {
    const ownerId = existingProject.project_user[0]?.user_id;

    const membersToCreate = data.members
      .filter((member) => member.id !== ownerId)
      .map((member) => ({
        project_id: projectId,
        user_id: member.id,
        project_user_role: member.role,
      }));

    await requireUsersExist(membersToCreate.map((member) => member.user_id));

    await prisma.projectUser.deleteMany({
      where: {
        project_id: projectId,
        project_user_role: {
          not: 'owner',
        },
      },
    });

    if (membersToCreate.length > 0) {
      await prisma.projectUser.createMany({
        data: membersToCreate,
        skipDuplicates: true,
      });
    }
  }

  return prisma.project.findUnique({
    where: { project_id: projectId },
    include: projectInclude,
  });
}

export async function deleteProjectById(projectId: number, userId: string) {
  await requireProjectOwnerRole(projectId, userId);

  await prisma.project.delete({
    where: { project_id: projectId },
  });
}

export async function addProjectMember(projectId: number, userId: string, data: AddProjectMemberInput) {
  await requireProjectManagerRole(projectId, userId);

  const existingMember = await prisma.projectUser.findUnique({
    where: {
      project_id_user_id: {
        project_id: projectId,
        user_id: data.id,
      },
    },
  });

  if (existingMember) {
    throw new ProjectServiceError(409, 'Member already in project');
  }

  await requireUsersExist([data.id]);

  return prisma.projectUser.create({
    data: {
      project_id: projectId,
      user_id: data.id,
      project_user_role: data.role,
    },
  });
}

export async function updateProjectMemberById(
  projectId: number,
  userId: string,
  memberId: string,
  data: UpdateProjectMemberInput,
) {
  await requireProjectManagerRole(projectId, userId);

  const existingMember = await prisma.projectUser.findUnique({
    where: {
      project_id_user_id: {
        project_id: projectId,
        user_id: memberId,
      },
    },
  });

  if (!existingMember) {
    throw new ProjectServiceError(404, 'Member not found');
  }

  return prisma.projectUser.update({
    where: {
      project_id_user_id: {
        project_id: projectId,
        user_id: memberId,
      },
    },
    data: {
      project_user_role: data.role,
    },
  });
}

export async function deleteProjectMemberById(projectId: number, userId: string, memberId: string) {
  await requireProjectManagerRole(projectId, userId);

  const member = await prisma.projectUser.findUnique({
    where: {
      project_id_user_id: {
        project_id: projectId,
        user_id: memberId,
      },
    },
  });

  if (!member) {
    throw new ProjectServiceError(404, 'Member not found');
  }

  if (member.project_user_role === 'owner') {
    throw new ProjectServiceError(403, 'Cannot remove the project owner');
  }

  await prisma.projectUser.delete({
    where: {
      project_id_user_id: {
        project_id: projectId,
        user_id: memberId,
      },
    },
  });
}

export async function createProjectTask(userId: string, data: CreateProjectTaskInput) {
  const project = await prisma.project.findUnique({
    where: { project_id: data.projectId },
    select: { project_id: true },
  });

  if (!project) {
    throw new ProjectServiceError(404, 'Project not found');
  }

  const memberRole = await getProjectMemberRole(data.projectId, userId);

  if (!memberRole) {
    throw new ProjectServiceError(403, 'You are not a member of this project');
  }

  const isManager = isProjectManagerRole(memberRole.project_user_role as ProjectUserRole);

  if (!isManager && data.assignedTo !== userId) {
    throw new ProjectServiceError(403, 'Members can only manage tasks assigned to them');
  }

  if (data.assignedTo) {
    await requireUsersExist([data.assignedTo], 'Assigned user');
  }

  const task = await prisma.task.create({
    data: {
      project_id: data.projectId,
      task_name: data.title,
      task_description: data.description,
      task_priority: data.priority,
      task_status: data.status,
      task_deadline: new Date(Date.now() + 24 * 60 * 60 * 1000),
    },
    include: taskInclude,
  });

  if (data.assignedTo) {
    await prisma.taskUser.create({
      data: {
        task_id: task.task_id,
        user_id: data.assignedTo,
      },
    });
  }

  return prisma.task.findUnique({
    where: { task_id: task.task_id },
    include: taskInclude,
  });
}

export async function updateProjectTaskById(taskId: number, userId: string, data: UpdateProjectTaskInput) {
  const access = await requireProjectTaskAccess(taskId, userId);

  if (!access.isManager) {
    if (!access.isAssigned) {
      throw new ProjectServiceError(403, 'Members can only manage tasks assigned to them');
    }

    if (data.assignedTo !== undefined && data.assignedTo !== userId) {
      throw new ProjectServiceError(403, 'Members can only manage tasks assigned to them');
    }
  }

  const updatedTask = await prisma.task.update({
    where: { task_id: taskId },
    data: {
      ...(data.title ? { task_name: data.title } : {}),
      ...(data.description !== undefined ? { task_description: data.description } : {}),
      ...(data.priority ? { task_priority: data.priority } : {}),
      ...(data.status
        ? {
          task_status: data.status,
          task_completed_at: data.status === 'Completed' ? new Date() : null,
        }
        : {}),
    },
    include: taskInclude,
  });

  if (data.assignedTo !== undefined) {
    if (data.assignedTo) {
      await requireUsersExist([data.assignedTo], 'Assigned user');
    }

    await prisma.taskUser.deleteMany({
      where: {
        task_id: taskId,
      },
    });

    if (data.assignedTo) {
      await prisma.taskUser.create({
        data: {
          task_id: taskId,
          user_id: data.assignedTo,
        },
      });
    }
  }

  return updatedTask;
}

export async function deleteProjectTaskById(taskId: number, userId: string) {
  const access = await requireProjectTaskAccess(taskId, userId);

  if (!access.isManager && !access.isAssigned) {
    throw new ProjectServiceError(403, 'Members can only manage tasks assigned to them');
  }

  await prisma.task.delete({
    where: { task_id: taskId },
  });
}
