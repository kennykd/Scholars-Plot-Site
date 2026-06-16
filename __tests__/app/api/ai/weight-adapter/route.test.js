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

jest.mock("@/lib/services/aiService", () => ({
  runWeightAdapter: jest.fn(),
  runWeightAdapterForAllUsers: jest.fn(),
}));

import { POST } from "@/app/api/ai/weight-adapter/route";
import { getSession } from "@/lib/firebase/auth";
import {
  runWeightAdapter,
  runWeightAdapterForAllUsers,
} from "@/lib/services/aiService";

function request(body, headers = {}) {
  return {
    json: async () => body,
    headers: { get: (key) => headers[key] ?? null },
  };
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
    expect(runWeightAdapterForAllUsers).not.toHaveBeenCalled();
  });

  it("runs the all-users batch when the cron secret matches", async () => {
    runWeightAdapterForAllUsers.mockResolvedValue({ total: 3, succeeded: 3 });

    const response = await POST(
      request({ run_all_users: true }, { "x-cron-secret": "cron-secret" }),
    );

    expect(response.status).toBe(200);
    expect(runWeightAdapterForAllUsers).toHaveBeenCalled();
    expect(getSession).not.toHaveBeenCalled();
  });

  it("rejects an unauthenticated single-user run with 401", async () => {
    getSession.mockResolvedValue(null);

    const response = await POST(request({}));

    expect(response.status).toBe(401);
    expect(runWeightAdapter).not.toHaveBeenCalled();
  });

  it("adapts weights for the session user, ignoring body user_id", async () => {
    getSession.mockResolvedValue({ id: "session-user" });
    runWeightAdapter.mockResolvedValue({ adapted: true });

    const response = await POST(request({ user_id: "attacker" }));

    expect(response.status).toBe(200);
    expect(runWeightAdapter).toHaveBeenCalledWith("session-user");
  });
});
