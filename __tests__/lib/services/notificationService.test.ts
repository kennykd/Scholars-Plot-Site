import prisma from "@/lib/prisma";
import {
  createUserNotification,
  dismissNotificationForUser,
  getActiveNotificationsForUser,
} from "@/lib/services/notificationService";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    userNotification: {
      create: jest.fn(),
      findFirst: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
      upsert: jest.fn(),
    },
  },
}));

const notificationRow = {
  notification_id: 12,
  user_id: "user-1",
  title: "Study session: Physics review",
  body: "Starts in 5 minutes",
  url: "/study/1",
  tag: "study-reminder:1",
  source_key: "study-reminder:1",
  read_at: null,
  dismissed_at: null,
  created_at: new Date("2026-06-17T10:00:00.000Z"),
};

describe("notificationService", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("creates a user notification row with source key when a tag is supplied", async () => {
    (prisma.userNotification.upsert as jest.Mock).mockResolvedValue(notificationRow);

    const result = await createUserNotification("user-1", {
      title: "Study session: Physics review",
      body: "Starts in 5 minutes",
      url: "/study/1",
      tag: "study-reminder:1",
    });

    expect(prisma.userNotification.upsert).toHaveBeenCalledWith({
      where: {
        user_id_source_key: {
          user_id: "user-1",
          source_key: "study-reminder:1",
        },
      },
      update: {},
      create: {
        user_id: "user-1",
        title: "Study session: Physics review",
        body: "Starts in 5 minutes",
        url: "/study/1",
        tag: "study-reminder:1",
        source_key: "study-reminder:1",
      },
    });
    expect(result).toEqual({
      id: "12",
      title: "Study session: Physics review",
      body: "Starts in 5 minutes",
      url: "/study/1",
      tag: "study-reminder:1",
      read: false,
      createdAt: "2026-06-17T10:00:00.000Z",
    });
  });

  it("creates unkeyed notifications without collapsing by url when tag is omitted", async () => {
    (prisma.userNotification.create as jest.Mock).mockResolvedValue({
      ...notificationRow,
      notification_id: 13,
      tag: "/",
      source_key: null,
    });

    await createUserNotification("user-1", {
      title: "Plain update",
      body: "Saved to inbox",
      url: "/",
    });

    expect(prisma.userNotification.create).toHaveBeenCalledWith({
      data: {
        user_id: "user-1",
        title: "Plain update",
        body: "Saved to inbox",
        url: "/",
        tag: "/",
        source_key: null,
      },
    });
  });

  it("lists only active notifications newest first", async () => {
    (prisma.userNotification.findMany as jest.Mock).mockResolvedValue([
      notificationRow,
    ]);

    const result = await getActiveNotificationsForUser("user-1");

    expect(prisma.userNotification.findMany).toHaveBeenCalledWith({
      where: {
        user_id: "user-1",
        dismissed_at: null,
      },
      orderBy: {
        created_at: "desc",
      },
      take: 30,
    });
    expect(result).toHaveLength(1);
  });

  it("soft dismisses an owned notification and rejects cross-user rows", async () => {
    (prisma.userNotification.findFirst as jest.Mock).mockResolvedValueOnce(
      notificationRow,
    );
    (prisma.userNotification.update as jest.Mock).mockResolvedValue({
      ...notificationRow,
      read_at: new Date("2026-06-17T10:05:00.000Z"),
      dismissed_at: new Date("2026-06-17T10:05:00.000Z"),
    });

    await expect(
      dismissNotificationForUser("user-1", 12),
    ).resolves.toBe(true);

    expect(prisma.userNotification.findFirst).toHaveBeenCalledWith({
      where: {
        notification_id: 12,
        user_id: "user-1",
      },
    });
    expect(prisma.userNotification.update).toHaveBeenCalledWith({
      where: {
        notification_id: 12,
      },
      data: {
        read_at: expect.any(Date),
        dismissed_at: expect.any(Date),
      },
    });

    (prisma.userNotification.findFirst as jest.Mock).mockResolvedValueOnce(null);

    await expect(
      dismissNotificationForUser("other-user", 12),
    ).resolves.toBe(false);
  });
});
