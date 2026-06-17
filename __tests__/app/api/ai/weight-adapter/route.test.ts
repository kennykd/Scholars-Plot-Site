import { POST } from "@/app/api/ai/weight-adapter/route";
import { getSession } from "@/lib/firebase/auth";
import {
  runWeightAdapter,
  runWeightAdapterForAllUsers,
} from "@/lib/services/aiService";
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

jest.mock("@/lib/services/aiService", () => ({
  runWeightAdapter: jest.fn(),
  runWeightAdapterForAllUsers: jest.fn(),
}));

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockRunWeightAdapter = runWeightAdapter as jest.MockedFunction<typeof runWeightAdapter>;
const mockRunWeightAdapterForAllUsers = runWeightAdapterForAllUsers as jest.MockedFunction<typeof runWeightAdapterForAllUsers>;

type GetSessionResolved = Awaited<ReturnType<typeof getSession>>;
type RunWeightAdapterResolved = Awaited<ReturnType<typeof runWeightAdapter>>;
type RunWeightAdapterForAllUsersResolved = Awaited<ReturnType<typeof runWeightAdapterForAllUsers>>;

function request(body: Record<string, unknown>, headers: Record<string, string> = {}): NextRequest {
  return {
    json: async () => body,
    headers: { get: (key: string) => headers[key] ?? null } as unknown as Headers,
  } as unknown as NextRequest;
}

describe("POST /api/ai/weight-adapter", () => {
  const originalSecret = process.env.CRON_SECRET;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env.CRON_SECRET = "cron-secret";
  });

  afterAll(() => {
    process.env.CRON_SECRET = originalSecret;
  });

  it("rejects an all-users run without the cron secret", async () => {
    const response = await POST(request({ run_all_users: true }));

    expect(response.status).toBe(401);
    expect(mockRunWeightAdapterForAllUsers).not.toHaveBeenCalled();
  });

  it("runs the all-users batch when the cron secret matches", async () => {
    mockRunWeightAdapterForAllUsers.mockResolvedValue({ total: 3, succeeded: 3 } as RunWeightAdapterForAllUsersResolved);

    const response = await POST(
      request({ run_all_users: true }, { "x-cron-secret": "cron-secret" }),
    );

    expect(response.status).toBe(200);
    expect(mockRunWeightAdapterForAllUsers).toHaveBeenCalled();
    expect(mockGetSession).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated single-user run with 401", async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await POST(request({}));

    expect(response.status).toBe(401);
    expect(mockRunWeightAdapter).not.toHaveBeenCalled();
  });

  it("adapts weights for the session user, ignoring body user_id", async () => {
    mockGetSession.mockResolvedValue({ id: "session-user" } as GetSessionResolved);
    mockRunWeightAdapter.mockResolvedValue({ adapted: true } as unknown as RunWeightAdapterResolved);

    const response = await POST(request({ user_id: "attacker" }));

    expect(response.status).toBe(200);
    expect(mockRunWeightAdapter).toHaveBeenCalledWith("session-user");
  });
});