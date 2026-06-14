import { render, screen } from "@testing-library/react";
import TaskDetailPage from "./page";
import { getSession } from "@/lib/firebase/auth";
import {
  getStudySessionsForTask,
  getTaskById,
  serializeTask,
} from "@/lib/services/taskService";
import { listTaskAttachments } from "@/lib/services/attachmentService";

jest.mock("@/lib/firebase/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/services/taskService", () => ({
  getStudySessionsForTask: jest.fn(),
  getTaskById: jest.fn(),
  serializeTask: jest.fn(),
  TaskServiceError: class TaskServiceError extends Error {
    constructor(status, message) {
      super(message);
      this.status = status;
    }
  },
}));

jest.mock("@/lib/services/attachmentService", () => ({
  listTaskAttachments: jest.fn(),
}));

jest.mock("../../../components/tasks/task-delete-button", () => ({
  TaskDeleteButton: () => <button type="button">Delete</button>,
}));

jest.mock("../../../components/tasks/task-complete-button", () => ({
  TaskCompleteButton: () => <button type="button">Mark Complete</button>,
}));

jest.mock("../../../components/tasks/task-in-progress-button", () => ({
  TaskInProgressButton: () => <button type="button">Mark in progress</button>,
}));

jest.mock("../../../components/tasks/task-attachment-delete-button", () => ({
  TaskAttachmentDeleteButton: () => <button type="button">Remove attachment</button>,
}));

describe("TaskDetailPage study-session actions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    getSession.mockResolvedValue({ id: "user-1" });
    getTaskById.mockResolvedValue({ task_id: 42 });
    listTaskAttachments.mockResolvedValue([]);
    getStudySessionsForTask.mockResolvedValue([]);
    serializeTask.mockReturnValue({
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

    expect(screen.getByText(/No study sessions planned yet/i)).toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /start study session/i }),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByRole("link", { name: /plan study/i }),
    ).not.toBeInTheDocument();
  });

  it("shows the AI-readable helper text above task attachments", async () => {
    listTaskAttachments.mockResolvedValue([
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
    ]);

    render(await TaskDetailPage({ params: Promise.resolve({ id: "42" }) }));

    expect(
      screen.getByText("AI can read: .pdf, .jpg, .jpeg, .png, .webp, .gif"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /rubric.pdf/i })).toHaveAttribute(
      "href",
      "https://example.com/rubric.pdf",
    );
  });
});
