import { render, screen } from "@testing-library/react";
import TaskDetailPage from "@/app/(app)/tasks/[id]/page";
import { getSession } from "@/lib/firebase/auth";
import {
  getStudySessionsForTask,
  getTaskById,
  serializeTask,
} from "@/lib/services/taskService";
import { listTaskAttachments } from "@/lib/services/attachmentService";

jest.mock(
  "@/app/components/tasks/task-delete-button",
  () => ({
    TaskDeleteButton: () => <button type="button">Delete</button>,
  }),
);

jest.mock(
  "@/app/components/tasks/task-complete-button",
  () => ({
    TaskCompleteButton: ({
      initialStatus,
    }: {
      initialStatus: string;
    }) => (
      <button type="button">
        {initialStatus === "Completed"
          ? "Mark incomplete"
          : "Mark Complete"}
      </button>
    ),
  }),
);

jest.mock(
  "@/app/components/tasks/task-in-progress-button",
  () => ({
    TaskInProgressButton: ({
      initialStatus,
    }: {
      initialStatus: string;
    }) => (
      <button type="button">
        {initialStatus === "In_Progress"
          ? "Mark incomplete from progress"
          : "Mark in progress"}
      </button>
    ),
  }),
);

jest.mock(
  "@/app/components/tasks/task-attachment-delete-button",
  () => ({
    TaskAttachmentDeleteButton: () => (
      <button type="button">Remove attachment</button>
    ),
  }),
);

// ---- Typed mocks ----
const mockGetSession = getSession as jest.MockedFunction<typeof getSession>;
const mockGetTaskById = getTaskById as jest.MockedFunction<typeof getTaskById>;
const mockSerializeTask =
  serializeTask as jest.MockedFunction<typeof serializeTask>;
const mockListTaskAttachments =
  listTaskAttachments as jest.MockedFunction<typeof listTaskAttachments>;
const mockGetStudySessionsForTask =
  getStudySessionsForTask as jest.MockedFunction<
    typeof getStudySessionsForTask
  >;

describe("TaskDetailPage study-session actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();

    mockGetSession.mockResolvedValue({ id: "user-1" } as any);
    mockGetTaskById.mockResolvedValue({ task_id: 42 } as any);
    mockListTaskAttachments.mockResolvedValue([]);
    mockGetStudySessionsForTask.mockResolvedValue([]);

    mockSerializeTask.mockReturnValue({
      id: 42,
      projectId: null,
      title: "Physics Final",
      description: "Review mechanics",
      deadline: "2099-03-31T23:59:00.000Z",
      priority: 4,
      status: "Pending",
      createdAt: "2099-03-01T00:00:00.000Z",
      completedAt: null,
      attachments: [],
    });
  });

  it("does not show a start-study-session action when no sessions are planned", async () => {
    render(await TaskDetailPage({ params: Promise.resolve({ id: "42" }) }));

    expect(
      screen.getByText(/No study sessions planned yet/i),
    ).toBeInTheDocument();

    expect(
      screen.queryByRole("link", { name: /start study session/i }),
    ).not.toBeInTheDocument();

    expect(
      screen.queryByRole("link", { name: /plan study/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the AI-readable helper text above task attachments", async () => {
    mockListTaskAttachments.mockResolvedValue([
      {
        id: 7,
        taskId: 42,
        userId: "user-1",
        fileName: "rubric.pdf",
        fileKey: "uploads/rubric.pdf",
        fileType: "application/pdf",
        url: "https://example.com/rubric.pdf",
        uploadedAt: "2099-03-01T00:00:00.000Z",
      },
    ] as any);

    render(await TaskDetailPage({ params: Promise.resolve({ id: "42" }) }));

    expect(
      screen.getByText("AI can read: .pdf, .jpg, .jpeg, .png, .webp, .gif"),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("link", { name: /rubric.pdf/i }),
    ).toHaveAttribute("href", "https://example.com/rubric.pdf");
  });

  it("keeps incomplete and in-progress actions available after completion", async () => {
    mockSerializeTask.mockReturnValue({
      id: 42,
      projectId: null,
      title: "Physics Final",
      description: "Review mechanics",
      deadline: "2099-03-31T23:59:00.000Z",
      priority: 4,
      status: "Completed",
      createdAt: "2099-03-01T00:00:00.000Z",
      completedAt: "2099-03-15T00:00:00.000Z",
      attachments: [],
    });

    render(await TaskDetailPage({ params: Promise.resolve({ id: "42" }) }));

    expect(
      screen.getByRole("button", { name: /mark incomplete/i }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /mark in progress/i }),
    ).toBeInTheDocument();
  });

  it("keeps the incomplete toggle available while a task is in progress", async () => {
    mockSerializeTask.mockReturnValue({
      id: 42,
      projectId: null,
      title: "Physics Final",
      description: "Review mechanics",
      deadline: "2099-03-31T23:59:00.000Z",
      priority: 4,
      status: "In_Progress",
      createdAt: "2099-03-01T00:00:00.000Z",
      completedAt: null,
      attachments: [],
    });

    render(await TaskDetailPage({ params: Promise.resolve({ id: "42" }) }));

    expect(
      screen.getByRole("button", {
        name: /mark incomplete from progress/i,
      }),
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /mark complete/i }),
    ).toBeInTheDocument();
  });
});