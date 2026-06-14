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
  task_id: z.number().int().optional(),
  attachment_id: z.number().int().optional(),
  checklist_json: z.array(z.object({
    id: z.uuid(),
    text: z.string()
    .min(1, 'Checklist item text is required'),
    completed: z.boolean(),
  })).nullable(),
  reminder_enabled: z.boolean().optional(),
  reminders: z.array(z.coerce.number()
    .int('Reminder value must be a whole number')
    .min(0, 'Reminder value cannot be negative')).optional(),
  study_session_scheduled_at: z.coerce.date()
  .refine((date) => date >= new Date(),
    { message: "Scheduled time must be in the future" }
  )
});

const legacyRepeatSchema = z.enum(['none', 'weekly', 'biweekly']);
const repeatUnitSchema = z.enum(['days', 'weeks']);

const studySessionPlanSchema = z.object({
  client_plan_id: z.string().min(1, 'Plan id is required'),
  title: z.string()
    .min(1, 'Session topic is required')
    .max(100, 'Session topic cannot exceed 100 characters'),
  start_date: z.string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must use YYYY-MM-DD format'),
  repeat: legacyRepeatSchema.optional(),
  repeat_enabled: z.boolean().optional(),
  repeat_every: z.coerce.number()
    .int('Repeat interval must be a whole number')
    .optional(),
  repeat_unit: repeatUnitSchema.optional(),
  time: z.string()
    .regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Session time must use HH:mm format'),
  focus_minutes: z.coerce.number()
    .int('Focus minutes must be a whole number')
    .min(1, 'Focus minutes must be at least 1 minute'),
  break_minutes: z.coerce.number()
    .int('Break minutes must be a whole number')
    .min(0, 'Break minutes cannot be negative'),
  total_pomodoros: z.coerce.number()
    .int('Total pomodoros must be a whole number')
    .min(1, 'Total pomodoros must be at least 1'),
  notes: z.string().optional(),
  description_as_checklist: z.boolean().optional(),
})
  .transform((plan) => {
    const legacyRepeat = plan.repeat;
    const repeatEnabled =
      plan.repeat_enabled ?? (legacyRepeat ? legacyRepeat !== 'none' : false);
    const repeatEvery =
      plan.repeat_every ?? (legacyRepeat === 'biweekly' ? 2 : 1);
    const repeatUnit =
      plan.repeat_unit ?? (legacyRepeat === 'weekly' || legacyRepeat === 'biweekly' ? 'weeks' : 'weeks');

    return {
      ...plan,
      repeat_enabled: repeatEnabled,
      repeat_every: repeatEvery,
      repeat_unit: repeatUnit,
    };
  })
  .superRefine((plan, ctx) => {
    if (!plan.repeat_enabled) return;

    if (plan.repeat_unit === 'days' && (plan.repeat_every < 1 || plan.repeat_every > 30)) {
      ctx.addIssue({
        code: 'custom',
        path: ['repeat_every'],
        message: 'Day repeat interval must be between 1 and 30',
      });
    }

    if (plan.repeat_unit === 'weeks' && (plan.repeat_every < 1 || plan.repeat_every > 12)) {
      ctx.addIssue({
        code: 'custom',
        path: ['repeat_every'],
        message: 'Week repeat interval must be between 1 and 12',
      });
    }
  });

export const createStudyBatchSchema = z.object({
  task_id: z.number().int().positive(),
  reminder_enabled: z.boolean().optional(),
  reminders: z.array(z.coerce.number()
    .int('Reminder value must be a whole number')
    .min(0, 'Reminder value cannot be negative'))
    .optional()
    .default([]),
  plans: z.array(studySessionPlanSchema)
    .min(1, 'Add at least one study session')
    .max(20, 'You can create up to 20 sessions at once'),
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
  reminder_enabled: z.boolean()
  .optional(),
  reminders: z.array(z.coerce.number()
    .int('Reminder value must be a whole number')
    .min(0, 'Reminder value cannot be negative'))
  .optional(),
  study_session_scheduled_at: z.coerce.date()
  .refine((date) => date >= new Date(),
    { message: "Scheduled time must be in the future" }
  )
  .optional(),
  status: z.enum(['idle', 'running', 'paused', 'completed'])
  .optional(),
  started_at: z.coerce.date()
  .optional(),
  current_time: z.coerce.number()
  .int('Current time must be whole seconds')
  .min(0)
  .optional(),
  completed_at: z.coerce.date()
  .optional(),
  actual_duration: z.coerce.number()
  .int('Actual duration must be whole seconds')
  .min(0)
  .optional()
});

export type CreateStudyInput = z.infer<typeof createStudySchema>;
export type CreateStudyBatchInput = z.infer<typeof createStudyBatchSchema>;
export type UpdateStudyInput = z.infer<typeof updateStudySchema>;
