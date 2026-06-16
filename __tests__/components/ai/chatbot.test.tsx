import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { ChatbotDemo } from "@/components/ai/chatbot";
import { useAuth } from "@/lib/firebase/auth-context";
import type { ReactNode } from "react";

jest.mock("@/lib/firebase/auth-context", () => ({
  useAuth: jest.fn(),
}));

jest.mock("nanoid", () => ({
  nanoid: () => "mock-id",
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("use-stick-to-bottom", () => {
  function StickToBottom({ children, ...props }: { children: ReactNode }) {
    return <div {...props}>{children}</div>;
  }

  function StickToBottomContent({
    children,
    ...props
  }: {
    children: ReactNode;
  }) {
    return <div {...props}>{children}</div>;
  }

  StickToBottom.Content = StickToBottomContent;

  return {
    StickToBottom,
    useStickToBottomContext: () => ({
      isAtBottom: true,
      scrollToBottom: jest.fn(),
    }),
  };
});

jest.mock(
  "streamdown",
  () => ({
    Streamdown: function MockStreamdown({ children }: { children: ReactNode }) {
      return <div>{children}</div>;
    },
  }),
  { virtual: true },
);

jest.mock("@/app/components/chat/action-card", () => ({
  ActionCard: ({
    actionType,
    initialStatus,
    payload,
  }: {
    actionType: string;
    initialStatus: string;
    payload: Record<string, unknown>;
  }) => (
    <div data-testid="chat-action-card">
      {actionType} {initialStatus} {String(payload.title ?? payload.task_title)}
    </div>
  ),
}));

const conversations = [
  {
    id: 7,
    title: "Physics lab",
    updated_at: "2026-06-15T08:00:00.000Z",
    messages: [
      {
        id: 72,
        role: "assistant",
        text_content: "Latest reply",
        created_at: "2026-06-15T08:01:00.000Z",
      },
    ],
  },
];

const conversationDetail = {
  id: 7,
  title: "Physics lab",
  messages: [
    {
      id: 70,
      role: "user",
      text_content: "Can you make a task?",
      structured_json: null,
      action_status: "none",
      created_at: "2026-06-15T08:00:00.000Z",
    },
    {
      id: 71,
      role: "assistant",
      text_content: "I drafted it.",
      structured_json: {
        type: "CREATE_TASK_DRAFT",
        payload: {
          title: "Physics lab report",
          deadline: "2026-06-20T12:00:00.000Z",
          priority: 4,
        },
      },
      action_status: "confirmed",
      created_at: "2026-06-15T08:01:00.000Z",
    },
  ],
};

function mockFetch(handler: (input: RequestInfo | URL, init?: RequestInit) => unknown) {
  global.fetch = jest.fn(async (input, init) => {
    const result = handler(input, init) as { ok?: boolean; body?: unknown };
    return {
      ok: result.ok ?? true,
      json: async () => result.body,
    } as Response;
  });
}

describe("ChatbotDemo", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (useAuth as jest.Mock).mockReturnValue({ user: { id: "user-1" } });
  });

  it("loads saved conversations and the latest conversation history", async () => {
    mockFetch((input) => {
      if (input === "/api/chat") {
        return { body: { conversations } };
      }
      if (input === "/api/chat/7") {
        return { body: { conversation: conversationDetail } };
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    });

    render(<ChatbotDemo />);

    expect((await screen.findAllByText("Physics lab")).length).toBeGreaterThan(0);
    expect(await screen.findByText("I drafted it.")).toBeInTheDocument();
    expect(screen.getByTestId("chat-action-card")).toHaveTextContent(
      "CREATE_TASK_DRAFT confirmed Physics lab report",
    );
  });

  it("deletes a saved conversation from the thread list", async () => {
    mockFetch((input, init) => {
      if (input === "/api/chat") {
        return { body: { conversations } };
      }
      if (input === "/api/chat/7" && init?.method === "DELETE") {
        return { body: { success: true, deleted_id: 7 } };
      }
      if (input === "/api/chat/7") {
        return { body: { conversation: conversationDetail } };
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    });

    render(<ChatbotDemo />);
    await screen.findAllByText("Physics lab");

    await userEvent.click(screen.getByRole("button", { name: /delete physics lab/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith("/api/chat/7", {
        method: "DELETE",
      });
    });
    expect(screen.queryByText("Physics lab")).not.toBeInTheDocument();
  });

  it("sends chat turns without a client user_id", async () => {
    mockFetch((input, init) => {
      if (input === "/api/chat" && !init) {
        return { body: { conversations } };
      }
      if (input === "/api/chat/7") {
        return { body: { conversation: conversationDetail } };
      }
      if (input === "/api/chat" && init?.method === "POST") {
        return {
          body: {
            conversation_id: 7,
            user_message_id: 80,
            assistant_message_id: 81,
            text: "Saved draft ready.",
            action: null,
          },
        };
      }
      throw new Error(`Unexpected fetch: ${String(input)}`);
    });

    render(<ChatbotDemo />);
    await screen.findAllByText("Physics lab");

    await userEvent.type(
      screen.getByPlaceholderText(/ask about your tasks/i),
      "Hello Ploty",
    );
    await userEvent.click(screen.getByRole("button", { name: /submit/i }));

    await screen.findByText("Saved draft ready.");

    const postCall = (global.fetch as jest.Mock).mock.calls.find(
      ([url, init]) => url === "/api/chat" && init?.method === "POST",
    );
    expect(JSON.parse(postCall[1].body)).toEqual({
      message: "Hello Ploty",
      conversation_id: 7,
    });
  });
});
