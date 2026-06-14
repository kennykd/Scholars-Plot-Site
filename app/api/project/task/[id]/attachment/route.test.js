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

jest.mock("@/lib/services/attachmentService", () => {
  class AttachmentServiceError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
      this.name = "AttachmentServiceError";
    }
  }

  return {
    addAttachmentToProjectTask: jest.fn(),
    listProjectTaskAttachments: jest.fn(),
    AttachmentServiceError,
  };
});

import { POST } from "./route";
import { getSession } from "@/lib/firebase/auth";
import { ensureUserRecordForSession } from "@/lib/services/userService";
import { addAttachmentToProjectTask } from "@/lib/services/attachmentService";

function formRequest(formData) {
  return {
    formData: async () => formData,
  };
}

function context(id = "42") {
  return {
    params: Promise.resolve({ id }),
  };
}

describe("POST /api/project/task/[id]/attachment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSession.mockResolvedValue({
      id: "user-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    });
    ensureUserRecordForSession.mockResolvedValue({});
    addAttachmentToProjectTask.mockResolvedValue({
      id: 9,
      fileName: "brief.pdf",
    });
  });

  it("uploads a project-task attachment after ensuring the Firebase user exists", async () => {
    const form = new FormData();
    const file = new File(["pdf"], "brief.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "arrayBuffer", {
      value: jest.fn().mockResolvedValue(new TextEncoder().encode("pdf").buffer),
    });
    form.set("file", file);

    const response = await POST(formRequest(form), context());

    expect(response.status).toBe(201);
    expect(ensureUserRecordForSession).toHaveBeenCalledWith({
      id: "user-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    });
    expect(addAttachmentToProjectTask).toHaveBeenCalledWith(
      42,
      "user-1",
      expect.objectContaining({
        name: "brief.pdf",
        type: "application/pdf",
      }),
    );
  });
});
