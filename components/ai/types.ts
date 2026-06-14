export type ChatStatus = "submitted" | "streaming" | "ready" | "error";

export type FileUIPart = {
  type: "file";
  mediaType?: string;
  filename?: string;
  url?: string;
};

export type UIMessage = {
  role: "system" | "user" | "assistant";
};
