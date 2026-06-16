"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { MessageSquare, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { ActionCard } from "@/app/components/chat/action-card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/firebase/auth-context";
import { cn } from "@/lib/utils";
import {
  Conversation,
  ConversationContent,
  ConversationScrollButton,
} from "./conversation";
import { Message, MessageContent, MessageResponse } from "./message";
import {
  PromptInput,
  PromptInputBody,
  PromptInputFooter,
  type PromptInputMessage,
  PromptInputSubmit,
  PromptInputTextarea,
} from "./prompt-input";
import { Suggestion, Suggestions } from "./suggestion";

type ActionType = "CREATE_TASK_DRAFT" | "CREATE_STUDY_TRACK_DRAFT";
type ActionStatus = "none" | "pending" | "confirmed" | "dismissed";
type ChatVariant = "page" | "panel";

interface ChatAction {
  type: ActionType;
  payload: Record<string, unknown>;
}

interface ChatMessageRecord {
  id: number;
  role: "user" | "assistant";
  text_content: string;
  structured_json?: unknown;
  action_status?: ActionStatus;
  created_at?: string;
}

interface ConversationSummary {
  id: number;
  title: string | null;
  updated_at?: string;
  messages?: ChatMessageRecord[];
}

interface ConversationDetail extends ConversationSummary {
  messages: ChatMessageRecord[];
}

interface MessageType {
  key: string;
  from: "user" | "assistant";
  content: string;
  messageId?: number;
  action?: ChatAction | null;
  actionStatus: ActionStatus;
}

interface ChatbotDemoProps {
  variant?: ChatVariant;
}

const welcomeMessage: MessageType = {
  key: "welcome",
  from: "assistant",
  content:
    "Hi, I'm Ploty. I can help draft tasks, build task-linked study sessions, and make sense of your workload.",
  actionStatus: "none",
};

const suggestions = [
  "What should I focus on today?",
  "Draft a task: finish lab report, due Friday",
  "Make study sessions for my most urgent task",
  "Am I overloaded this week?",
];

function normalizeAction(value: unknown): ChatAction | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as { type?: unknown; payload?: unknown };
  if (
    candidate.type !== "CREATE_TASK_DRAFT" &&
    candidate.type !== "CREATE_STUDY_TRACK_DRAFT"
  ) {
    return null;
  }
  if (!candidate.payload || typeof candidate.payload !== "object") {
    return null;
  }
  return {
    type: candidate.type,
    payload: candidate.payload as Record<string, unknown>,
  };
}

function mapMessageRecord(message: ChatMessageRecord): MessageType {
  const action = normalizeAction(message.structured_json);

  return {
    key: `message-${message.id}`,
    from: message.role,
    content: message.text_content,
    messageId: message.id,
    action,
    actionStatus: action ? message.action_status ?? "pending" : "none",
  };
}

function conversationTitle(conversation: ConversationSummary) {
  return conversation.title?.trim() || "Untitled chat";
}

function conversationPreview(conversation: ConversationSummary) {
  return conversation.messages?.[0]?.text_content ?? "No messages yet";
}

