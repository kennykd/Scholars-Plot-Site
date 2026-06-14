jest.mock("next/server", () => ({
  NextResponse: {
    json: (body, init = {}) => ({
      status: init.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock("@/lib/firebase/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/services/userService", () => ({
  ensureUserRecordForSession: jest.fn(),
}));

jest.mock("@/lib/services/attachmentService", () => ({
  addDraftAttachmentForUser: jest.fn(),
}));

jest.mock("@/lib/services/aiDraftService", () => ({
  generateTaskDraft: jest.fn(),
}));

import { POST } from "./route";
import { getSession } from "@/lib/firebase/auth";
import { addDraftAttachmentForUser } from "@/lib/services/attachmentService";
import { generateTaskDraft } from "@/lib/services/aiDraftService";

function formRequest(formData) {
  return {
    formData: async () => formData,
  };
}

describe("POST /api/ai/task-draft", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSession.mockResolvedValue({ id: "user-1", email: "student@example.com" });
    addDraftAttachmentForUser.mockResolvedValue({
      id: 7,
      fileName: "rubric.pdf",
      fileType: "application/pdf",
      url: "https://signed.example/rubric.pdf",
    });
    generateTaskDraft.mockResolvedValue({
      title: "Suggested title",
      description: "Suggested description",
      priority: 4,
      reasoning: "The rubric gives this task clear scope.",
      skippedAttachments: [],
    });
  });

  it("uploads selected files then asks Gemini for a task form draft", async () => {
    const form = new FormData();
    const file = new File(["pdf"], "rubric.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "arrayBuffer", {
      value: jest.fn().mockResolvedValue(new TextEncoder().encode("pdf").buffer),
    });
    form.set("title", "lab");
    form.set("description", "finish report");
    form.set("deadline", "2099-03-20T16:00:00.000Z");
    form.set("priority", "2.5");
    form.append("file", file);

    const response = await POST(formRequest(form));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(addDraftAttachmentForUser).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({ name: "rubric.pdf", type: "application/pdf" }),
    );
    expect(generateTaskDraft).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "lab",
        description: "finish report",
        priority: 2.5,
        attachments: [
          expect.objectContaining({
            fileName: "rubric.pdf",
            url: "https://signed.example/rubric.pdf",
          }),
        ],
      }),
    );
    expect(body).toEqual(
      expect.objectContaining({
        draft: expect.objectContaining({ title: "Suggested title" }),
        attachmentIds: [7],
      }),
    );
  });
});
