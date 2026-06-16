jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    user: {
      findUnique: jest.fn(),
      update: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
import {
  ensureUserRecordForSession,
  getUserProfileForSession,
} from "@/lib/services/userService";

const mockUser = prisma.user as jest.Mocked<typeof prisma.user>;

describe("ensureUserRecordForSession", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2026-06-13T12:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("updates an existing Firebase UID user without overwriting the app display name", async () => {
    mockUser.findUnique.mockResolvedValueOnce({
      user_id: "uid-1",
      user_email: "student@example.com",
      user_name: "Old Name",
      avatar_url: null,
    } as never);
    mockUser.update.mockResolvedValue({
      user_id: "uid-1",
      user_email: "student@example.com",
      user_name: "Old Name",
      avatar_url: "https://avatar.test/me.png",
    } as never);

    await ensureUserRecordForSession({
      id: "uid-1",
      email: "student@example.com",
      name: "Student",
      image: "https://avatar.test/me.png",
    });

    expect(mockUser.update).toHaveBeenCalledWith({
      where: { user_id: "uid-1" },
      data: {
        user_email: "student@example.com",
        avatar_url: "https://avatar.test/me.png",
        user_last_login: new Date("2026-06-13T12:00:00.000Z"),
      },
      select: expect.any(Object),
    });
    expect(mockUser.create).not.toHaveBeenCalled();
  });

  it("repairs an existing email row whose user_id differs from Firebase UID", async () => {
    mockUser.findUnique
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce({
        user_id: "old-uid",
        user_email: "student@example.com",
        user_name: "Student",
        avatar_url: null,
      } as never);
    mockUser.update.mockResolvedValue({
      user_id: "uid-1",
      user_email: "student@example.com",
      user_name: "Student",
      avatar_url: null,
    } as never);

    await ensureUserRecordForSession({
      id: "uid-1",
      email: "student@example.com",
      name: null,
      image: null,
    });

    expect(mockUser.update).toHaveBeenCalledWith({
      where: { user_email: "student@example.com" },
      data: {
        user_id: "uid-1",
        user_last_login: new Date("2026-06-13T12:00:00.000Z"),
      },
      select: expect.any(Object),
    });
    expect(mockUser.create).not.toHaveBeenCalled();
  });

  it("creates a user when neither UID nor email exists", async () => {
    mockUser.findUnique
      .mockResolvedValueOnce(null as never)
      .mockResolvedValueOnce(null as never);
    mockUser.create.mockResolvedValue({
      user_id: "uid-1",
      user_email: "student@example.com",
      user_name: "Student",
      avatar_url: null,
    } as never);

    await ensureUserRecordForSession({
      id: "uid-1",
      email: "student@example.com",
      name: "Student",
      image: null,
    });

    expect(mockUser.create).toHaveBeenCalledWith({
      data: {
        user_id: "uid-1",
        user_email: "student@example.com",
        user_name: "Student",
        avatar_url: null,
        user_last_login: new Date("2026-06-13T12:00:00.000Z"),
      },
      select: expect.any(Object),
    });
  });

  it("reads the app display name from Prisma instead of Firebase claims", async () => {
    mockUser.findUnique.mockResolvedValueOnce({
      user_id: "uid-1",
      user_email: "student@example.com",
      user_name: "Custom Scholar",
      avatar_url: "https://avatar.test/app.png",
    } as never);

    const user = await getUserProfileForSession({
      id: "uid-1",
      email: "student@example.com",
      name: "Firebase Student",
      image: "https://avatar.test/firebase.png",
    });

    expect(user).toEqual({
      id: "uid-1",
      email: "student@example.com",
      name: "Custom Scholar",
      image: "https://avatar.test/app.png",
    });
  });
});
