import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { TaskInProgressButton } from "@/app/components/tasks/task-in-progress-button";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("TaskInProgressButton", () => {
  const refresh = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    (useRouter as jest.Mock).mockReturnValue({ refresh });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({}),
    }) as jest.Mock;
  });

  it("moves a completed task back to in progress", async () => {
    const user = userEvent.setup();

    render(<TaskInProgressButton taskId={42} initialStatus="Completed" />);

    await user.click(screen.getByRole("button", { name: /mark in progress/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/task/42",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "In_Progress" }),
      }),
    );
    await waitFor(() => expect(refresh).toHaveBeenCalled());
  });

  it("moves an in-progress task back to incomplete", async () => {
    const user = userEvent.setup();

    render(<TaskInProgressButton taskId={42} initialStatus="In_Progress" />);

    await user.click(screen.getByRole("button", { name: /mark incomplete/i }));

    expect(global.fetch).toHaveBeenCalledWith(
      "/api/task/42",
      expect.objectContaining({
        method: "PATCH",
        body: JSON.stringify({ status: "Pending" }),
      }),
    );
    expect(toast.success).toHaveBeenCalledWith("Task marked as pending");
  });
});
