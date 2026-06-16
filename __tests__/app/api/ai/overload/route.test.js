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
  runOverloadDetector: jest.fn(),
}));

jest.mock("@/lib/services/overloadService", () => ({
  getOverloadWarningsForUser: jest.fn(),
  markWarningAsRead: jest.fn(),
}));

import { POST, GET, PATCH } from "@/app/api/ai/overload/route";
import { getSession } from "@/lib/firebase/auth";
import { runOverloadDetector } from "@/lib/services/aiService";
import {
  getOverloadWarningsForUser,
  markWarningAsRead,
} from "@/lib/services/overloadService";

function jsonRequest(body) {
  return { json: async () => body };
}

function getRequest(url) {
  return { url };
}

describe("/api/ai/overload auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("POST rejects unauthenticated callers with 401", async () => {
    getSession.mockResolvedValue(null);

    const response = await POST(
      jsonRequest({ target_date: "2099-06-20T00:00:00.000Z" }),
    );

    expect(response.status).toBe(401);
    expect(runOverloadDetector).not.toHaveBeenCalled();
  });

  it("POST uses the session user, ignoring any user_id in the body", async () => {
    getSession.mockResolvedValue({ id: "session-user" });
    runOverloadDetector.mockResolvedValue({ warnings: [] });

    const response = await POST(
      jsonRequest({
        target_date: "2099-06-20T00:00:00.000Z",
        user_id: "attacker-controlled",
      }),
    );

    expect(response.status).toBe(200);
    expect(runOverloadDetector).toHaveBeenCalledWith(
      "session-user",
      expect.any(Date),
      expect.any(Date),
    );
  });

  it("GET rejects unauthenticated callers with 401", async () => {
    getSession.mockResolvedValue(null);

    const response = await GET(
      getRequest("http://localhost/api/ai/overload?user_id=attacker"),
    );

    expect(response.status).toBe(401);
    expect(getOverloadWarningsForUser).not.toHaveBeenCalled();
  });

  it("GET fetches warnings for the session user, ignoring the query user_id", async () => {
    getSession.mockResolvedValue({ id: "session-user" });
    getOverloadWarningsForUser.mockResolvedValue([]);

    const response = await GET(
      getRequest("http://localhost/api/ai/overload?user_id=attacker&limit=5"),
    );

    expect(response.status).toBe(200);
    expect(getOverloadWarningsForUser).toHaveBeenCalledWith("session-user", 5);
  });

  it("PATCH rejects unauthenticated callers with 401", async () => {
    getSession.mockResolvedValue(null);

    const response = await PATCH(jsonRequest({ warning_id: 1 }));

    expect(response.status).toBe(401);
    expect(markWarningAsRead).not.toHaveBeenCalled();
  });
});
