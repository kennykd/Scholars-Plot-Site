import { GET } from "@/app/api/notifications/route";
import { getSession } from "@/lib/firebase/auth";
import { getActiveNotificationsForUser } from "@/lib/services/notificationService";

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
  getActiveNotificationsForUser: jest.fn(),
}));

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockGetActiveNotificationsForUser =
  getActiveNotificationsForUser as jest.MockedFunction<
    typeof getActiveNotificationsForUser
  >;

type GetSessionResolved = Awaited<ReturnType<typeof getSession>>;
type NotificationsResolved = Awaited<
  ReturnType<typeof getActiveNotificationsForUser>
>;

describe("GET /api/notifications", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetSession.mockResolvedValue({ id: "user-1" } as GetSessionResolved);
    mockGetActiveNotificationsForUser.mockResolvedValue([
      {
        id: "1",
        title: "Study session",
        body: "Starts soon",
        url: "/study/1",
        tag: "study-reminder:1",
        read: false,
        createdAt: "2026-06-17T10:00:00.000Z",
      },
    ] as NotificationsResolved);
  });

  it("rejects unauthenticated requests", async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await GET();
    const body = await response.json() as { error: string };

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mockGetActiveNotificationsForUser).not.toHaveBeenCalled();
  });

  it("returns the authenticated user's active notifications", async () => {
    const response = await GET();
    const body = await response.json() as { notifications: unknown[] };

    expect(response.status).toBe(200);
    expect(mockGetActiveNotificationsForUser).toHaveBeenCalledWith("user-1");
    expect(body.notifications).toEqual([
      expect.objectContaining({
        id: "1",
        title: "Study session",
      }),
    ]);
  });
});
