jest.mock("next/server", () => ({
  NextResponse: {
    json: (body, init = {}) => ({
      status: init.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock("web-push", () => ({
  __esModule: true,
  default: {
    setVapidDetails: jest.fn(),
    sendNotification: jest.fn(),
  },
}));

jest.mock("@/lib/firebase/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/services/webPushService", () => {
  const actual = jest.requireActual("@/lib/services/webPushService");
  return {
    ...actual,
    getUserPushSubscription: jest.fn(),
    clearUserPushSubscription: jest.fn(),
  };
});

import webpush from "web-push";
import { POST } from "@/app/api/web-push/send/route";
import { getSession } from "@/lib/firebase/auth";
import {
  clearUserPushSubscription,
  getUserPushSubscription,
} from "@/lib/services/webPushService";

function request(body) {
  return {
    json: async () => body,
  };
}

const originalEnv = process.env;
const storedSubscription = JSON.stringify({
  endpoint: "https://fcm.googleapis.com/fcm/send/demo",
  keys: {
    p256dh: "key",
    auth: "auth",
  },
});

describe("POST /api/web-push/send", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env = {
      ...originalEnv,
      NEXT_PUBLIC_VAPID_PUBLIC_KEY: "public-key",
      VAPID_PRIVATE_KEY: "private-key",
      VAPID_SUBJECT: "mailto:test@example.com",
    };
    getSession.mockResolvedValue({ id: "user-1" });
    getUserPushSubscription.mockResolvedValue({
      push_subscription: storedSubscription,
    });
    webpush.sendNotification.mockResolvedValue(undefined);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  it("rejects unauthenticated requests", async () => {
    getSession.mockResolvedValue(null);

    const response = await POST(request({ title: "Hi", body: "Body" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body).toEqual({ error: "Unauthorized" });
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });

  it("uses the authenticated session user, not a client-provided userID", async () => {
    await POST(
      request({
        userID: "attacker-id",
        title: "Study session",
        body: "Starts soon",
        url: "/study/1",
      }),
    );

    expect(getUserPushSubscription).toHaveBeenCalledWith("user-1");
    expect(getUserPushSubscription).not.toHaveBeenCalledWith("attacker-id");
  });

  it("sends the stored subscription with a stable notification payload", async () => {
    const response = await POST(
      request({
        title: "Study session",
        body: "Starts soon",
        url: "/study/1",
        tag: "study-reminder:1",
      }),
    );

    expect(response.status).toBe(200);
    expect(webpush.sendNotification).toHaveBeenCalledWith(
      JSON.parse(storedSubscription),
      JSON.stringify({
        title: "Study session",
        body: "Starts soon",
        tag: "study-reminder:1",
        data: { url: "/study/1" },
      }),
      expect.objectContaining({
        TTL: 60,
        timeout: 10000,
      }),
    );
  });

  it("clears stale subscriptions when the push service returns 410", async () => {
    webpush.sendNotification.mockRejectedValue({ statusCode: 410 });

    const response = await POST(
      request({
        title: "Study session",
        body: "Starts soon",
      }),
    );

    expect(response.status).toBe(410);
    expect(clearUserPushSubscription).toHaveBeenCalledWith("user-1");
  });

  it("returns a controlled error when VAPID keys are missing", async () => {
    delete process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

    const response = await POST(
      request({
        title: "Study session",
        body: "Starts soon",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toMatch(/not configured/i);
    expect(webpush.sendNotification).not.toHaveBeenCalled();
  });
});
