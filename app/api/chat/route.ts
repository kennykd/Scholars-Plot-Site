import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runChatAgent } from "@/lib/ai/chatAgent";
import {
  buildChatContext,
  createConversation,
  getConversationHistory,
  listConversations,
  saveMessagePair,
  setConversationTitle,
} from "@/lib/services/chatService";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const PostSchema = z.object({
  user_id: z.string().min(1),
  message: z.string().min(1).max(2000),
  conversation_id: z.number().int().positive().optional(),
});

const GetSchema = z.object({
  user_id: z.string().min(1),
});

// ─── POST /api/chat — Send a message ─────────────────────────────────────────

export async function POST(req: NextRequest) {
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
      { status: 422 }
    );
  }

  const { user_id, message, conversation_id } = parsed.data;

  try {
    // Resolve or create conversation
    let convId = conversation_id;
    let isNewConversation = false;

    if (!convId) {
      const newConv = await createConversation(user_id);
      convId = newConv.id;
      isNewConversation = true;
    }

    // Fetch history and context in parallel
    const [history, context] = await Promise.all([
      getConversationHistory(convId),
      buildChatContext(user_id),
    ]);

    // Run the agent
    const result = await runChatAgent(message, history, context);

    // Persist both messages
    const { userMessage, assistantMessage } = await saveMessagePair(
      convId,
      message,
      result.rawResponse,
      result.action
    );

    // Auto-title new conversations from the first user message
    if (isNewConversation) {
      await setConversationTitle(convId, message).catch(() => {
        // Non-critical — don't fail the request if title update fails
      });
    }

    return NextResponse.json({
      conversation_id: convId,
      user_message_id: userMessage.id,
      assistant_message_id: assistantMessage.id,
      text: result.text,
      action: result.action,
    });
  } catch (err) {
    console.error("[POST /api/chat] error:", err);
    return NextResponse.json(
      { error: "Failed to process message." },
      { status: 500 }
    );
  }
}

// ─── GET /api/chat — List conversations for a user ───────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const parsed = GetSchema.safeParse({
    user_id: searchParams.get("user_id"),
  });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  try {
    const conversations = await listConversations(parsed.data.user_id);
    return NextResponse.json({ conversations });
  } catch (err) {
    console.error("[GET /api/chat] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch conversations." },
      { status: 500 }
    );
  }
}