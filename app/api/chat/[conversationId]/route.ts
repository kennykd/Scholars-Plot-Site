import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ActionStatus } from "@/lib/generated/prisma/client";
import { getSession } from "@/lib/firebase/auth";
import {
  deleteConversation,
  getConversation,
  updateMessageActionStatus,
} from "@/lib/services/chatService";

const PatchSchema = z.object({
  message_id: z.number().int().positive(),
  action_status: z.enum(["confirmed", "dismissed"]),
});

type ConversationRouteContext = {
  params: Promise<{ conversationId: string }>;
};

function parseConversationId(params: { conversationId: string }): number | null {
  const id = parseInt(params.conversationId, 10);
  return Number.isNaN(id) || id <= 0 ? null : id;
}

export async function GET(
  _req: NextRequest,
  { params }: ConversationRouteContext,
) {
  const conversationId = parseConversationId(await params);
  if (!conversationId) {
    return NextResponse.json(
      { error: "Invalid conversation ID." },
      { status: 400 },
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const conversation = await getConversation(conversationId, session.id);

    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ conversation });
  } catch (err) {
    console.error("[GET /api/chat/:id] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch conversation." },
      { status: 500 },
    );
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: ConversationRouteContext,
) {
  const conversationId = parseConversationId(await params);
  if (!conversationId) {
    return NextResponse.json(
      { error: "Invalid conversation ID." },
      { status: 400 },
    );
  }

  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated." }, { status: 401 });
  }

  try {
    const deleted = await deleteConversation(conversationId, session.id);

    if (!deleted) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, deleted_id: conversationId });
  } catch (err) {
    console.error("[DELETE /api/chat/:id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete conversation." },
      { status: 500 },
    );
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: ConversationRouteContext,
) {
  const conversationId = parseConversationId(await params);
  if (!conversationId) {
    return NextResponse.json(
      { error: "Invalid conversation ID." },
      { status: 400 },
    );
  }

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

  const parsed = PatchSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { message_id, action_status } = parsed.data;
  const statusMap: Record<"confirmed" | "dismissed", ActionStatus> = {
    confirmed: ActionStatus.confirmed,
    dismissed: ActionStatus.dismissed,
  };

  try {
    const updated = await updateMessageActionStatus(
      message_id,
      session.id,
      statusMap[action_status],
    );

    if (!updated) {
      return NextResponse.json(
        { error: "Message not found." },
        { status: 404 },
      );
    }

    return NextResponse.json({ success: true, message_id, action_status });
  } catch (err) {
    console.error("[PATCH /api/chat/:id] error:", err);
    return NextResponse.json(
      { error: "Failed to update action status." },
      { status: 500 },
    );
  }
}
