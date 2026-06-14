export const AI_READABLE_FILE_EXTENSIONS = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".gif",
] as const;

export const AI_READABLE_ATTACHMENT_HELPER_TEXT = `AI can read: ${AI_READABLE_FILE_EXTENSIONS.join(", ")}`;

export const AI_READABLE_MIME_TYPES: ReadonlySet<string> = new Set([
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]);
