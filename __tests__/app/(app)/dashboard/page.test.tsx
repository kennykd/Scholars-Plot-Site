import { render, screen } from "@testing-library/react";
import DashboardPage from "@/app/(app)/dashboard/page";
import { getSession } from "@/lib/firebase/auth";
import {
  getProjectTask,
  getTasks,
  serializeTask,
} from "@/lib/services/taskService";
import { getStudySessionsForDashboard } from "@/lib/services/studySessionService";
import { getAnalyticsByUserId } from "@/lib/services/analyticService";

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

jest.mock("@/lib/firebase/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/services/taskService", () => ({
  getTasks: jest.fn(),
  getProjectTask: jest.fn(),
  serializeTask: jest.fn(),
}));

jest.mock("@/lib/services/studySessionService", () => ({
  getStudySessionsForDashboard: jest.fn(),
}));

jest.mock("@/lib/services/analyticService", () => ({
  getAnalyticsByUserId: jest.fn(),
}));

jest.mock("@/app/components/dashboard/todays-tasks", () => ({
  TodaysTasks: ({ tasks }: { tasks: Array<{ title: string }> }) => (
    <section data-testid="todays-tasks">{tasks.map((task) => task.title).join("|")}</section>
  ),
}));

jest.mock("@/app/components/dashboard/upcoming-deadlines", () => ({
  UpcomingDeadlines: ({ tasks }: { tasks: Array<{ title: string }> }) => (
    <section data-testid="upcoming-deadlines">{tasks.map((task) => task.title).join("|")}</section>
  ),
}));

jest.mock("@/app/components/dashboard/weekly-schedule-mini", () => ({
  WeeklyScheduleMini: () => <section data-testid="weekly-schedule" />,
}));

jest.mock("@/app/components/dashboard/quick-stats-bar", () => ({
  QuickStatsBar: () => <section data-testid="quick-stats" />,
}));

jest.mock("@/app/components/dashboard/active-study-session", () => ({
  ActiveStudySession: () => <section data-testid="active-study-session" />,
}));

const personalTaskRow = {
  task_id: 1,
  project_id: null,
  task_name: "Personal task",
  task_description: null,
  task_deadline: new Date("2026-06-16T09:00:00.000Z"),
  task_priority: 3,
  task_status: "Pending",
  task_created_at: new Date("2026-06-01T09:00:00.000Z"),
  task_completed_at: null,
};

const assignedProjectTaskRow = {
  ...personalTaskRow,
  task_id: 2,
  project_id: 12,
  task_name: "Assigned project task",
};

describe("DashboardPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (getSession as jest.Mock).mockResolvedValue({ id: "user-1" });
    (getTasks as jest.Mock).mockResolvedValue([personalTaskRow]);
    (getProjectTask as jest.Mock).mockResolvedValue([assignedProjectTaskRow]);
    (getStudySessionsForDashboard as jest.Mock).mockResolvedValue([]);
    (getAnalyticsByUserId as jest.Mock).mockResolvedValue(null);
    (serializeTask as jest.Mock).mockImplementation((row) => ({
      id: row.task_id,
      projectId: row.project_id,
      title: row.task_name,
      description: row.task_description,
      deadline: row.task_deadline.toISOString(),
      priority: Number(row.task_priority),
      status: row.task_status,
      createdAt: row.task_created_at.toISOString(),
      completedAt: row.task_completed_at?.toISOString() ?? null,
    }));
  });

  it("feeds personal tasks and assigned project tasks into dashboard task cards", async () => {
    render(await DashboardPage());

    expect(getProjectTask).toHaveBeenCalledWith("user-1");
    expect(screen.getByTestId("todays-tasks")).toHaveTextContent("Personal task");
    expect(screen.getByTestId("todays-tasks")).toHaveTextContent("Assigned project task");
    expect(screen.getByTestId("upcoming-deadlines")).toHaveTextContent("Personal task");
    expect(screen.getByTestId("upcoming-deadlines")).toHaveTextContent("Assigned project task");
  });
});
