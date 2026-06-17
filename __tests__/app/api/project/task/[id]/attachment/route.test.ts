import { POST } from "@/app/api/project/task/[id]/attachment/route";
import { getSession } from "@/lib/firebase/auth";
import { ensureUserRecordForSession } from "@/lib/services/userService";
import { addAttachmentToProjectTask } from "@/lib/services/attachmentService";
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
      this.name = "AttachmentServiceError";
    }
  }

  return {
    addAttachmentToProjectTask: jest.fn(),
    listProjectTaskAttachments: jest.fn(),
    AttachmentServiceError,
  };
});

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockEnsureUserRecordForSession = ensureUserRecordForSession as jest.MockedFunction<typeof ensureUserRecordForSession>;
const mockAddAttachmentToProjectTask = addAttachmentToProjectTask as jest.MockedFunction<typeof addAttachmentToProjectTask>;

type GetSessionResolved = Awaited<ReturnType<typeof getSession>>;
type EnsureUserRecordResolved = Awaited<ReturnType<typeof ensureUserRecordForSession>>;
type AddAttachmentToProjectTaskResolved = Awaited<ReturnType<typeof addAttachmentToProjectTask>>;

function formRequest(formData: FormData): NextRequest {
  return {
    formData: async () => formData,
  } as unknown as NextRequest;
}

interface RouteContext {
  params: Promise<{ id: string }>;
}

function context(id = "42"): RouteContext {
  return {
    params: Promise.resolve({ id }),
  };
}

describe("POST /api/project/task/[id]/attachment", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetSession.mockResolvedValue({
      id: "user-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    } as GetSessionResolved);

    mockEnsureUserRecordForSession.mockResolvedValue({} as EnsureUserRecordResolved);

    mockAddAttachmentToProjectTask.mockResolvedValue({
      id: 9,
      fileName: "brief.pdf",
    } as AddAttachmentToProjectTaskResolved);
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
    expect(mockEnsureUserRecordForSession).toHaveBeenCalledWith({
      id: "user-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    });

    expect(mockAddAttachmentToProjectTask).toHaveBeenCalledWith(
      42,
      "user-1",
      expect.objectContaining({
        name: "brief.pdf",
        type: "application/pdf",
      }),
    );
  });
});