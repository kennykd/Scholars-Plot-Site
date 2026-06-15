import { render, screen } from "@testing-library/react";
import { UpcomingDeadlines } from "@/app/components/dashboard/upcoming-deadlines";
import type { Task } from "@/types";

function makeTask(overrides: Partial<Task>): Task {
  return {
    id: overrides.id ?? 1,
    projectId: null,
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

  it("shows only pending tasks due from today through the next week", () => {
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
    expect(screen.queryByText("Due after a week")).not.toBeInTheDocument();
    expect(screen.queryByText("Already overdue")).not.toBeInTheDocument();
    expect(screen.queryByText("Completed soon")).not.toBeInTheDocument();
  });
});
