import { PATCH } from "@/app/api/notifications/[id]/route";
import { getSession } from "@/lib/firebase/auth";
import { dismissNotificationForUser } from "@/lib/services/notificationService";
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

jest.mock("@/lib/services/notificationService", () => ({
  dismissNotificationForUser: jest.fn(),
}));

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockDismissNotificationForUser =
  dismissNotificationForUser as jest.MockedFunction<
    typeof dismissNotificationForUser
  >;

type GetSessionResolved = Awaited<ReturnType<typeof getSession>>;

function request(body: Record<string, unknown>): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

describe("PATCH /api/notifications/[id]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({ id: "user-1" } as GetSessionResolved);
    mockDismissNotificationForUser.mockResolvedValue(true);
  });

  it("rejects unauthenticated requests", async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await PATCH(request({ action: "dismiss" }), {
      params: Promise.resolve({ id: "1" }),
    });
    const body = await response.json() as { error: string };

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
  });

  it("validates the dismiss action", async () => {
    const response = await PATCH(request({ action: "read" }), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(400);
    expect(mockDismissNotificationForUser).not.toHaveBeenCalled();
  });

  it("dismisses an owned notification", async () => {
    const response = await PATCH(request({ action: "dismiss" }), {
      params: Promise.resolve({ id: "1" }),
    });
    const body = await response.json() as { message: string };

    expect(response.status).toBe(200);
    expect(body).toEqual({ message: "Notification dismissed" });
    expect(mockDismissNotificationForUser).toHaveBeenCalledWith("user-1", 1);
  });

  it("returns 404 for another user's notification", async () => {
    mockDismissNotificationForUser.mockResolvedValue(false);

    const response = await PATCH(request({ action: "dismiss" }), {
      params: Promise.resolve({ id: "1" }),
    });

    expect(response.status).toBe(404);
  });
});
