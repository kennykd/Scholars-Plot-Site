import { POST } from "@/app/api/study/attachment/route";
import { getSession } from "@/lib/firebase/auth";
import { ensureUserRecordForSession } from "@/lib/services/userService";
import { addStudyAttachmentForUser } from "@/lib/services/attachmentService";
import { linkAttachmentToStudySessions } from "@/lib/services/studySessionService";
import { NextRequest } from "next/server";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init: ResponseInit = {}) => ({
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
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }

  return {
    addStudyAttachmentForUser: jest.fn(),
    AttachmentServiceError,
  };
});

jest.mock("@/lib/services/studySessionService", () => {
  class StudySessionServiceError extends Error {
    status: number;

    constructor(status: number, message: string) {
      super(message);
      this.status = status;
    }
  }

  return {
    linkAttachmentToStudySessions: jest.fn(),
    StudySessionServiceError,
  };
});

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockEnsureUserRecordForSession = ensureUserRecordForSession as jest.MockedFunction<typeof ensureUserRecordForSession>;
const mockAddStudyAttachmentForUser = addStudyAttachmentForUser as jest.MockedFunction<typeof addStudyAttachmentForUser>;
const mockLinkAttachmentToStudySessions = linkAttachmentToStudySessions as jest.MockedFunction<typeof linkAttachmentToStudySessions>;

type GetSessionResolved = Awaited<ReturnType<typeof getSession>>;
type EnsureUserRecordResolved = Awaited<ReturnType<typeof ensureUserRecordForSession>>;
type AddStudyAttachmentResolved = Awaited<ReturnType<typeof addStudyAttachmentForUser>>;

interface ErrorResponse {
  message: string;
}

interface AttachmentResponse {
  attachment: {
    id: number;
    fileName: string;
  };
}

function formRequest(formData: FormData): NextRequest {
  return {
    formData: async () => formData,
  } as unknown as NextRequest;
}

describe("POST /api/study/attachment", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockEnsureUserRecordForSession.mockResolvedValue({
      id: "user-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    } as EnsureUserRecordResolved);
  });

  it("returns 401 when unauthenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await POST(formRequest(new FormData()));

    expect(response.status).toBe(401);
    expect(mockAddStudyAttachmentForUser).not.toHaveBeenCalled();
  });

  it("uploads and links a study attachment to requested study sessions", async () => {
    mockGetSession.mockResolvedValue({
      id: "user-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    } as GetSessionResolved);

    mockAddStudyAttachmentForUser.mockResolvedValue({
      id: 9,
      fileName: "mechanics.pdf",
    } as AddStudyAttachmentResolved);

    const form = new FormData();
    const file = new File(["pdf"], "mechanics.pdf", { type: "application/pdf" });

    Object.defineProperty(file, "arrayBuffer", {
      value: jest.fn().mockResolvedValue(new TextEncoder().encode("pdf").buffer),
    });
    form.set("file", file);
    form.set("studySessionIds", JSON.stringify([11, 12]));

    const response = await POST(formRequest(form));
    const body = await response.json() as AttachmentResponse;

    expect(response.status).toBe(201);
    expect(mockEnsureUserRecordForSession).toHaveBeenCalledWith({
      id: "user-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    });

    expect(
      mockEnsureUserRecordForSession.mock.invocationCallOrder[0],
    ).toBeLessThan(mockAddStudyAttachmentForUser.mock.invocationCallOrder[0]);

    expect(mockAddStudyAttachmentForUser).toHaveBeenCalledWith(
      "user-1",
      expect.objectContaining({
        name: "mechanics.pdf",
        type: "application/pdf",
      }),
    );

    expect(mockLinkAttachmentToStudySessions).toHaveBeenCalledWith("user-1", 9, [
      11,
      12,
    ]);
    expect(body.attachment.fileName).toBe("mechanics.pdf");
  });

  it("rejects missing study session ids", async () => {
    mockGetSession.mockResolvedValue({ id: "user-1" } as GetSessionResolved);

    const form = new FormData();
    form.set("file", new File(["pdf"], "mechanics.pdf", { type: "application/pdf" }));

    const response = await POST(formRequest(form));
    const body = await response.json() as ErrorResponse;

    expect(response.status).toBe(400);
    expect(body.message).toMatch(/study session/i);
    expect(mockAddStudyAttachmentForUser).not.toHaveBeenCalled();
  });
});