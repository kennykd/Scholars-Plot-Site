import { act, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { NotificationPanel } from "@/app/components/notification/notification-panel";

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

const STORAGE_KEY = "scholars-plot:notifications";

function mockInviteFetch() {
  global.fetch = jest.fn(async () => ({
    ok: true,
    json: async () => ({ invites: [] }),
  })) as jest.Mock;
}

function mockServiceWorker() {
  const listeners = new Map<string, EventListener>();
  const addEventListener = jest.fn((type: string, listener: EventListener) => {
    listeners.set(type, listener);
  });
  const removeEventListener = jest.fn((type: string) => {
    listeners.delete(type);
  });

  Object.defineProperty(navigator, "serviceWorker", {
    configurable: true,
    value: {
      addEventListener,
      removeEventListener,
    },
  });

  return { addEventListener, listeners };
}

describe("NotificationPanel", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    mockInviteFetch();
  });

  it("shows stored web push notifications in a flyout above page content", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: "study-reminder:session-1",
          title: "Physics review",
          body: "Starts in 5 minutes",
          url: "/study/session-1",
          tag: "study-reminder:session-1",
          read: false,
          createdAt: "2026-06-15T09:00:00.000Z",
        },
      ]),
    );

    const user = userEvent.setup();
    render(<NotificationPanel />);

    await user.click(screen.getByRole("button", { name: /notifications/i }));

    const panel = await screen.findByRole("dialog", {
      name: /notifications/i,
    });

    expect(panel).toHaveClass("fixed");
    expect(panel).toHaveClass("z-[100]");
    expect(screen.getByText("Physics review")).toBeInTheDocument();
    expect(screen.getByText("Starts in 5 minutes")).toBeInTheDocument();
  });

  it("records service worker push messages into the notification inbox", async () => {
    const { addEventListener, listeners } = mockServiceWorker();
    const user = userEvent.setup();

    render(<NotificationPanel collapsed />);

    expect(addEventListener).toHaveBeenCalledWith(
      "message",
      expect.any(Function),
    );

    act(() => {
      listeners.get("message")?.({
        data: {
          type: "WEB_PUSH_NOTIFICATION_RECEIVED",
          notification: {
            title: "Chemistry sprint",
            body: "Open the study session",
            tag: "study-reminder:session-2",
            data: { url: "/study/session-2" },
          },
        },
      } as MessageEvent);
    });

    await user.click(screen.getByRole("button", { name: /notifications/i }));

    expect(await screen.findByText("Chemistry sprint")).toBeInTheDocument();
    expect(screen.getByText("Open the study session")).toBeInTheDocument();

    await waitFor(() => {
      expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")).toEqual([
        expect.objectContaining({
          title: "Chemistry sprint",
          url: "/study/session-2",
          tag: "study-reminder:session-2",
          read: false,
        }),
      ]);
    });
  });

  it("shows pending project invites and accepts them with the API action value", async () => {
    const fetchMock = jest.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = input.toString();

      if (url === "/api/project/invite" && init?.method === undefined) {
        return {
          ok: true,
          json: async () => ({
            invites: [
              {
                invite_id: 77,
                project_id: 12,
                invited_by: "owner-1",
                status: "pending",
                created_at: "2026-06-15T09:00:00.000Z",
                project: { project_name: "Capstone" },
                inviter: { user_name: "Project Owner" },
              },
            ],
          }),
        } as Response;
      }

      if (url === "/api/project/invite/77" && init?.method === "PATCH") {
        return {
          ok: true,
          json: async () => ({
            invite: {
              invite_id: 77,
              status: "accepted",
            },
          }),
        } as Response;
      }

      return {
        ok: false,
        json: async () => ({ message: "Unexpected request" }),
      } as Response;
    });
    global.fetch = fetchMock as jest.Mock;

    const user = userEvent.setup();
    render(<NotificationPanel />);

    await user.click(screen.getByRole("button", { name: /notifications/i }));

    expect(await screen.findByText("Capstone")).toBeInTheDocument();
    expect(screen.getByText("Invited by Project Owner")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: "Accept" }));

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith("/api/project/invite/77", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "accepted" }),
      });
    });

    await waitFor(() => {
      expect(screen.queryByText("Capstone")).not.toBeInTheDocument();
    });
  });

  it("dismisses a stored web push notification when its dismiss button is clicked", async () => {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify([
        {
          id: "study-reminder:session-1",
          title: "Physics review",
          body: "Starts in 5 minutes",
          url: "/study/session-1",
          tag: "study-reminder:session-1",
          read: false,
          createdAt: "2026-06-15T09:00:00.000Z",
        },
      ]),
    );

    const user = userEvent.setup();
    render(<NotificationPanel />);

    await user.click(screen.getByRole("button", { name: /notifications/i }));
    expect(await screen.findByText("Physics review")).toBeInTheDocument();

    await user.click(
      screen.getByRole("button", { name: /dismiss physics review/i }),
    );

    await waitFor(() => {
      expect(screen.queryByText("Physics review")).not.toBeInTheDocument();
    });
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "[]")).toEqual([]);
  });

  it("only shows notifications stored under the current user's key", async () => {
    localStorage.setItem(
      `${STORAGE_KEY}:user-1`,
      JSON.stringify([
        {
          id: "mine",
          title: "Your reminder",
          body: "Only for user-1",
          url: "/",
          tag: "mine",
          read: false,
          createdAt: "2026-06-15T09:00:00.000Z",
        },
      ]),
    );
    localStorage.setItem(
      `${STORAGE_KEY}:user-2`,
      JSON.stringify([
        {
          id: "theirs",
          title: "Someone elses reminder",
          body: "Only for user-2",
          url: "/",
          tag: "theirs",
          read: false,
          createdAt: "2026-06-15T09:00:00.000Z",
        },
      ]),
    );

    const user = userEvent.setup();
    render(<NotificationPanel userId="user-1" />);

    await user.click(screen.getByRole("button", { name: /notifications/i }));

    expect(await screen.findByText("Your reminder")).toBeInTheDocument();
    expect(
      screen.queryByText("Someone elses reminder"),
    ).not.toBeInTheDocument();
  });

  it("stores incoming push messages under the current user's key", async () => {
    const { listeners } = mockServiceWorker();

    render(<NotificationPanel userId="user-1" />);

    act(() => {
      listeners.get("message")?.({
        data: {
          type: "WEB_PUSH_NOTIFICATION_RECEIVED",
          notification: {
            title: "Chemistry sprint",
            body: "Open the study session",
            tag: "study-reminder:session-2",
            data: { url: "/study/session-2" },
          },
        },
      } as MessageEvent);
    });

    await waitFor(() => {
      expect(
        JSON.parse(localStorage.getItem(`${STORAGE_KEY}:user-1`) ?? "[]"),
      ).toEqual([
        expect.objectContaining({
          title: "Chemistry sprint",
          tag: "study-reminder:session-2",
        }),
      ]);
    });
    expect(localStorage.getItem(STORAGE_KEY)).toBeNull();
  });
});
