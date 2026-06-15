jest.mock("next/server", () => ({
  NextResponse: {
    json: (body, init = {}) => ({
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

import { POST } from "@/app/api/auth/firebase/route";
import { getAdminAuth } from "@/lib/firebase/firebase-admin";
import { ensureUserRecordForSession } from "@/lib/services/userService";

function request({ token = "id-token", body = {} } = {}) {
  return {
    headers: {
      get: (name) => (name === "Authorization" ? `Bearer ${token}` : null),
    },
    json: async () => body,
  };
}

describe("POST /api/auth/firebase", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getAdminAuth.mockReturnValue({
      verifyIdToken: jest.fn().mockResolvedValue({
        uid: "uid-1",
        email: "student@example.com",
        name: "Firebase Student",
        picture: "https://avatar.test/me.png",
      }),
      createSessionCookie: jest.fn().mockResolvedValue("session-cookie"),
    });
    ensureUserRecordForSession.mockResolvedValue({
      id: "uid-1",
      email: "student@example.com",
      name: "Firebase Student",
      image: "https://avatar.test/me.png",
    });
  });

  it("repairs or creates the Firebase UID user before setting a session cookie", async () => {
    const response = await POST(request({ body: { name: "Manual Name" } }));

    expect(response.status).toBe(200);
    expect(ensureUserRecordForSession).toHaveBeenCalledWith({
      id: "uid-1",
      email: "student@example.com",
      name: "Manual Name",
      image: "https://avatar.test/me.png",
    });
  });
});
