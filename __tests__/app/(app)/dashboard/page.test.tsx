import { render, screen } from "@testing-library/react";
import DashboardPage from "@/app/(app)/dashboard/page";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/firebase/auth";
import { getTasks, serializeTask } from "@/lib/services/taskService";
import { getStudySessionsForDashboard } from "@/lib/services/studySessionService";
import { getAnalyticsByUserId } from "@/lib/services/analyticService";
import { AnalyticsData } from "@/types";

jest.mock("next/navigation", () => ({
    redirect: jest.fn(() => {
        throw new Error("NEXT_REDIRECT");
    }),
}));

jest.mock("@/lib/firebase/auth", () => ({
    getSession: jest.fn(),
}));

jest.mock("@/lib/services/taskService", () => ({
    getTasks: jest.fn(),
    serializeTask: jest.fn(),
}));

jest.mock("@/lib/services/studySessionService", () => ({
    getStudySessionsForDashboard: jest.fn(),
}));

jest.mock("@/lib/services/analyticService", () => ({
    getAnalyticsByUserId: jest.fn(),
}));

jest.mock("@/app/components/dashboard/todays-tasks", () => ({
    TodaysTasks: ({ tasks }: any) => (
        <div data-testid="todays-tasks">
            Todays Tasks ({tasks.length})
        </div>
    ),
}));

jest.mock("@/app/components/dashboard/weekly-schedule-mini", () => ({
    WeeklyScheduleMini: ({ tasks }: any) => (
        <div data-testid="weekly-schedule">
            Weekly Schedule ({tasks.length})
        </div>
    ),
}));

jest.mock("@/app/components/dashboard/quick-stats-bar", () => ({
    QuickStatsBar: ({ data }: any) => (
        <div data-testid="quick-stats">
            Quick Stats {JSON.stringify(data)}
        </div>
    ),
}));

jest.mock("@/app/components/dashboard/active-study-session", () => ({
    ActiveStudySession: ({ sessions }: any) => (
        <div data-testid="active-sessions">
            Active Sessions ({sessions.length})
        </div>
    ),
}));

jest.mock("@/app/components/dashboard/upcoming-deadlines", () => ({
    UpcomingDeadlines: ({ tasks }: any) => (
        <div data-testid="upcoming-deadlines">
            Upcoming Deadlines ({tasks.length})
        </div>
    ),
}));

const mockedRedirect = jest.mocked(redirect);
const mockedGetSession = jest.mocked(getSession);
const mockedGetTasks = jest.mocked(getTasks);
const mockedSerializeTask = jest.mocked(serializeTask);
const mockedGetStudySessions = jest.mocked(
    getStudySessionsForDashboard
);
const mockedGetAnalytics = jest.mocked(
    getAnalyticsByUserId
);

describe("DashboardPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("redirects to login when session does not exist", async () => {
        mockedGetSession.mockResolvedValue(null);

        await expect(DashboardPage()).rejects.toThrow(
            "NEXT_REDIRECT"
        );

        expect(mockedRedirect).toHaveBeenCalledWith("/login");
    });

    it("loads dashboard data and renders all widgets", async () => {
        const taskRows = [
            { id: "1", title: "Task 1" },
            { id: "2", title: "Task 2" },
        ];

        const serializedTasks = [
            { id: "1", title: "Task 1" },
            { id: "2", title: "Task 2" },
        ];

        const sessions = [
            { id: "session-1" },
            { id: "session-2" },
        ];

        const analytics = {
            completedTasks: 10,
            studyHours: 5,
        };

        mockedGetSession.mockResolvedValue({
            id: "user-123",
        } as any);

        mockedGetTasks.mockResolvedValue(taskRows as any);

        mockedSerializeTask.mockImplementation(
            (task) => task as any
        );

        mockedGetStudySessions.mockResolvedValue(
            sessions as any
        );

        mockedGetAnalytics.mockResolvedValue(
            analytics as any
        );

        const Page = await DashboardPage();

        render(Page);

        expect(
            screen.getByText("COMMAND CENTER")
        ).toBeInTheDocument();

        expect(
            screen.getByText("SCHOLAR'S PLOT — DASHBOARD")
        ).toBeInTheDocument();

        expect(
            screen.getByTestId("todays-tasks")
        ).toHaveTextContent("Todays Tasks (2)");

        expect(
            screen.getByTestId("weekly-schedule")
        ).toHaveTextContent("Weekly Schedule (2)");

        expect(
            screen.getByTestId("active-sessions")
        ).toHaveTextContent("Active Sessions (2)");

        expect(
            screen.getByTestId("upcoming-deadlines")
        ).toHaveTextContent("Upcoming Deadlines (2)");

        expect(
            screen.getByTestId("quick-stats")
        ).toBeInTheDocument();

        expect(mockedGetTasks).toHaveBeenCalledWith(
            "user-123"
        );

        expect(
            mockedGetStudySessions
        ).toHaveBeenCalledWith("user-123");

        expect(
            mockedGetAnalytics
        ).toHaveBeenCalledWith("user-123");
    });

    it("serializes every task returned from getTasks", async () => {
        const taskRows = [
            { id: "1" },
            { id: "2" },
            { id: "3" },
        ];

        mockedGetSession.mockResolvedValue({
            id: "user-123",
        } as any);

        mockedGetTasks.mockResolvedValue(taskRows as any);

        mockedSerializeTask.mockImplementation(
            (task) => task as any
        );

        mockedGetStudySessions.mockResolvedValue([]);
        mockedGetAnalytics.mockResolvedValue({} as AnalyticsData);

        await DashboardPage();

        expect(mockedSerializeTask).toHaveBeenCalledTimes(3);

        expect(mockedSerializeTask).toHaveBeenNthCalledWith(
            1,
            taskRows[0]
        );

        expect(mockedSerializeTask).toHaveBeenNthCalledWith(
            2,
            taskRows[1]
        );

        expect(mockedSerializeTask).toHaveBeenNthCalledWith(
            3,
            taskRows[2]
        );
    });

    it("handles empty dashboard data", async () => {
        mockedGetSession.mockResolvedValue({
            id: "user-123",
        } as any);

        mockedGetTasks.mockResolvedValue([]);

        mockedGetStudySessions.mockResolvedValue([]);

        mockedGetAnalytics.mockResolvedValue({} as AnalyticsData);

        const Page = await DashboardPage();

        render(Page);

        expect(
            screen.getByTestId("todays-tasks")
        ).toHaveTextContent("Todays Tasks (0)");

        expect(
            screen.getByTestId("weekly-schedule")
        ).toHaveTextContent("Weekly Schedule (0)");

        expect(
            screen.getByTestId("active-sessions")
        ).toHaveTextContent("Active Sessions (0)");

        expect(
            screen.getByTestId("upcoming-deadlines")
        ).toHaveTextContent("Upcoming Deadlines (0)");
    });
});