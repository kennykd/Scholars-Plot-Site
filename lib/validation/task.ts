import { z } from 'zod';

export const createTaskSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(100, 'Title cannot exceed 100 characters'),
  description: z.string()
    .optional(),
  deadline: z.coerce.date()
    .refine((date) => date >= new Date(),
      { message: 'Deadline must be in the future' },
    ),
  status: z.enum(['Pending', 'In_Progress', 'Completed']),
  priority: z.coerce.number()
    .min(0.5).max(5)
    .optional(),
});

export const updateTaskSchema = z.object({
  title: z.string()
    .min(1, 'Title is required')
    .max(100, 'Title cannot exceed 100 characters')
    .optional(),
  deadline: z.coerce.date()
    .optional(),
  status: z.enum(['Pending', 'In_Progress', 'Completed'])
    .optional(),
  description: z.string()
    .optional(),
  priority: z.coerce.number()
    .min(0.5).max(5)
    .optional(),
});

export type CreateTaskInput = z.infer<typeof createTaskSchema>;
export type UpdateTaskInput = z.infer<typeof updateTaskSchema>;
