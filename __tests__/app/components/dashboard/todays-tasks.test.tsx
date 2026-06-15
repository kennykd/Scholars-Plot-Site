import { render, screen } from "@testing-library/react";
import { TodaysTasks } from "@/app/components/dashboard/todays-tasks";
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

describe("TodaysTasks", () => {
  beforeEach(() => {
    jest.useFakeTimers();
    jest.setSystemTime(new Date("2026-06-15T09:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("shows incomplete personal and assigned project tasks due from today through the next week", () => {
    render(
      <TodaysTasks
        tasks={[
          makeTask({
            id: 1,
            title: "Personal due today",
            deadline: "2026-06-15T12:00:00.000Z",
          }),
          makeTask({
            id: 2,
            projectId: 12,
            title: "Assigned project due this week",
            deadline: "2026-06-21T12:00:00.000Z",
          }),
          makeTask({
            id: 3,
            title: "Due after a week",
            deadline: "2026-06-23T12:00:00.000Z",
          }),
          makeTask({
            id: 4,
            title: "Already overdue",
            deadline: "2026-06-14T12:00:00.000Z",
          }),
          makeTask({
            id: 5,
            title: "Completed this week",
            deadline: "2026-06-17T12:00:00.000Z",
            status: "Completed",
          }),
        ]}
      />,
    );

    expect(screen.getByText("Personal due today")).toBeInTheDocument();
    expect(screen.getByText("Assigned project due this week")).toBeInTheDocument();
    expect(screen.queryByText("Due after a week")).not.toBeInTheDocument();
    expect(screen.queryByText("Already overdue")).not.toBeInTheDocument();
    expect(screen.queryByText("Completed this week")).not.toBeInTheDocument();
  });
});
