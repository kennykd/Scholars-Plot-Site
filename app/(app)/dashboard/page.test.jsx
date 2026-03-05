import { render, screen } from "@testing-library/react";
import DashboardPage from "./page";

// Mock all the relevant components that are a part of this page
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
  it("renders the dashboard heading and sub-header", () => {
    render(<DashboardPage />);

    expect(screen.getByText(/COMMAND CENTER/i)).toBeInTheDocument();
    expect(screen.getByText(/SCHOLAR'S PLOT — DASHBOARD/i)).toBeInTheDocument();
  });

  it("renders all dashboard widget components", () => {
    render(<DashboardPage />);

    // Check if each mocked component is present by its test ID
    expect(screen.getByTestId("quick-stats-bar")).toBeInTheDocument();
    expect(screen.getByTestId("todays-tasks")).toBeInTheDocument();
    expect(screen.getByTestId("active-study-session")).toBeInTheDocument();
    expect(screen.getByTestId("weekly-schedule-mini")).toBeInTheDocument();
    expect(screen.getByTestId("upcoming-deadlines")).toBeInTheDocument();
  });

  it("has the correct layout classes for the grid", () => {
    const { container } = render(<DashboardPage />);
    const gridDiv = container.querySelector(".grid");

    // Verifying the responsive grid classes exist
    expect(gridDiv).toHaveClass("md:grid-cols-2");
    expect(gridDiv).toHaveClass("lg:grid-cols-3");
  });
});
