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
      onClick={() => onSelect?.(new Date("2099-03-20T00:00:00.000Z"))}
    >
      Select March 20
    </button>
  ),
}));

describe("TaskForm", () => {
  const mockPush = jest.fn();
  const mockRefresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    useRouter.mockReturnValue({ push: mockPush, refresh: mockRefresh });
    global.fetch = jest.fn();
  });

  afterEach(() => {
    delete global.fetch;
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

  it("posts to /api/task and redirects on success", async () => {
    global.fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ task: { id: 42 } }),
    });

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
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/task",
        expect.objectContaining({ method: "POST" }),
      );
    });

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Task created");
      expect(mockPush).toHaveBeenCalledWith("/tasks");
    });
  });

  it("shows an error toast when the API responds with a failure", async () => {
    global.fetch.mockResolvedValue({
      ok: false,
      json: async () => ({ message: "Validation failed", errors: { title: ["bad"] } }),
    });

    render(<TaskForm />);

    fireEvent.change(screen.getByLabelText(/task name/i), {
      target: { value: "Bad" },
    });
    fireEvent.click(screen.getByRole("button", { name: /pick a date/i }));
    fireEvent.click(screen.getByRole("button", { name: /select march 20/i }));

    const form = screen
      .getByRole("button", { name: /create task/i })
      .closest("form");
    fireEvent.submit(form);

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalled();
    });
    expect(mockPush).not.toHaveBeenCalled();
  });
});
