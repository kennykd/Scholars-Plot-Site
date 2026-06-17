import { DELETE, GET, PATCH } from "@/app/api/chat/[conversationId]/route";
import { getSession } from "@/lib/firebase/auth";
import {
  deleteConversation,
  getConversation,
  updateMessageActionStatus,
} from "@/lib/services/chatService";
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

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockGetConversation = getConversation as jest.MockedFunction<typeof getConversation>;
const mockDeleteConversation = deleteConversation as jest.MockedFunction<typeof deleteConversation>;
const mockUpdateMessageActionStatus = updateMessageActionStatus as jest.MockedFunction<typeof updateMessageActionStatus>;

type GetSessionResolved = Awaited<ReturnType<typeof getSession>>;
type GetConversationResolved = Awaited<ReturnType<typeof getConversation>>;
type DeleteConversationResolved = Awaited<ReturnType<typeof deleteConversation>>;
type UpdateMessageActionStatusResolved = Awaited<ReturnType<typeof updateMessageActionStatus>>;

interface RouteContext {
  params: Promise<{ conversationId: string }>;
}

interface ConversationResponseBody {
  conversation?: Record<string, unknown> | null;
  success?: boolean;
  deleted_id?: number;
  message_id?: number;
  action_status?: string;
  error?: string;
}

function context(id = "9"): RouteContext {
  return { params: Promise.resolve({ conversationId: id }) };
}

function request(body: Record<string, unknown>, url = "https://api.test/api/chat/9"): NextRequest {
  return {
    url,
    json: async () => body,
  } as unknown as NextRequest;
}

describe("/api/chat/[conversationId]", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetSession.mockResolvedValue({ id: "user-1" } as GetSessionResolved);
    mockGetConversation.mockResolvedValue({ id: 9, messages: [] } as unknown as GetConversationResolved);
    mockDeleteConversation.mockResolvedValue({ id: 9 } as DeleteConversationResolved);
    mockUpdateMessageActionStatus.mockResolvedValue({ id: 22 } as UpdateMessageActionStatusResolved);
  });

  it("gets a conversation for the authenticated session user", async () => {
    const response = await GET(
      { url: "https://api.test/api/chat/9?user_id=attacker" } as NextRequest,
      context(),
    );
    const body = await response.json() as ConversationResponseBody;

    expect(response.status).toBe(200);
    expect(mockGetConversation).toHaveBeenCalledWith(9, "user-1");
    expect(body.conversation).toEqual({ id: 9, messages: [] });
  });

  it("deletes a conversation for the authenticated session user", async () => {
    const response = await DELETE(request({ user_id: "attacker" }), context());
    const body = await response.json() as ConversationResponseBody;

    expect(response.status).toBe(200);
    expect(mockDeleteConversation).toHaveBeenCalledWith(9, "user-1");
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
    const body = await response.json() as ConversationResponseBody;

    expect(response.status).toBe(200);
    expect(mockUpdateMessageActionStatus).toHaveBeenCalledWith(
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
    mockGetConversation.mockResolvedValue(null);

    const response = await GET(
      { url: "https://api.test/api/chat/9" } as NextRequest,
      context(),
    );
    const body = await response.json() as ConversationResponseBody;

    expect(response.status).toBe(404);
    expect(body.error).toMatch(/not found/i);
  });

  it("returns 401 when no user is authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await GET(
      { url: "https://api.test/api/chat/9" } as NextRequest,
      context(),
    );

    expect(response.status).toBe(401);
    expect(mockGetConversation).not.toHaveBeenCalled();
  });
});