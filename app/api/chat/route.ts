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

// Validation schema for the POST request body when sending a message to the chat agent. It requires a non-empty message string and an optional conversation_id for continuing an existing conversation.
const PostSchema = z.object({
  message: z.string().min(1).max(2000),
  conversation_id: z.number().int().positive().optional(),
});

type ChatHistory = NonNullable<
  Awaited<ReturnType<typeof getConversation>>
>["messages"];

/**
 * @swagger
 * /api/chat:
 *   post:
 *     summary: Send a message to the authenticated AI chat agent
 *     tags:
 *       - Chat
 *     description: >
 *       Requires the session cookie. Builds user-specific task, study, and project context,
 *       calls the chat agent, creates a conversation when needed, persists the user and
 *       assistant messages, and best-effort generates a title for new conversations.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [message]
 *             properties:
 *               message:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 2000
 *               conversation_id:
 *                 type: integer
 *                 minimum: 1
 *                 description: Existing conversation to continue. Omit to create one.
 *     responses:
 *       200:
 *         description: Chat turn processed and persisted.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversation_id:
 *                   type: integer
 *                 user_message_id:
 *                   type: integer
 *                 assistant_message_id:
 *                   type: integer
 *                 text:
 *                   type: string
 *                 action:
 *                   nullable: true
 *                   description: Optional structured action returned by the agent.
 *       400:
 *         description: Invalid JSON body.
 *       401:
 *         description: Not authenticated.
 *       404:
 *         description: Conversation not found for this user.
 *       422:
 *         description: Validation failed.
 *       500:
 *         description: Failed to process message.
 *   get:
 *     summary: List chat conversations for the authenticated user
 *     tags:
 *       - Chat
 *     responses:
 *       200:
 *         description: Conversations retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 conversations:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Not authenticated.
 *       500:
 *         description: Failed to fetch conversations.
 */
export async function POST(req: NextRequest) {
  // Get the session from the request (assuming request has the session, e.g., from cookies or headers)
  const session = await getSession();

  // If the user is not authenticated, return a 401 Unauthorized response
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  // Parse and validate the request body against the PostSchema
  let body: unknown;

  // If the request body is not valid JSON, return a 400 Bad Request response
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const parsed = PostSchema.safeParse(body);

  // If the request body fails validation, return a 422 Unprocessable Entity response with details
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed.", details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  // Extract the validated message and optional conversation_id from the parsed request body
  const { message, conversation_id } = parsed.data;
  // Extract the user ID from the session for use in database queries and context building
  const userId = session.id;

  // Initialize variables for conversation ID and chat history, and determine if this is a new conversation
  try {
    let conversationId = conversation_id;
    const isNewConversation = !conversationId;
    let history: ChatHistory = [];

    // If a conversation ID was provided, attempt to fetch the conversation and its message history for this user
    if (conversationId) {
      const conversation = await getConversation(conversationId, userId);
      // If the conversation does not exist or does not belong to this user, return a 404 Not Found response
      if (!conversation) {
        return NextResponse.json(
          { error: "Conversation not found." },
          { status: 404 },
        );
      }
      history = conversation.messages;
    }

    // Build the context for the chat agent using the user ID, which may include information about the user's tasks, studies, projects, etc
    const context = await buildChatContext(userId);
    // Call the chat agent with the user's message, the conversation history, and the built context. The agent will return a response that includes the text to reply with and any structured action.
    const result = await runChatAgent(message, history, context);

    // If this is a new conversation, create it in the database. Then save the user's message and the assistant's response as a pair in the database, linked to the conversation. If this is a new conversation, also attempt to set a title for it based on the user's first message (this is best-effort and should not fail the chat turn if it does not work).
    if (!conversationId) {
      const newConversation = await createConversation(userId);
      conversationId = newConversation.id;
    }

    // Save the user message and assistant message as a pair in the database, linked to the conversation. This allows us to reconstruct the conversation history later.
    const { userMessage, assistantMessage } = await saveMessagePair(
      conversationId,
      message,
      result.rawResponse,
      result.action,
    );

    // If this is a new conversation, attempt to set the conversation title based on the user's first message
    if (isNewConversation) {
      await setConversationTitle(conversationId, message).catch(() => {
        // Title updates are best-effort and should not fail the chat turn.
      });
    }

    // Return a 200 OK response with the conversation ID, the IDs of the user and assistant messages, the text of the assistant's response, and any structured action returned by the agent
    return NextResponse.json(
      { 
        conversation_id: conversationId,
        user_message_id: userMessage.id,
        assistant_message_id: assistantMessage.id,
        text: result.text,
        action: result.action,
      },
      { status: 200 },
    );
  } catch (err) {
    console.error("[POST /api/chat] error:", err);

    // Return a 500 Internal Server Error response if any unexpected error occurs during processing
    return NextResponse.json(
      { error: "Failed to process message." },
      { status: 500 },
    );
  }
}

export async function GET() {
  // Get the session from the request (assuming request has the session, e.g., from cookies or headers)
  const session = await getSession();

  // If the user is not authenticated, return a 401 Unauthorized response
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // Attempt to fetch the list of conversations for the authenticated user
    const conversations = await listConversations(session.id);

    // If successful, return a 200 OK response with the conversations
    return NextResponse.json(
      { conversations },
      { status: 200 },
    );
  } catch (err) {
    console.error("[GET /api/chat] error:", err);

    // Return a 500 Internal Server Error response if any unexpected error occurs during processing
    return NextResponse.json(
      { error: "Failed to fetch conversations." },
      { status: 500 },
    );
  }
}
