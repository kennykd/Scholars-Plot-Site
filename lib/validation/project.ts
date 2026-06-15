import { z } from 'zod';

export const createProjectSchema = z.object({
  name: z.string()
  .min(1, 'Project name is required')
  .max(100, 'Project name cannot exceed 100 characters'),
  description: z.string()
  .optional(),
  deadline: z.coerce.date()
  .refine((date) => date >= new Date(),
    { message: "Deadline must be in the future" }
  ),
  priority: z.coerce.number()
  .min(0.5).max(5),
  project_status: z.enum(['active', 'completed', 'archived'])
  .optional(),
  ownerId: z.string()
  .min(1)
  .optional(),
  members: z.array(z.object({
    id: z.string(),
    name: z.string()
    .min(1, 'Member name is required'),
    handle: z.string()
    .optional(),
    role: z.enum(['owner', 'moderator', 'collaborator', 'member']),
  }))
  .optional(),
});

export const updateProjectSchema = z.object({
  name: z.string()
  .min(1, 'Project name is required')
  .max(100, 'Project name cannot exceed 100 characters')
  .optional(),
  description: z.string()
  .optional(),
  deadline: z.coerce.date()
  .refine((date) => date >= new Date(),
    { message: "Deadline must be in the future" }
  )
  .optional(),
  priority: z.coerce.number()
  .min(0.5).max(5)
  .optional(),
  project_status: z.enum(['active', 'completed', 'archived'])
  .optional(),
  members: z.array(z.object({
    id: z.string(),
    name: z.string()
    .min(1, 'Member name is required'),
    handle: z.string()
    .optional(),
    role: z.enum(['owner', 'moderator', 'collaborator', 'member']),
  }))
  .optional(),
});

export const createProjectTaskSchema = z.object({
  projectId: z.coerce.number()
  .min(1, 'Project ID is required'),
  title: z.string()
  .min(1, 'Title is required')
  .max(100, 'Title cannot exceed 100 characters'),
  description: z.string()
  .optional(),
  priority: z.coerce.number()
  .min(0.5).max(5),
  status: z.enum(['Pending', 'In_Progress', 'Completed']),
  assignedTo: z.string()
  .optional(),
  attachments: z.array(z.string())
  .optional(),
  attachmentIds: z.array(z.coerce.number().int().positive())
  .max(20)
  .optional(),
});

export const updateProjectTaskSchema = z.object({
  title: z.string()
  .min(1, 'Title is required')
  .max(100, 'Title cannot exceed 100 characters')
  .optional(),
  description: z.string()
  .optional(),
  priority: z.coerce.number()
  .min(0.5).max(5)
  .optional(),
  status: z.enum(['Pending', 'In_Progress', 'Completed'])
  .optional(),
  assignedTo: z.string()
  .optional(),
  attachments: z.array(z.string())
  .optional(),
});

export const addProjectMemberSchema = z.object({
  id: z.string()
  .min(1, 'Member ID is required'),
  name: z.string()
  .min(1, 'Member name is required'),
  handle: z.string()
  .optional(),
  role: z.enum(['owner', 'moderator', 'collaborator', 'member']),
});

export const updateProjectMemberSchema = z.object({
  role: z.enum(['owner', 'moderator', 'collaborator', 'member']),
});

export const createProjectInviteSchema = z.object({
  projectId: z.preprocess((value) => {
    if (typeof value === 'string') {
      return value.replace(/^project-/, '');
    }

    return value;
  }, z.coerce.number().int().positive('Project ID is required')),
  targetUserId: z.string().trim().min(1).optional(),
  targetUserEmail: z.string().trim().email().optional(),
}).refine(
  (data) => Boolean(data.targetUserId || data.targetUserEmail),
  {
    message: 'Target user is required',
    path: ['targetUserId'],
  },
);

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type CreateProjectTaskInput = z.infer<typeof createProjectTaskSchema>;
export type UpdateProjectTaskInput = z.infer<typeof updateProjectTaskSchema>;
export type AddProjectMemberInput = z.infer<typeof addProjectMemberSchema>;
export type UpdateProjectMemberInput = z.infer<typeof updateProjectMemberSchema>;
export type CreateProjectInviteInput = z.infer<typeof createProjectInviteSchema>;
