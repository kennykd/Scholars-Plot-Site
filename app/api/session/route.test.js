jest.mock("@/lib/firebase/firebase-admin", () => ({
  adminAuth: {
    verifyIdToken: jest.fn(),
  },
}));

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body, init = {}) => {
      let setCookieHeader = null;

      return {
        status: init.status ?? 200,
        json: async () => body,
        headers: {
          get: (name) =>
            name.toLowerCase() === "set-cookie" ? setCookieHeader : null,
        },
        cookies: {
          set: (name, value, options = {}) => {
            const path = options.path ? `; Path=${options.path}` : "";
            const httpOnly = options.httpOnly ? "; HttpOnly" : "";
            const secure = options.secure ? "; Secure" : "";
            setCookieHeader = `${name}=${value}${path}${httpOnly}${secure}`;
          },
        },
      };
    },
  },
}));

import { POST } from "./route";
import { adminAuth } from "@/lib/firebase/firebase-admin";

describe("POST /api/session", () => {
  beforeEach(() => {
    adminAuth.verifyIdToken.mockReset();
  });

  test("returns 401 when Authorization header is missing", async () => {
    const req = {
      headers: {
        get: jest.fn().mockReturnValue(null),
      },
    };

    const response = await POST(req);
    const data = await response.json();

    expect(response.status).toBe(401);
    expect(data.error).toBe("Unauthorized");
    expect(adminAuth.verifyIdToken).not.toHaveBeenCalled();
  });

  test("verifies token and sets session cookie", async () => {
    const token = "test-id-token";
    const req = {
      headers: {
        get: jest.fn().mockReturnValue(`Bearer ${token}`),
      },
    };

    adminAuth.verifyIdToken.mockResolvedValue({ uid: "user-1" });

    const response = await POST(req);
    const data = await response.json();
    const cookie = response.headers.get("set-cookie");

    expect(adminAuth.verifyIdToken).toHaveBeenCalledWith(token, true);
    expect(response.status).toBe(200);
    expect(data.status).toBe("success");
    expect(cookie).toContain(`session=${token}`);
    expect(cookie).toContain("Path=/");
    expect(cookie).toContain("HttpOnly");
    expect(cookie).toContain("Secure");
  });
});
