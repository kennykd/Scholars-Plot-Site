import { GET, POST } from "@/app/api/chat/route";
import { getSession } from "@/lib/firebase/auth";
import { runChatAgent } from "@/lib/ai/chatAgent";
import {
  buildChatContext,
  createConversation,
  getConversation,
  listConversations,
  saveMessagePair,
  setConversationTitle,
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

jest.mock("@/lib/ai/chatAgent", () => ({
  runChatAgent: jest.fn(),
}));

jest.mock("@/lib/services/chatService", () => ({
  buildChatContext: jest.fn(),
  createConversation: jest.fn(),
  getConversation: jest.fn(),
  listConversations: jest.fn(),
  saveMessagePair: jest.fn(),
  setConversationTitle: jest.fn(),
}));

const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockRunChatAgent = runChatAgent as jest.MockedFunction<typeof runChatAgent>;
const mockBuildChatContext = buildChatContext as jest.MockedFunction<typeof buildChatContext>;
const mockCreateConversation = createConversation as jest.MockedFunction<typeof createConversation>;
const mockGetConversation = getConversation as jest.MockedFunction<typeof getConversation>;
const mockListConversations = listConversations as jest.MockedFunction<typeof listConversations>;
const mockSaveMessagePair = saveMessagePair as jest.MockedFunction<typeof saveMessagePair>;
const mockSetConversationTitle = setConversationTitle as jest.MockedFunction<typeof setConversationTitle>;

type GetSessionResolved = Awaited<ReturnType<typeof getSession>>;
type RunChatAgentResolved = Awaited<ReturnType<typeof runChatAgent>>;
type BuildChatContextResolved = Awaited<ReturnType<typeof buildChatContext>>;
type CreateConversationResolved = Awaited<ReturnType<typeof createConversation>>;
type GetConversationResolved = Awaited<ReturnType<typeof getConversation>>;
type ListConversationsResolved = Awaited<ReturnType<typeof listConversations>>;
type SaveMessagePairResolved = Awaited<ReturnType<typeof saveMessagePair>>;
type SetConversationTitleResolved = Awaited<ReturnType<typeof setConversationTitle>>;

interface ChatTurnResponse {
  conversation_id: number;
  assistant_message_id: number;
  text: string;
}

interface ListConversationsResponse {
  conversations: Array<{ id: number; title: string }>;
}

interface ErrorResponse {
  error: string;
}

function jsonRequest(body: Record<string, unknown>): NextRequest {
  return {
    json: async () => body,
    url: "https://api.test/api/chat",
  } as unknown as NextRequest;
}

describe("/api/chat", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetSession.mockResolvedValue({ id: "user-1" } as GetSessionResolved);
    mockCreateConversation.mockResolvedValue({ id: 9 } as CreateConversationResolved);
    mockGetConversation.mockResolvedValue({ id: 9, messages: [] } as unknown as GetConversationResolved);
    mockBuildChatContext.mockResolvedValue({ context: true } as unknown as BuildChatContextResolved);

    mockRunChatAgent.mockResolvedValue({
      text: "Draft ready.",
      action: { type: "CREATE_TASK_DRAFT", payload: { title: "Lab" } },
      rawResponse: "Draft ready.",
    } as RunChatAgentResolved);

    mockSaveMessagePair.mockResolvedValue({
      userMessage: { id: 21 },
      assistantMessage: { id: 22 },
    } as SaveMessagePairResolved);

    mockSetConversationTitle.mockResolvedValue({} as SetConversationTitleResolved);
    mockListConversations.mockResolvedValue([{ id: 9, title: "Lab" }] as ListConversationsResolved);
  });

  it("creates a chat turn for the authenticated session user without trusting client user_id", async () => {
    const response = await POST(
      jsonRequest({
        user_id: "attacker",
        message: "Add a lab task",
      }),
    );
    const body = await response.json() as ChatTurnResponse;

    expect(response.status).toBe(200);
    expect(mockCreateConversation).toHaveBeenCalledWith("user-1");
    expect(mockBuildChatContext).toHaveBeenCalledWith("user-1");
    expect(mockSaveMessagePair).toHaveBeenCalledWith(
      9,
      "Add a lab task",
      "Draft ready.",
      { type: "CREATE_TASK_DRAFT", payload: { title: "Lab" } },
    );
    expect(body).toEqual(
      expect.objectContaining({
        conversation_id: 9,
        assistant_message_id: 22,
        text: "Draft ready.",
      }),
    );
  });

  it("lists conversations for the authenticated session user", async () => {
    const response = await GET();
    const body = await response.json() as ListConversationsResponse;

    expect(response.status).toBe(200);
    expect(mockListConversations).toHaveBeenCalledWith("user-1");
    expect(body.conversations).toEqual([{ id: 9, title: "Lab" }]);
  });

  it("returns 401 when no user is authenticated", async () => {
    mockGetSession.mockResolvedValue(null);

    const response = await POST(jsonRequest({ message: "Hello" }));
    const body = await response.json() as ErrorResponse;

    expect(response.status).toBe(401);
    expect(body.error).toMatch(/not authenticated/i);
    expect(mockCreateConversation).not.toHaveBeenCalled();
  });

  it("does not create an empty saved conversation when a new chat turn fails", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => { });
    mockRunChatAgent.mockRejectedValue(new Error("Gemini failed"));

    const response = await POST(jsonRequest({ message: "Hello" }));
    const body = await response.json() as ErrorResponse;

    expect(response.status).toBe(500);
    expect(body.error).toMatch(/failed to process/i);
    expect(mockCreateConversation).not.toHaveBeenCalled();
    expect(mockSaveMessagePair).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});