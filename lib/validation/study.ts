import { z } from 'zod';

export const createStudySchema = z.object({
  study_session_name: z.string()
  .min(1, 'Study session name is required')
  .max(100, 'Study session name cannot exceed 100 characters'),
  study_session_description: z.string()
  .optional(),
  focus_minutes: z.coerce.number()
  .int('Focus minutes must be a whole number')
  .min(1, 'Focus minutes must be at least 1 minute'),
  break_minutes: z.coerce.number()
  .int('Break minutes must be a whole number')
  .min(0, 'Break minutes cannot be negative'),
  total_pomodoros: z.coerce.number()
  .int('Total pomodoros must be a whole number')
  .min(1, 'Total pomodoros must be at least 1'),
  total_minutes: z.coerce.number()
  .int('Total minutes must be a whole number')
  .min(1, 'Total minutes must be at least 1 minute'),
  checklist_json: z.array(z.object({
    id: z.uuid(),
    text: z.string()
    .min(1, 'Checklist item text is required'),
    completed: z.boolean(),
  })).nullable(),
  study_session_scheduled_at: z.coerce.date()
  .refine((date) => date >= new Date(),
    { message: "Scheduled time must be in the future" }
  )
});

export const updateStudySchema = z.object({
  study_session_name: z.string()
  .min(1, 'Study session name is required')
  .max(100, 'Study session name cannot exceed 100 characters')
  .optional(),
  study_session_description: z.string()
  .optional(),
  focus_minutes: z.coerce.number()
  .int('Focus minutes must be a whole number')
  .min(1, 'Focus minutes must be at least 1 minute')
  .optional(),
  break_minutes: z.coerce.number()
  .int('Break minutes must be a whole number')
  .min(0, 'Break minutes cannot be negative')
  .optional(),
  total_pomodoros: z.coerce.number()
  .int('Total pomodoros must be a whole number')
  .min(1, 'Total pomodoros must be at least 1')
  .optional(),
  total_minutes: z.coerce.number()
  .int('Total minutes must be a whole number')
  .min(1, 'Total minutes must be at least 1 minute')
  .optional(),
  checklist_json: z.array(z.object({
    id: z.uuid(),
    text: z.string()
    .min(1, 'Checklist item text is required'),
    completed: z.boolean(),
  }))
  .nullable()
  .optional(),
  study_session_scheduled_at: z.coerce.date()
  .refine((date) => date >= new Date(),
    { message: "Scheduled time must be in the future" }
  )
  .optional()
});

export type CreateStudyInput = z.infer<typeof createStudySchema>;
export type UpdateStudyInput = z.infer<typeof updateStudySchema>;
