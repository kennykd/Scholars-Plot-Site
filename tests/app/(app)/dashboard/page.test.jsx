import { render, screen } from "@testing-library/react";
import DashboardPage from "./page";

jest.mock("next/navigation", () => ({
  redirect: jest.fn(),
}));

jest.mock("@/lib/firebase/auth", () => ({
  getSession: jest.fn().mockResolvedValue({
    id: "user-1",
    email: "test@example.com",
    name: "Test",
    image: null,
  }),
}));

jest.mock("@/lib/services/taskService", () => ({
  getTasks: jest.fn().mockResolvedValue([]),
}));

jest.mock("@/app/components/dashboard/todays-tasks", () => ({
  TodaysTasks: () => <div data-testid="todays-tasks" />,
}));
jest.mock("@/app/components/dashboard/weekly-schedule-mini", () => ({
  WeeklyScheduleMini: () => <div data-testid="weekly-schedule-mini" />,
}));
jest.mock("@/app/components/dashboard/quick-stats-bar", () => ({
  QuickStatsBar: () => <div data-testid="quick-stats-bar" />,
}));
jest.mock("@/app/components/dashboard/active-study-session", () => ({
  ActiveStudySession: () => <div data-testid="active-study-session" />,
}));
jest.mock("@/app/components/dashboard/upcoming-deadlines", () => ({
  UpcomingDeadlines: () => <div data-testid="upcoming-deadlines" />,
}));

describe("DashboardPage", () => {
  it("renders the dashboard heading and sub-header", async () => {
    const ui = await DashboardPage();
    render(ui);

    expect(screen.getByText(/COMMAND CENTER/i)).toBeInTheDocument();
    expect(screen.getByText(/SCHOLAR'S PLOT — DASHBOARD/i)).toBeInTheDocument();
  });

  it("renders all dashboard widget components", async () => {
    const ui = await DashboardPage();
    render(ui);

    expect(screen.getByTestId("quick-stats-bar")).toBeInTheDocument();
    expect(screen.getByTestId("todays-tasks")).toBeInTheDocument();
    expect(screen.getByTestId("active-study-session")).toBeInTheDocument();
    expect(screen.getByTestId("weekly-schedule-mini")).toBeInTheDocument();
    expect(screen.getByTestId("upcoming-deadlines")).toBeInTheDocument();
  });

  it("has the correct layout classes for the grid", async () => {
    const ui = await DashboardPage();
    const { container } = render(ui);
    const gridDiv = container.querySelector(".grid");

    expect(gridDiv).toHaveClass("md:grid-cols-2");
    expect(gridDiv).toHaveClass("lg:grid-cols-3");
  });
});
