import { z } from 'zod';

export const updateAnalyticsSchema = z.object({
  tasks_completed_early: z.number().int().min(0).optional(),
  tasks_completed_on_time: z.number().int().min(0).optional(),
  tasks_completed_late: z.number().int().min(0).optional(),
  tasks_pending: z.number().int().min(0).optional(),
  total_focus_minutes: z.number().int().min(0).optional(),
  total_tasks_completed: z.number().int().min(0).optional(),
  streak: z.number().int().min(0).optional(),
}).refine(
  (data) => Object.keys(data).length > 0,
  { message: 'At least one field must be provided for update' }
);

export type UpdateAnalyticsInput = z.infer<typeof updateAnalyticsSchema>;
