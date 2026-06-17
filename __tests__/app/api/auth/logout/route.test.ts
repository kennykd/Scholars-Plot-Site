import { POST } from "@/app/api/auth/logout/route";

interface CookieOptions {
  path?: string;
  expires?: Date;
}

interface MockResponse {
  json: () => Promise<unknown>;
  headers: {
    get: (name: string) => string | null;
  };
  cookies: {
    set: (name: string, value: string, options?: CookieOptions) => void;
  };
}

// 1. Mock Next.js Server Components with custom cookie serializer state
jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown): MockResponse => {
      let setCookie: string | null = null;

      return {
        json: async () => body,
        headers: {
          get: (name: string) =>
            name.toLowerCase() === "set-cookie" ? setCookie : null,
        },
        cookies: {
          set: (name: string, value: string, options: CookieOptions = {}) => {
            const expires =
              options.expires instanceof Date
                ? `; Expires=${options.expires.toUTCString()}`
                : "";
            setCookie = `${name}=${value}; Path=${options.path || "/"}${expires}`;
          },
        },
      };
    },
  },
}));

interface LogoutResponseBody {
  message: string;
}

describe("POST /api/auth/logout", () => {
  test("returns correct response", async () => {
    const response = (await POST()) as unknown as MockResponse;
    const data = (await response.json()) as LogoutResponseBody;

    expect(data.message).toBe("Logged out");
    expect(response.headers.get("set-cookie")).toContain("session=");
  });
});