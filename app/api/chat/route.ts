import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runChatAgent } from "@/lib/ai/chatAgent";
import { getSession } from "@/lib/firebase/auth";
import {
  buildChatContext,
  createConversation,
  getConversation,
  listConversations,
  saveMessagePair,
  setConversationTitle,
} from "@/lib/services/chatService";

const PostSchema = z.object({
  message: z.string().min(1).max(2000),
  conversation_id: z.number().int().positive().optional(),
});

type ChatHistory = NonNullable<
  Awaited<ReturnType<typeof getConversation>>
>["messages"];

export async function POST(req: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = PostSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { message, conversation_id } = parsed.data;
  const userId = session.id;

  try {
    let conversationId = conversation_id;
    let isNewConversation = false;
    let history: ChatHistory = [];

    if (!conversationId) {
      const newConversation = await createConversation(userId);
      conversationId = newConversation.id;
      isNewConversation = true;
    } else {
      const conversation = await getConversation(conversationId, userId);
      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found." },
          { status: 404 },
        );
      }
      history = conversation.messages;
    }

    const context = await buildChatContext(userId);
    const result = await runChatAgent(message, history, context);

    const { userMessage, assistantMessage } = await saveMessagePair(
      conversationId,
      message,
      result.rawResponse,
      result.action,
    );

    if (isNewConversation) {
      await setConversationTitle(conversationId, message).catch(() => {
        // Title updates are best-effort and should not fail the chat turn.
      });
    }

    return NextResponse.json({
      conversation_id: conversationId,
      user_message_id: userMessage.id,
      assistant_message_id: assistantMessage.id,
      text: result.text,
      action: result.action,
    });
  } catch (err) {
    console.error("[POST /api/chat] error:", err);
    return NextResponse.json(
      { error: "Failed to process message." },
      { status: 500 },
    );
  }
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const conversations = await listConversations(session.id);
    return NextResponse.json({ conversations });
  } catch (err) {
    console.error("[GET /api/chat] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch conversations." },
      { status: 500 },
    );
  }
}
