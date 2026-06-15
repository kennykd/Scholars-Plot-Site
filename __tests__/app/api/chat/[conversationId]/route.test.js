jest.mock("next/server", () => ({
  NextResponse: {
    json: (body, init = {}) => ({
      status: init.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock("@/lib/firebase/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/generated/prisma/client", () => ({
  ActionStatus: {
    confirmed: "confirmed",
    dismissed: "dismissed",
  },
}));

jest.mock("@/lib/services/chatService", () => ({
  deleteConversation: jest.fn(),
  getConversation: jest.fn(),
  updateMessageActionStatus: jest.fn(),
}));

import { DELETE, GET, PATCH } from "@/app/api/chat/[conversationId]/route";
import { getSession } from "@/lib/firebase/auth";
import {
  deleteConversation,
  getConversation,
  updateMessageActionStatus,
} from "@/lib/services/chatService";

function context(id = "9") {
  return { params: Promise.resolve({ conversationId: id }) };
}

function request(body, url = "http://localhost/api/chat/9") {
  return {
    url,
    json: async () => body,
  };
}

describe("/api/chat/[conversationId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSession.mockResolvedValue({ id: "user-1" });
    getConversation.mockResolvedValue({ id: 9, messages: [] });
    deleteConversation.mockResolvedValue({ id: 9 });
    updateMessageActionStatus.mockResolvedValue({ id: 22 });
  });

  it("gets a conversation for the authenticated session user", async () => {
    const response = await GET(
      { url: "http://localhost/api/chat/9?user_id=attacker" },
      context(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(getConversation).toHaveBeenCalledWith(9, "user-1");
    expect(body.conversation).toEqual({ id: 9, messages: [] });
  });

  it("deletes a conversation for the authenticated session user", async () => {
    const response = await DELETE(request({ user_id: "attacker" }), context());
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(deleteConversation).toHaveBeenCalledWith(9, "user-1");
    expect(body).toEqual({ success: true, deleted_id: 9 });
  });

  it("patches action status for the authenticated session user", async () => {
    const response = await PATCH(
      request({
        user_id: "attacker",
        message_id: 22,
        action_status: "confirmed",
      }),
      context(),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(updateMessageActionStatus).toHaveBeenCalledWith(
      22,
      "user-1",
      "confirmed",
    );
    expect(body).toEqual({
      success: true,
      message_id: 22,
      action_status: "confirmed",
    });
  });

  it("returns 404 when a conversation belongs to another user", async () => {
    getConversation.mockResolvedValue(null);

    const response = await GET(
      { url: "http://localhost/api/chat/9" },
      context(),
    );
    const body = await response.json();

    expect(response.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 401 when no user is authenticated", async () => {
    getSession.mockResolvedValue(null);

    const response = await GET(
      { url: "http://localhost/api/chat/9" },
      context(),
    );

    expect(response.status).toBe(401);
    expect(getConversation).not.toHaveBeenCalled();
  });
});
