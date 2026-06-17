import { POST } from "@/app/api/auth/firebase/route";
import { getAdminAuth } from "@/lib/firebase/firebase-admin";
import { ensureUserRecordForSession } from "@/lib/services/userService";
import { NextRequest } from "next/server";

interface MockResponse {
  status: number;
  json: () => Promise<unknown>;
  cookies: {
    set: jest.Mock;
  };
}

// 1. Mock Next.js Server Components
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init: ResponseInit = {}): MockResponse => ({
      status: init.status ?? 200,
      json: async () => body,
      cookies: {
        set: jest.fn(),
      },
    }),
  },
}));

jest.mock("@/lib/firebase/firebase-admin", () => ({
  getAdminAuth: jest.fn(),
}));

jest.mock("@/lib/services/userService", () => ({
  ensureUserRecordForSession: jest.fn(),
}));

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {},
}));

const mockGetAdminAuth = getAdminAuth as jest.MockedFunction<typeof getAdminAuth>;
const mockEnsureUserRecordForSession = ensureUserRecordForSession as jest.MockedFunction<typeof ensureUserRecordForSession>;

type EnsureUserRecordResolved = Awaited<ReturnType<typeof ensureUserRecordForSession>>;

interface RequestHelperOptions {
  token?: string;
  body?: Record<string, unknown>;
}

// Helper to simulate NextRequest with targeted auth headers safely across environments
function request({ token = "id-token", body = {} }: RequestHelperOptions = {}): NextRequest {
  return {
    headers: {
      get: (name: string) => (name === "Authorization" ? `Bearer ${token}` : null),
    } as unknown as Headers,
    json: async () => body,
  } as unknown as NextRequest;
}

describe("POST /api/auth/firebase", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetAdminAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({
        uid: "uid-1",
        email: "student@example.com",
        name: "Firebase Student",
        picture: "https://avatar.test/me.png",
      }),
      createSessionCookie: jest.fn().mockResolvedValue("session-cookie"),
    } as unknown as ReturnType<typeof getAdminAuth>);

    mockEnsureUserRecordForSession.mockResolvedValue({
      id: "uid-1",
      email: "student@example.com",
      name: "Firebase Student",
      image: "https://avatar.test/me.png",
    } as EnsureUserRecordResolved);
  });

  it("repairs or creates the Firebase UID user before setting a session cookie", async () => {
    const response = (await POST(request({ body: { name: "Manual Name" } }))) as unknown as MockResponse;

    expect(response.status).toBe(200);
    expect(mockEnsureUserRecordForSession).toHaveBeenCalledWith({
      id: "uid-1",
      email: "student@example.com",
      name: "Manual Name",
      image: "https://avatar.test/me.png",
    });
  });
});