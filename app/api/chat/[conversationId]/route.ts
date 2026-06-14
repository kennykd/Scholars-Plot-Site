import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ActionStatus } from "@/lib/generated/prisma/client";
import {
  getConversation,
  deleteConversation,
  updateMessageActionStatus,
} from "@/lib/services/chatService";

// ─── Schemas ──────────────────────────────────────────────────────────────────

const GetSchema = z.object({
  user_id: z.string().min(1),
});

const DeleteSchema = z.object({
  user_id: z.string().min(1),
});

const PatchSchema = z.object({
  user_id: z.string().min(1),
  message_id: z.number().int().positive(),
  action_status: z.enum(["confirmed", "dismissed"]),
});

// ─── Param helper ─────────────────────────────────────────────────────────────

type ConversationRouteContext = {
  params: Promise<{ conversationId: string }>;
};

function parseConversationId(params: { conversationId: string }): number | null {
  const id = parseInt(params.conversationId, 10);
  return isNaN(id) || id <= 0 ? null : id;
}

// ─── GET /api/chat/[conversationId] — Fetch full conversation ─────────────────

export async function GET(
  req: NextRequest,
  { params }: ConversationRouteContext
) {
  const convId = parseConversationId(await params);
  if (!convId) {
    return NextResponse.json({ error: "Invalid conversation ID." }, { status: 400 });
  }

  const { searchParams } = new URL(req.url);
  const parsed = GetSchema.safeParse({ user_id: searchParams.get("user_id") });

  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  try {
    const conversation = await getConversation(convId, parsed.data.user_id);

    if (!conversation) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    return NextResponse.json({ conversation });
  } catch (err) {
    console.error("[GET /api/chat/:id] error:", err);
    return NextResponse.json(
      { error: "Failed to fetch conversation." },
      { status: 500 }
    );
  }
}

// ─── DELETE /api/chat/[conversationId] — Delete conversation ──────────────────

export async function DELETE(
  req: NextRequest,
  { params }: ConversationRouteContext
) {
  const convId = parseConversationId(await params);
  if (!convId) {
    return NextResponse.json({ error: "Invalid conversation ID." }, { status: 400 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = DeleteSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 422 }
    );
  }

  try {
    const deleted = await deleteConversation(convId, parsed.data.user_id);

    if (!deleted) {
      return NextResponse.json({ error: "Conversation not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, deleted_id: convId });
  } catch (err) {
    console.error("[DELETE /api/chat/:id] error:", err);
    return NextResponse.json(
      { error: "Failed to delete conversation." },
      { status: 500 }
    );
  }
}

// ─── PATCH /api/chat/[conversationId] — Update message action status ──────────
// Called when user confirms or dismisses an ActionCard

export async function PATCH(
  req: NextRequest,
  { params }: ConversationRouteContext
) {
  const convId = parseConversationId(await params);
  if (!convId) {
    return NextResponse.json({ error: "Invalid conversation ID." }, { status: 400 });
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
      { status: 422 }
    );
  }

  const { user_id, message_id, action_status } = parsed.data;

  const statusMap: Record<"confirmed" | "dismissed", ActionStatus> = {
    confirmed: ActionStatus.confirmed,
    dismissed: ActionStatus.dismissed,
  };

  try {
    const updated = await updateMessageActionStatus(
      message_id,
      user_id,
      statusMap[action_status]
    );

    if (!updated) {
      return NextResponse.json({ error: "Message not found." }, { status: 404 });
    }

    return NextResponse.json({ success: true, message_id, action_status });
  } catch (err) {
    console.error("[PATCH /api/chat/:id] error:", err);
    return NextResponse.json(
      { error: "Failed to update action status." },
      { status: 500 }
    );
  }
}
