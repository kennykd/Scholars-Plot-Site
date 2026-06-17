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

/**
 * @swagger
 * /api/chat/{conversationId}:
 *   get:
 *     summary: Get a chat conversation and its messages
 *     tags:
 *       - Chat
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Conversation retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversation:
 *                   type: object
 *       400:
 *         description: Invalid conversation ID.
 *       401:
 *         description: Not authenticated.
 *       404:
 *         description: Conversation not found.
 *       500:
 *         description: Failed to fetch conversation.
 *   delete:
 *     summary: Delete a chat conversation
 *     tags:
 *       - Chat
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Conversation deleted.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 deleted_id:
 *                   type: integer
 *       400:
 *         description: Invalid conversation ID.
 *       401:
 *         description: Not authenticated.
 *       404:
 *         description: Conversation not found.
 *       500:
 *         description: Failed to delete conversation.
 *   patch:
 *     summary: Update a chat message action status
 *     tags:
 *       - Chat
 *     parameters:
 *       - in: path
 *         name: conversationId
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Parsed and validated, but the update is scoped by message ownership.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message_id, action_status]
 *             properties:
 *               message_id:
 *                 type: integer
 *                 minimum: 1
 *               action_status:
 *                 type: string
 *                 enum: [confirmed, dismissed]
 *     responses:
 *       200:
 *         description: Action status updated.
 *       400:
 *         description: Invalid conversation ID or JSON body.
 *       401:
 *         description: Not authenticated.
 *       404:
 *         description: Message not found.
 *       422:
 *         description: Validation failed.
 *       500:
 *         description: Failed to update action status.
 */

export async function GET(
  _req: NextRequest,
  { params }: ConversationRouteContext,
) {
  // Parse and validate the conversation ID from the route parameters
  const conversationId = parseConversationId(await params);

  // If the conversation ID is invalid, return a 400 Bad Request response
  if (!conversationId) {
    return NextResponse.json(
      { error: "Invalid conversation ID." },
      { status: 400 },
    );
  }

  // Get the session from the request (assuming request has the session, e.g., from cookies or headers)
  const session = await getSession();

  // If the user is not authenticated, return a 401 Unauthorized response
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Attempt to fetch the conversation for the authenticated user
  try {
    // Fetch the conversation for the authenticated user
    const conversation = await getConversation(conversationId, session.id);

    // If the conversation is not found, return a 404 Not Found response
    if (!conversation) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    // Return a 200 OK response with the conversation data
    return NextResponse.json(
      { conversation },
      { status: 200 },
    );
  } catch (err) {
    console.error("[GET /api/chat/:id] error:", err);

    // Return a 500 Internal Server Error response if any unexpected error occurs during processing
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
  // Parse and validate the conversation ID from the route parameters
  const conversationId = parseConversationId(await params);

  // If the conversation ID is invalid, return a 400 Bad Request response
  if (!conversationId) {
    return NextResponse.json(
      { error: "Invalid conversation ID." },
      { status: 400 },
    );
  }

  // Get the session from the request (assuming request has the session, e.g., from cookies or headers)
  const session = await getSession();

  // If the user is not authenticated, return a 401 Unauthorized response
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Attempt to delete the conversation for the authenticated user
  try {
    // Fetch the conversation for the authenticated user
    const deleted = await deleteConversation(conversationId, session.id);

    // If the conversation is not found, return a 404 Not Found response
    if (!deleted) {
      return NextResponse.json(
        { error: "Conversation not found." },
        { status: 404 },
      );
    }

    // Return a 200 OK response with the conversation data
    return NextResponse.json(
      { success: true, deleted_id: conversationId },
      { status: 200 },
    );
  } catch (err) {
    console.error("[DELETE /api/chat/:id] error:", err);

    // Return a 500 Internal Server Error response if any unexpected error occurs during processing
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
  // Parse and validate the conversation ID from the route parameters
  const conversationId = parseConversationId(await params);

  // If the conversation ID is invalid, return a 400 Bad Request response
  if (!conversationId) {
    return NextResponse.json(
      { error: "Invalid conversation ID." },
      { status: 400 },
    );
  }

  // Get the session from the request (assuming request has the session, e.g., from cookies or headers)
  const session = await getSession();

  // If the user is not authenticated, return a 401 Unauthorized response
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Parse and validate the request body against the PatchSchema
  let body: unknown;

  // If the request body is not valid JSON, return a 400 Bad Request response
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  };

  const parsed = PatchSchema.safeParse(body);

  // If validation fails, return a 422 Unprocessable Entity response with validation error details
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Extract the validated message_id and action_status from the parsed request body, and attempt to update the message action status for the authenticated user
  const { message_id, action_status } = parsed.data;
  const statusMap: Record<"confirmed" | "dismissed", ActionStatus> = {
    confirmed: ActionStatus.confirmed,
    dismissed: ActionStatus.dismissed,
  };

  try {
    // Attempt to update the message action status for the authenticated user
    const updated = await updateMessageActionStatus(
      message_id,
      session.id,
      statusMap[action_status],
    );

    // If the message is not found, return a 404 Not Found response
    if (!updated) {
      return NextResponse.json(
        { error: "Message not found." },
        { status: 404 },
      );
    }

    // If successful, return a 200 OK response indicating success
    return NextResponse.json(
      { success: true, message_id, action_status },
      { status: 200 },
    );
  } catch (err) {
    console.error("[PATCH /api/chat/:id] error:", err);

    // Return a 500 Internal Server Error response if any unexpected error occurs during processing
    return NextResponse.json(
      { error: "Failed to update action status." },
      { status: 500 },
    );
  }
}