function formatThreadDate(value?: string) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function ChatbotDemo({ variant = "page" }: ChatbotDemoProps) {
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [text, setText] = useState("");
  const [status, setStatus] = useState<
    "submitted" | "streaming" | "ready" | "error"
  >("ready");
  const [messages, setMessages] = useState<MessageType[]>([welcomeMessage]);
  const [conversations, setConversations] = useState<ConversationSummary[]>([]);
  const [conversationId, setConversationId] = useState<number | null>(null);
  const [loadingConversations, setLoadingConversations] = useState(false);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const isPanel = variant === "panel";

  const loadConversation = useCallback(async (id: number) => {
    setLoadingHistory(true);
    try {
      const response = await fetch(`/api/chat/${id}`);
      if (!response.ok) throw new Error("Failed to load conversation.");
      const data = (await response.json()) as { conversation: ConversationDetail };
      setConversationId(data.conversation.id);
      setMessages(data.conversation.messages.map(mapMessageRecord));
    } catch {
      toast.error("Could not load that chat.");
    } finally {
      setLoadingHistory(false);
    }
  }, []);

  const loadConversations = useCallback(
    async (selectLatest = false) => {
      setLoadingConversations(true);
      try {
        const response = await fetch("/api/chat");
        if (!response.ok) throw new Error("Failed to load conversations.");
        const data = (await response.json()) as {
          conversations: ConversationSummary[];
        };
        const nextConversations = data.conversations ?? [];
        setConversations(nextConversations);

        if (selectLatest) {
          const first = nextConversations[0];
          if (first) {
            await loadConversation(first.id);
          } else {
            setConversationId(null);
            setMessages([welcomeMessage]);
          }
        }
      } catch {
        toast.error("Could not load saved chats.");
      } finally {
        setLoadingConversations(false);
      }
    },
    [loadConversation],
  );

  useEffect(() => {
    if (!userId) return;
    void loadConversations(true);
  }, [loadConversations, userId]);

  const activeConversation = useMemo(
    () =>
      conversations.find((conversation) => conversation.id === conversationId) ??
      null,
    [conversations, conversationId],
  );

  function startNewChat() {
    setConversationId(null);
    setMessages([welcomeMessage]);
    setText("");
    setStatus("ready");
  }

  async function deleteConversation(id: number) {
    const title = conversations.find((item) => item.id === id);
    setDeletingId(id);
    try {
      const response = await fetch(`/api/chat/${id}`, { method: "DELETE" });
      if (!response.ok) throw new Error("Failed to delete conversation.");

      const remaining = conversations.filter((item) => item.id !== id);
      setConversations(remaining);
      toast.success("Chat deleted.");

      if (conversationId === id) {
        const next = remaining[0];
        if (next) {
          await loadConversation(next.id);
        } else {
          startNewChat();
        }
      }
    } catch {
      toast.error(`Could not delete ${title ? conversationTitle(title) : "chat"}.`);
    } finally {
      setDeletingId(null);
    }
  }

  async function sendMessage(content: string) {
    const trimmed = content.trim();
    if (!trimmed || status === "submitted") return;

    setStatus("submitted");

    const optimisticUserMessage: MessageType = {
      key: `pending-${Date.now()}`,
      from: "user",
      content: trimmed,
      actionStatus: "none",
    };

    setMessages((prev) => [...prev, optimisticUserMessage]);
    setText("");

    try {
      const body: Record<string, unknown> = { message: trimmed };
      if (conversationId) body.conversation_id = conversationId;

      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      if (!response.ok) throw new Error("Chat request failed.");

      const data = (await response.json()) as {
        conversation_id: number;
        user_message_id: number;
        assistant_message_id: number;
        text: string;
        action: ChatAction | null;
      };

      setConversationId(data.conversation_id);
      setMessages((prev) => [
        ...prev.map((message) =>
          message.key === optimisticUserMessage.key
            ? {
                ...message,
                key: `message-${data.user_message_id}`,
                messageId: data.user_message_id,
              }
            : message,
        ),
        {
          key: `message-${data.assistant_message_id}`,
          from: "assistant",
          content: data.text,
          messageId: data.assistant_message_id,
          action: data.action,
          actionStatus: data.action ? "pending" : "none",
        },
      ]);
      setStatus("ready");
      void loadConversations(false);
    } catch {
      setStatus("error");
      toast.error("Could not reach Ploty.", {
        description: "Please check your connection and try again.",
      });
    }
  }

  function handleSubmit(message: PromptInputMessage) {
    if (!message.text?.trim()) return;
    void sendMessage(message.text);
  }

  function handleSuggestionClick(suggestion: string) {
    void sendMessage(suggestion);
  }

  function updateActionStatus(messageId: number, nextStatus: ActionStatus) {
    setMessages((prev) =>
      prev.map((message) =>
        message.messageId === messageId
          ? { ...message, actionStatus: nextStatus }
          : message,
      ),
    );
  }

  if (!userId) {
    return (
      <div className="flex h-full w-full items-center justify-center p-6 text-center text-sm text-muted-foreground">
        Please log in to use Ploty.
      </div>
    );
  }

  const threadList = (
    <div
      className={cn(
        "flex shrink-0 flex-col border-border/70 bg-card/50",
        isPanel
          ? "max-h-32 border-b"
          : "min-h-0 w-full border-b lg:w-64 lg:border-b-0 lg:border-r",
      )}
    >
      <div className="flex items-center justify-between gap-2 border-b border-border/60 px-3 py-2">
        <div className="min-w-0">
          <p className="font-mono text-[11px] font-semibold uppercase tracking-widest text-muted-foreground">
            Chats
          </p>
          <p className="text-[11px] text-muted-foreground">
            {conversations.length} saved
          </p>
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="h-8 gap-1.5 font-mono text-xs"
          onClick={startNewChat}
        >
          <Plus className="h-3.5 w-3.5" />
          New
        </Button>
      </div>

      <div
        className={cn(
          "min-h-0 gap-1 overflow-auto p-2",
          isPanel ? "flex" : "flex flex-col",
        )}
      >
        {loadingConversations && conversations.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground">
            Loading chats...
          </div>
        ) : conversations.length === 0 ? (
          <div className="rounded-md border border-dashed border-border/70 px-3 py-4 text-xs text-muted-foreground">
            No saved chats yet.
          </div>
        ) : (
          conversations.map((conversation) => {
            const active = conversation.id === conversationId;
            const title = conversationTitle(conversation);

            return (
              <div
                key={conversation.id}
                className={cn(
                  "group flex min-w-0 items-center gap-2 rounded-md border px-3 py-2 text-left transition-colors",
                  isPanel ? "w-52 shrink-0" : "w-full",
                  active
                    ? "border-accent/50 bg-accent/10"
                    : "border-transparent hover:border-border hover:bg-muted/40",
                )}
              >
                <button
                  type="button"
                  onClick={() => loadConversation(conversation.id)}
                  className="flex min-w-0 flex-1 items-center gap-2 text-left"
                >
                  <MessageSquare className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-xs font-semibold text-foreground">
                      {title}
                    </span>
                    <span className="block truncate text-[11px] text-muted-foreground">
                      {conversationPreview(conversation)}
                    </span>
                  </span>
                </button>
                <span className="flex shrink-0 items-center gap-1">
                  {conversation.updated_at && (
                    <Badge
                      variant="outline"
                      className="hidden font-mono text-[10px] xl:inline-flex"
                    >
                      {formatThreadDate(conversation.updated_at)}
                    </Badge>
                  )}
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    aria-label={`Delete ${title}`}
                    className="h-7 w-7 opacity-100 lg:opacity-0 lg:group-hover:opacity-100"
                    disabled={deletingId === conversation.id}
                    onClick={() => {
                      void deleteConversation(conversation.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </Button>
                </span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );

  return (
    <div
      className={cn(
        "flex h-full w-full min-h-0 overflow-hidden bg-background/50",
        isPanel ? "flex-col" : "flex-col lg:flex-row",
      )}
    >
      {threadList}

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <div className="flex items-center justify-between gap-3 border-b border-border/70 bg-card/40 px-4 py-3">
          <div className="min-w-0">
            <p className="truncate text-sm font-semibold text-foreground">
              {activeConversation ? conversationTitle(activeConversation) : "New chat"}
            </p>
            <p className="font-mono text-[11px] uppercase tracking-widest text-muted-foreground">
              Ploty task and study assistant
            </p>
          </div>
          <Badge variant="secondary" className="font-mono text-[10px]">
            {status === "submitted" ? "Thinking" : "Ready"}
          </Badge>
        </div>

        <Conversation className="min-h-0 flex-1">
          <ConversationContent className="gap-4 p-4">
            {loadingHistory ? (
              <div className="rounded-lg border border-dashed border-border/70 bg-card/70 px-4 py-8 text-sm text-muted-foreground">
                Loading conversation...
              </div>
            ) : (
              messages.map((message) => (
                <Message from={message.from} key={message.key}>
                  <div
                    className={cn(
                      "space-y-2",
                      message.from === "user" && "ml-auto max-w-[85%]",
                    )}
                  >
                    <MessageContent
                      className={cn(
                        message.from === "assistant" &&
                          "rounded-lg border border-border/60 bg-card px-3 py-2 shadow-sm",
                      )}
                    >
                      <MessageResponse>{message.content}</MessageResponse>
                    </MessageContent>

                    {message.action && message.messageId && conversationId && (
                      <div className="max-w-xl">
                        <ActionCard
                          messageId={message.messageId}
                          conversationId={conversationId}
                          actionType={message.action.type}
                          payload={message.action.payload}
                          initialStatus={message.actionStatus}
                          onStatusChange={updateActionStatus}
                        />
                      </div>
                    )}
                  </div>
                </Message>
              ))
            )}
          </ConversationContent>
          <ConversationScrollButton />
        </Conversation>

        <div className="shrink-0 border-t border-border/70 bg-card/60 px-3 py-3">
          <Suggestions className="mb-3 flex max-h-20 flex-wrap gap-1.5 overflow-y-auto">
            {suggestions.map((suggestion) => (
              <Suggestion
                key={suggestion}
                onClick={() => handleSuggestionClick(suggestion)}
                suggestion={suggestion}
                className="border border-border/70 bg-background/70 px-2.5 py-1 text-xs hover:bg-accent/10 hover:text-accent"
              />
            ))}
          </Suggestions>

          <PromptInput
            onSubmit={handleSubmit}
            className="rounded-lg border border-border/80 bg-background shadow-sm"
          >
            <PromptInputBody>
              <PromptInputTextarea
                onChange={(event) => setText(event.target.value)}
                placeholder="Ask about your tasks, schedule, or workload..."
                value={text}
                className="max-h-28 min-h-11 resize-none bg-transparent text-sm"
              />
            </PromptInputBody>
            <PromptInputFooter className="justify-end border-t border-border/50 px-2 py-1.5">
              <PromptInputSubmit
                disabled={!text.trim() || status === "submitted"}
                status={status}
                className="h-8 w-8 bg-accent text-accent-foreground hover:bg-accent/90"
              />
            </PromptInputFooter>
          </PromptInput>
        </div>
      </div>
    </div>
  );
}

export default ChatbotDemo;
