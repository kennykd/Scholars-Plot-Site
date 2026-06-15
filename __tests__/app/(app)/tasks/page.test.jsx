import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useRouter } from "next/navigation";
import { TasksToolbar } from "@/app/components/tasks/tasks-toolbar";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}));

jest.mock("@/app/components/tasks/task-card", () => ({
  TaskCard: ({ task }) => <div data-testid="task-card">{task.title}</div>,
}));

const isoDays = (n) =>
  new Date(Date.now() + n * 24 * 60 * 60 * 1000).toISOString();

const fixtureTasks = [
  {
    id: 1,
    projectId: null,
    title: "Calculus II Problem Set 5",
    description: null,
    deadline: isoDays(2),
    priority: 4.5,
    status: "In_Progress",
    createdAt: isoDays(-7),
    completedAt: null,
  },
  {
    id: 2,
    projectId: null,
    title: "Data Structures Assignment 3",
    description: null,
    deadline: isoDays(3),
    priority: 5,
    status: "In_Progress",
    createdAt: isoDays(-5),
    completedAt: null,
  },
  {
    id: 3,
    projectId: null,
    title: "Physics Lab Report",
    description: null,
    deadline: isoDays(1),
    priority: 4,
    status: "Pending",
    createdAt: isoDays(-10),
    completedAt: null,
  },
  {
    id: 4,
    projectId: null,
    title: "Web Development Milestone 1",
    description: null,
    deadline: isoDays(-1),
    priority: 5,
    status: "Completed",
    createdAt: isoDays(-14),
    completedAt: isoDays(-2),
  },
];

describe("TasksToolbar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useRouter.mockReturnValue({ push: jest.fn(), refresh: jest.fn() });
  });

  it("renders all tasks sorted by priority by default", () => {
    render(<TasksToolbar tasks={fixtureTasks} />);

    const expectedTitles = [...fixtureTasks]
      .sort((a, b) => b.priority - a.priority)
      .map((task) => task.title);

    const titles = screen
      .getAllByTestId("task-card")
      .map((card) => card.textContent);

    expect(titles).toEqual(expectedTitles);
  });

  it("filters to completed tasks", async () => {
    render(<TasksToolbar tasks={fixtureTasks} />);
    const user = userEvent.setup();

    const expectedTitles = fixtureTasks
      .filter((task) => task.status === "Completed")
      .sort((a, b) => b.priority - a.priority)
      .map((task) => task.title);

    await user.click(screen.getByRole("tab", { name: /completed/i }));

    await waitFor(() => {
      const titles = screen
        .getAllByTestId("task-card")
        .map((card) => card.textContent);
      expect(titles).toEqual(expectedTitles);
    });
  });

  it("filters to in-progress tasks", async () => {
    render(<TasksToolbar tasks={fixtureTasks} />);
    const user = userEvent.setup();

    const expectedTitles = fixtureTasks
      .filter((task) => task.status === "In_Progress")
      .sort((a, b) => b.priority - a.priority)
      .map((task) => task.title);

    await user.click(screen.getByRole("tab", { name: /in progress/i }));

    await waitFor(() => {
      const titles = screen
        .getAllByTestId("task-card")
        .map((card) => card.textContent);
      expect(titles).toEqual(expectedTitles);
    });
  });

  it("renders an empty-state message when no tasks match", async () => {
    render(<TasksToolbar tasks={fixtureTasks.filter((t) => t.status === "Pending")} />);
    const user = userEvent.setup();

    await user.click(screen.getByRole("tab", { name: /completed/i }));

    await waitFor(() => {
      expect(screen.getByText(/no tasks found/i)).toBeInTheDocument();
    });
  });
});
