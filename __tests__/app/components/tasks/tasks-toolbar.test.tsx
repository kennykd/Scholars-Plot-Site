/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { TasksToolbar } from "@/app/components/tasks/tasks-toolbar";
import type { Task } from "@/types";

const refresh = jest.fn();
const push = jest.fn();

jest.mock("next/navigation", () => ({
  useRouter: () => ({
    push,
    refresh,
  }),
}));

function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? 1,
    projectId: overrides.projectId ?? null,
    title: overrides.title ?? "Read chapter 4",
    description: overrides.description ?? null,
    deadline: overrides.deadline ?? "2099-06-20T09:00:00.000Z",
    priority: overrides.priority ?? 3,
    status: overrides.status ?? "Pending",
    createdAt: overrides.createdAt ?? "2099-06-01T09:00:00.000Z",
    completedAt: overrides.completedAt ?? null,
    attachments: overrides.attachments ?? [],
  };
}

describe("TasksToolbar", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    window.confirm = jest.fn(() => true);
    global.fetch = jest.fn(async () => ({
      ok: true,
      json: async () => ({}),
    })) as jest.Mock;
  });

  it("groups personal and project tasks by status and lets status buttons toggle off", async () => {
    const user = userEvent.setup();

    render(
      <TasksToolbar
        tasks={[makeTask({ id: 1, title: "Personal essay" })]}
        projectTasks={[
          makeTask({
            id: 2,
            projectId: 8,
            title: "Project outline",
            status: "In_Progress",
          }),
        ].map((task) => ({ ...task, projectName: "Research Sprint" }))}
      />,
    );

    expect(screen.queryByRole("tab", { name: /all/i })).not.toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /Pending/i })).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: /In Progress/i })).toBeInTheDocument();
    expect(screen.getByText("Personal essay")).toBeInTheDocument();
    expect(screen.getByText("Project outline")).toBeInTheDocument();
    expect(screen.getByText(/Project task/i)).toBeInTheDocument();
    expect(screen.getByText("Research Sprint")).toBeInTheDocument();

    await user.click(screen.getByRole("button", { name: /Pending/i }));

    expect(screen.queryByText("Personal essay")).not.toBeInTheDocument();
    expect(screen.getByText("Project outline")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /Pending/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("updates selected project tasks through the project task endpoint", async () => {
    const user = userEvent.setup();

    render(
      <TasksToolbar
        tasks={[]}
        projectTasks={[
          {
            ...makeTask({
              id: 9,
              projectId: 4,
              title: "Shared task",
              status: "In_Progress",
            }),
            projectName: "Capstone",
          },
        ]}
      />,
    );

    await user.click(screen.getByRole("checkbox", { name: /Select Shared task/i }));
    await user.click(screen.getByRole("button", { name: /Mark as Done/i }));

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/project/task/9",
        expect.objectContaining({
          method: "PATCH",
          body: JSON.stringify({ status: "Completed" }),
        }),
      );
    });
  });
});
