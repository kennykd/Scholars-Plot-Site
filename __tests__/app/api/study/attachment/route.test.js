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
  addStudyAttachmentForUser: jest.fn(),
  AttachmentServiceError: class AttachmentServiceError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  },
}));

jest.mock("@/lib/services/studySessionService", () => ({
  linkAttachmentToStudySessions: jest.fn(),
  StudySessionServiceError: class StudySessionServiceError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  },
}));

import { POST } from "@/app/api/study/attachment/route";
import { getSession } from "@/lib/firebase/auth";
import { ensureUserRecordForSession } from "@/lib/services/userService";
import { addStudyAttachmentForUser } from "@/lib/services/attachmentService";
import { linkAttachmentToStudySessions } from "@/lib/services/studySessionService";

function formRequest(formData) {
  return {
    formData: async () => formData,
  };
}

describe("POST /api/study/attachment", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    ensureUserRecordForSession.mockResolvedValue({
      id: "user-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    });
  });

  it("returns 401 when unauthenticated", async () => {
    getSession.mockResolvedValue(null);

    const response = await POST(formRequest(new FormData()));

    expect(response.status).toBe(401);
    expect(addStudyAttachmentForUser).not.toHaveBeenCalled();
  });

  it("uploads and links a study attachment to requested study sessions", async () => {
    getSession.mockResolvedValue({
      id: "user-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    });
    addStudyAttachmentForUser.mockResolvedValue({
      id: 9,
      fileName: "mechanics.pdf",
    });

    const form = new FormData();
    const file = new File(["pdf"], "mechanics.pdf", { type: "application/pdf" });
    Object.defineProperty(file, "arrayBuffer", {
      value: jest.fn().mockResolvedValue(new TextEncoder().encode("pdf").buffer),
    });
    form.set("file", file);
    form.set("studySessionIds", JSON.stringify([11, 12]));

    const response = await POST(formRequest(form));
    const body = await response.json();

    expect(response.status).toBe(201);
    expect(ensureUserRecordForSession).toHaveBeenCalledWith({
      id: "user-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    });
    expect(
      ensureUserRecordForSession.mock.invocationCallOrder[0],
    ).toBeLessThan(addStudyAttachmentForUser.mock.invocationCallOrder[0]);
    expect(addStudyAttachmentForUser).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        name: "mechanics.pdf",
        type: "application/pdf",
      }),
    );
    expect(linkAttachmentToStudySessions).toHaveBeenCalledWith("user-1", 9, [
      11,
      12,
    ]);
    expect(body.attachment.fileName).toBe("mechanics.pdf");
  });

  it("rejects missing study session ids", async () => {
    getSession.mockResolvedValue({ id: "user-1" });

    const form = new FormData();
    form.set("file", new File(["pdf"], "mechanics.pdf", { type: "application/pdf" }));

    const response = await POST(formRequest(form));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toMatch(/study session/i);
    expect(addStudyAttachmentForUser).not.toHaveBeenCalled();
  });
});
