import { GET, PUT } from "@/app/api/users/me/route";
import { getSession } from "@/lib/firebase/auth";
import {
  getUserProfileForSession,
  updateUserProfile,
} from "@/lib/services/userService";
import { NextRequest } from "next/server";

jest.mock("next/server", () => ({
  NextResponse: {
    json: (body: unknown, init: ResponseInit = {}) => ({
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

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockGetUserProfileForSession = getUserProfileForSession as jest.MockedFunction<typeof getUserProfileForSession>;
const mockUpdateUserProfile = updateUserProfile as jest.MockedFunction<typeof updateUserProfile>;

type GetSessionResolved = Awaited<ReturnType<typeof getSession>>;
type GetUserProfileResolved = Awaited<ReturnType<typeof getUserProfileForSession>>;
type UpdateUserProfileResolved = Awaited<ReturnType<typeof updateUserProfile>>;

// Helper to simulate NextRequest body context using safe object records
function request(body: Record<string, unknown>): NextRequest {
  return {
    json: async () => body,
  } as unknown as NextRequest;
}

const session = {
  id: "uid-1",
  email: "student@example.com",
  name: "Firebase Student",
  image: "https://avatar.test/firebase.png",
};

// Interface helper for structured validation errors in testing response bodies
interface ValidationErrorBody {
  message?: string;
  errors?: {
    name?: string[];
  };
}

describe("/api/users/me", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetSession.mockResolvedValue(session as GetSessionResolved);

    mockGetUserProfileForSession.mockResolvedValue({
      id: "uid-1",
      email: "student@example.com",
      name: "Custom Scholar",
      image: "https://avatar.test/app.png",
    } as GetUserProfileResolved);

    mockUpdateUserProfile.mockResolvedValue({
      id: "uid-1",
      email: "student@example.com",
      name: "Grace Hopper",
      image: "https://avatar.test/app.png",
    } as UpdateUserProfileResolved);
  });

  it("returns the Prisma-backed app profile for the current user", async () => {
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockGetUserProfileForSession).toHaveBeenCalledWith(session);
    expect(body).toEqual({
      id: "uid-1",
      email: "student@example.com",
      name: "Custom Scholar",
      image: "https://avatar.test/app.png",
    });
  });

  it("returns 401 when the user is not authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await PUT(request({ name: "Nope" }));
    const body = await response.json() as { error: string };

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(mockUpdateUserProfile).not.toHaveBeenCalled();
  });

  it("trims and saves the app display name", async () => {
    const response = await PUT(
      request({ name: "    Grace Hopper   ", image: "https://avatar.test/app.png" }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(mockUpdateUserProfile).toHaveBeenCalledWith("uid-1", {
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
    const body = await response.json() as ValidationErrorBody;

    expect(response.status).toBe(400);
    expect(body.message).toBe("Validation failed");
    expect(body.errors?.name).toContain("Name cannot be empty");
    expect(mockUpdateUserProfile).not.toHaveBeenCalled();
  });
});