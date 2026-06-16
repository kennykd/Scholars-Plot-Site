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

jest.mock("next/headers", () => ({
  cookies: jest.fn(),
}));

jest.mock("@/lib/firebase/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/firebase/firebase-admin", () => ({
  adminAuth: {},
}));

jest.mock("@/lib/services/userService", () => ({
  deleteUserById: jest.fn(),
  getUserProfileForSession: jest.fn(),
  updateUserProfile: jest.fn(),
}));

import { GET, PUT } from "@/app/api/users/me/route";
import { getSession } from "@/lib/firebase/auth";
import {
  getUserProfileForSession,
  updateUserProfile,
} from "@/lib/services/userService";

function request(body) {
  return {
    json: async () => body,
  };
}

const session = {
  id: "uid-1",
  email: "student@example.com",
  name: "Firebase Student",
  image: "https://avatar.test/firebase.png",
};

describe("/api/users/me", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSession.mockResolvedValue(session);
    getUserProfileForSession.mockResolvedValue({
      id: "uid-1",
      email: "student@example.com",
      name: "Custom Scholar",
      image: "https://avatar.test/app.png",
    });
    updateUserProfile.mockResolvedValue({
      id: "uid-1",
      email: "student@example.com",
      name: "Grace Hopper",
      image: "https://avatar.test/app.png",
    });
  });

  it("returns the Prisma-backed app profile for the current user", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getUserProfileForSession).toHaveBeenCalledWith(session);
    expect(body).toEqual({
      id: "uid-1",
      email: "student@example.com",
      name: "Custom Scholar",
      image: "https://avatar.test/app.png",
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    getSession.mockResolvedValue(null);

    const response = await PUT(request({ name: "Nope" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(updateUserProfile).not.toHaveBeenCalled();
  });

  it("trims and saves the app display name", async () => {
    const response = await PUT(
      request({ name: "  Grace Hopper  ", image: "https://avatar.test/app.png" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateUserProfile).toHaveBeenCalledWith("uid-1", {
      name: "Grace Hopper",
      image: "https://avatar.test/app.png",
    });
    expect(body).toEqual({
      message: "User updated successfully",
      user: {
        id: "uid-1",
        email: "student@example.com",
        name: "Grace Hopper",
        image: "https://avatar.test/app.png",
      },
    });
  });

  it("rejects blank display names after trimming", async () => {
    const response = await PUT(request({ name: "   " }));
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.message).toBe("Validation failed");
    expect(body.errors.name).toContain("Name cannot be empty");
    expect(updateUserProfile).not.toHaveBeenCalled();
  });
});
