import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import TasksPage from "./page";
import { mockTasks } from "@/lib/mock-data";

jest.mock("@/app/components/tasks/task-card", () => ({
  TaskCard: ({ task }) => <div data-testid="task-card">{task.title}</div>,
}));

describe("TasksPage", () => {
  it("renders page title, count and new task link", () => {
    render(<TasksPage />);

    expect(screen.getByRole("heading", { name: /tasks/i })).toBeInTheDocument();
    expect(
      screen.getByText(new RegExp(`^${mockTasks.length} tasks$`, "i")),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /new task/i })).toHaveAttribute(
      "href",
      "/tasks/new",
    );
  });

  it("shows tasks sorted by priority by default", () => {
    render(<TasksPage />);

    const expectedTitles = [...mockTasks]
      .sort((a, b) => b.priority - a.priority)
      .map((task) => task.title);

    const titles = screen
      .getAllByTestId("task-card")
      .map((card) => card.textContent);

    expect(titles).toEqual(expectedTitles);
  });

  it("filters to done tasks", async () => {
    render(<TasksPage />);
    const user = userEvent.setup();

    const expectedTitles = mockTasks
      .filter((task) => task.status === "done")
      .sort((a, b) => b.priority - a.priority)
      .map((task) => task.title);

    await user.click(screen.getByRole("tab", { name: /done/i }));

    await waitFor(() => {
      const titles = screen
        .getAllByTestId("task-card")
        .map((card) => card.textContent);
      expect(titles).toEqual(expectedTitles);
      expect(
        screen.getByText(new RegExp(`^${expectedTitles.length} tasks$`, "i")),
      ).toBeInTheDocument();
    });
  });

  it("filters to in-progress tasks", async () => {
    render(<TasksPage />);
    const user = userEvent.setup();

    const expectedTitles = mockTasks
      .filter((task) => task.status === "in-progress")
      .sort((a, b) => b.priority - a.priority)
      .map((task) => task.title);

    await user.click(screen.getByRole("tab", { name: /in progress/i }));

    await waitFor(() => {
      const titles = screen
        .getAllByTestId("task-card")
        .map((card) => card.textContent);
      expect(titles).toEqual(expectedTitles);
      expect(
        screen.getByText(new RegExp(`^${expectedTitles.length} tasks$`, "i")),
      ).toBeInTheDocument();
    });
  });
});
