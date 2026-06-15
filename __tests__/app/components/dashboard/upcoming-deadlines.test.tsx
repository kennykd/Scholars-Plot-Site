import { render, screen } from "@testing-library/react";
import { UpcomingDeadlines } from "@/app/components/dashboard/upcoming-deadlines";
import type { Task } from "@/types";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: overrides.id ?? 1,
    projectId: overrides.projectId ?? null,
    title: overrides.title ?? "Task",
    description: null,
    deadline: overrides.deadline ?? "2026-06-15T12:00:00.000Z",
    priority: overrides.priority ?? 3,
    status: overrides.status ?? "Pending",
    createdAt: "2026-06-01T12:00:00.000Z",
    completedAt: null,
  };
}

describe("UpcomingDeadlines", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-15T09:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows the closest incomplete future deadlines without a seven-day cap", () => {
    render(
      <UpcomingDeadlines
        tasks={[
          makeTask({
            id: 1,
            title: "Due today",
            deadline: "2026-06-15T12:00:00.000Z",
          }),
          makeTask({
            id: 2,
            title: "Due in seven days",
            deadline: "2026-06-22T09:00:00.000Z",
          }),
          makeTask({
            id: 3,
            title: "Due after a week",
            deadline: "2026-06-23T09:00:00.000Z",
          }),
          makeTask({
            id: 4,
            title: "Already overdue",
            deadline: "2026-06-14T09:00:00.000Z",
          }),
          makeTask({
            id: 5,
            title: "Completed soon",
            deadline: "2026-06-17T09:00:00.000Z",
            status: "Completed",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Due today")).toBeInTheDocument();
    expect(screen.getByText("Due in seven days")).toBeInTheDocument();
    expect(screen.getByText("Due after a week")).toBeInTheDocument();
    expect(screen.queryByText("Already overdue")).not.toBeInTheDocument();
    expect(screen.queryByText("Completed soon")).not.toBeInTheDocument();
  });

  it("limits the list to the closest several deadlines", () => {
    render(
      <UpcomingDeadlines
        tasks={[
          makeTask({ id: 1, title: "First", deadline: "2026-06-16T09:00:00.000Z" }),
          makeTask({ id: 2, title: "Second", deadline: "2026-06-17T09:00:00.000Z" }),
          makeTask({ id: 3, title: "Third", deadline: "2026-06-18T09:00:00.000Z" }),
          makeTask({ id: 4, title: "Fourth", deadline: "2026-06-19T09:00:00.000Z" }),
          makeTask({ id: 5, title: "Fifth", deadline: "2026-06-20T09:00:00.000Z" }),
          makeTask({ id: 6, title: "Sixth", deadline: "2026-06-21T09:00:00.000Z" }),
        ]}
      />,
    );

    expect(screen.getByText("First")).toBeInTheDocument();
    expect(screen.getByText("Fifth")).toBeInTheDocument();
    expect(screen.queryByText("Sixth")).not.toBeInTheDocument();
  });

  it("links project task deadlines back to their project", () => {
    render(
      <UpcomingDeadlines
        tasks={[
          makeTask({
            id: 42,
            projectId: 12,
            title: "Project task",
            deadline: "2026-06-16T09:00:00.000Z",
          }),
        ]}
      />,
    );

    expect(screen.getByRole("link", { name: /Project task/i })).toHaveAttribute(
      "href",
      "/projects?projectId=project-12",
    );
  });
});
