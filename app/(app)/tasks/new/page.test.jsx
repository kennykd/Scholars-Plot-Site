import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import TaskForm from "./page";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }) => (
    <button
      type="button"
      onClick={() => onSelect?.(new Date("2026-03-20T00:00:00.000Z"))}
    >
      Select March 20
    </button>
  ),
}));

jest.mock("@/app/components/tasks/study-session-prompt", () => ({
  StudySessionPrompt: ({ taskName, onSkip }) => (
    <div data-testid="study-prompt">
      <p>Want to schedule {taskName}?</p>
      <button onClick={onSkip}>Skip</button>
    </div>
  ),
}));

describe("TaskForm", () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useRouter.mockReturnValue({ push: mockPush });
  });

  it("renders the task form", () => {
    render(<TaskForm />);

    expect(
      screen.getByRole("heading", { name: /new task/i }),
    ).toBeInTheDocument();
    expect(screen.getByLabelText(/task name/i)).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create task/i }),
    ).toBeInTheDocument();
  });

  it("shows title validation error when form is submitted without a title", () => {
    render(<TaskForm />);

    const form = screen
      .getByRole("button", { name: /create task/i })
      .closest("form");
    fireEvent.submit(form);

    expect(toast.error).toHaveBeenCalledWith("Task name is required");
  });

  it("shows deadline validation error when title is present but no deadline is selected", () => {
    render(<TaskForm />);

    fireEvent.change(screen.getByLabelText(/task name/i), {
      target: { value: "Valid Title" },
    });

    const form = screen
      .getByRole("button", { name: /create task/i })
      .closest("form");
    fireEvent.submit(form);

    expect(toast.error).toHaveBeenCalledWith("Deadline is required");
  });

  it("creates a task and shows the study prompt", async () => {
    render(<TaskForm />);

    fireEvent.change(screen.getByLabelText(/task name/i), {
      target: { value: "Data Science Quiz" },
    });

    fireEvent.click(screen.getByRole("button", { name: /pick a date/i }));
    fireEvent.click(screen.getByRole("button", { name: /select march 20/i }));

    const form = screen
      .getByRole("button", { name: /create task/i })
      .closest("form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Task created! 🎉");
    });
    expect(screen.getByTestId("study-prompt")).toBeInTheDocument();
    expect(screen.getByText(/data science quiz/i)).toBeInTheDocument();
  });

  it("routes to /tasks when skip is clicked in the prompt", async () => {
    render(<TaskForm />);

    fireEvent.change(screen.getByLabelText(/task name/i), {
      target: { value: "Test Task" },
    });
    fireEvent.click(screen.getByRole("button", { name: /pick a date/i }));
    fireEvent.click(screen.getByRole("button", { name: /select march 20/i }));

    const form = screen
      .getByRole("button", { name: /create task/i })
      .closest("form");
    fireEvent.submit(form);

    fireEvent.click(await screen.findByRole("button", { name: /skip/i }));

    expect(mockPush).toHaveBeenCalledWith("/tasks");
  });

  it("updates attachment name when a file is selected", async () => {
    const { container } = render(<TaskForm />);
    const file = new File(["test contents"], "notes.pdf", {
      type: "application/pdf",
    });

    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("notes.pdf")).toBeInTheDocument();
  });
});
