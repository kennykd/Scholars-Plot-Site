import { z } from 'zod';

export const updateUserSchema = z.object({
  name: z.string()
    .trim()
    .min(1, 'Name cannot be empty')
    .max(100, 'Name cannot exceed 100 characters')
    .optional(),
  image: z.url('Image must be a valid URL')
    .optional(),
});

export const userResponseSchema = z.object({
  id: z.string(),
  email: z.email(),
  name: z.string().nullable(),
  image: z.url().nullable(),
  emailVerified: z.boolean(),
  createdAt: z.coerce.date(),
});

export type UpdateUserInput = z.infer<typeof updateUserSchema>;
export type UserResponse = z.infer<typeof userResponseSchema>;
