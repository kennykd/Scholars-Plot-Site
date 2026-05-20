import { z } from 'zod';

export const notificationSchema = z.object({
  endpoint: z.string()
    .url("Must be a valid URL")
    .startsWith("https://", "Must use HTTPS"),
  keys: z.object({
    p256dh: z.string()
      .regex(/^[A-Za-z0-9_-]+$/, "Invalid base64url format"),
    auth: z.string()
      .regex(/^[A-Za-z0-9_-]+$/, "Invalid base64url format"),
  }),
});