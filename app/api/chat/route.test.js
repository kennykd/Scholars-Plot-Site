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

import { GET, POST } from "./route";
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

function jsonRequest(body) {
  return {
    json: async () => body,
    url: "http://localhost/api/chat",
  };
}

describe("/api/chat", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSession.mockResolvedValue({ id: "user-1" });
    createConversation.mockResolvedValue({ id: 9 });
    getConversation.mockResolvedValue({ id: 9, messages: [] });
    buildChatContext.mockResolvedValue({ context: true });
    runChatAgent.mockResolvedValue({
      text: "Draft ready.",
      action: { type: "CREATE_TASK_DRAFT", payload: { title: "Lab" } },
      rawResponse: "Draft ready.",
    });
    saveMessagePair.mockResolvedValue({
      userMessage: { id: 21 },
      assistantMessage: { id: 22 },
    });
    setConversationTitle.mockResolvedValue({});
    listConversations.mockResolvedValue([{ id: 9, title: "Lab" }]);
  });

  it("creates a chat turn for the authenticated session user without trusting client user_id", async () => {
    const response = await POST(
      jsonRequest({
        user_id: "attacker",
        message: "Add a lab task",
      }),
    );
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(createConversation).toHaveBeenCalledWith("user-1");
    expect(buildChatContext).toHaveBeenCalledWith("user-1");
    expect(saveMessagePair).toHaveBeenCalledWith(
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
    const response = await GET({
      url: "http://localhost/api/chat?user_id=attacker",
    });
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(listConversations).toHaveBeenCalledWith("user-1");
    expect(body.conversations).toEqual([{ id: 9, title: "Lab" }]);
  });

  it("returns 401 when no user is authenticated", async () => {
    getSession.mockResolvedValue(null);

    const response = await POST(jsonRequest({ message: "Hello" }));
    const body = await response.json();

    expect(response.status).toBe(401);
    expect(body.error).toMatch(/not authenticated/i);
    expect(createConversation).not.toHaveBeenCalled();
  });

  it("does not create an empty saved conversation when a new chat turn fails", async () => {
    const consoleSpy = jest.spyOn(console, "error").mockImplementation(() => {});
    runChatAgent.mockRejectedValue(new Error("Gemini failed"));

    const response = await POST(jsonRequest({ message: "Hello" }));
    const body = await response.json();

    expect(response.status).toBe(500);
    expect(body.error).toMatch(/failed to process/i);
    expect(createConversation).not.toHaveBeenCalled();
    expect(saveMessagePair).not.toHaveBeenCalled();
    consoleSpy.mockRestore();
  });
});
