import { render, screen } from "@testing-library/react";
import AnalyticsPage from "@/app/(app)/analytics/page";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/firebase/auth";
import { getAnalyticsByUserId } from "@/lib/services/analyticService";

type Session = Awaited<ReturnType<typeof getSession>>;
type Analytics = Awaited<ReturnType<typeof getAnalyticsByUserId>>;

jest.mock("next/navigation", () => ({
    redirect: jest.fn(() => {
        throw new Error("NEXT_REDIRECT");
    }),
}));

jest.mock("@/lib/firebase/auth", () => ({
    getSession: jest.fn(),
}));

jest.mock("@/lib/services/analyticService", () => ({
    getAnalyticsByUserId: jest.fn(),
}));

jest.mock(
    "@/app/components/analytics/analytics-client",
    () => ({
        AnalyticsDashboardView: ({ data }: { data: unknown }) => (
            <div data-testid="analytics-dashboard">
                {JSON.stringify(data)}
            </div>
        ),
    })
);

const mockedRedirect = jest.mocked(redirect);
const mockedGetSession = jest.mocked(getSession);
const mockedGetAnalytics = jest.mocked(
    getAnalyticsByUserId
);

describe("AnalyticsPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("redirects when user is not authenticated", async () => {
        mockedGetSession.mockResolvedValue(null);

        await expect(AnalyticsPage()).rejects.toThrow(
            "NEXT_REDIRECT"
        );

        expect(mockedRedirect).toHaveBeenCalledWith(
            "/login"
        );
    });

    it("loads analytics and renders dashboard", async () => {
        const analyticsData = {
            totalStudyMinutes: 500,
            completedTasks: 25,
        };

        mockedGetSession.mockResolvedValue({
            id: "user-123",
            email: "user@example.com",
            name: null,
            image: null,
        } satisfies Session);

        mockedGetAnalytics.mockResolvedValue(
            analyticsData as unknown as Analytics
        );

        const Page = await AnalyticsPage();

        render(Page);

        expect(
            screen.getByTestId("analytics-dashboard")
        ).toBeInTheDocument();

        expect(mockedGetAnalytics).toHaveBeenCalledWith(
            "user-123"
        );
    });

    it("passes analytics data to dashboard view", async () => {
        const analyticsData = {
            totalStudyMinutes: 120,
            completedTasks: 5,
        };

        mockedGetSession.mockResolvedValue({
            id: "user-123",
            email: "user@example.com",
            name: null,
            image: null,
        } satisfies Session);

        mockedGetAnalytics.mockResolvedValue(
            analyticsData as unknown as Analytics
        );

        const Page = await AnalyticsPage();

        render(Page);

        expect(
            screen.getByTestId("analytics-dashboard")
        ).toHaveTextContent(
            JSON.stringify(analyticsData)
        );
    });
});
