import { render, screen } from "@testing-library/react";
import CalendarPage from "@/app/(app)/calendar/page";

import { redirect } from "next/navigation";
import { getSession } from "@/lib/firebase/auth";
import { getTasks, serializeTask } from "@/lib/services/taskService";
import prisma from "@/lib/prisma";

type Session = Awaited<ReturnType<typeof getSession>>;
type TaskRows = Awaited<ReturnType<typeof getTasks>>;
type SerializedTask = ReturnType<typeof serializeTask>;
type StudySessionRows = Awaited<ReturnType<typeof prisma.studySessionUser.findMany>>;

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

jest.mock("@/lib/prisma", () => ({
    __esModule: true,
    default: {
        studySessionUser: {
            findMany: jest.fn(),
        },
    },
}));

jest.mock("@/app/components/calendar/calendar-view", () => ({
    CalendarView: ({
        tasks,
        sessions,
    }: {
        tasks: unknown[];
        sessions: unknown[];
    }) => (
        <div data-testid="calendar-view">
            <div data-testid="task-count">{tasks.length}</div>
            <div data-testid="session-count">{sessions.length}</div>
        </div>
    ),
}));

const mockedRedirect = jest.mocked(redirect);
const mockedGetSession = jest.mocked(getSession);
const mockedGetTasks = jest.mocked(getTasks);
const mockedSerializeTask = jest.mocked(serializeTask);
const mockedFindMany = jest.mocked(
    prisma.studySessionUser.findMany
);

describe("CalendarPage", () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    it("redirects when user is not authenticated", async () => {
        mockedGetSession.mockResolvedValue(null);

        await expect(CalendarPage()).rejects.toThrow(
            "NEXT_REDIRECT"
        );

        expect(mockedRedirect).toHaveBeenCalledWith("/login");
    });

    it("renders calendar with tasks and study sessions", async () => {
        mockedGetSession.mockResolvedValue({
            id: "user-123",
            email: "user@example.com",
            name: null,
            image: null,
        } satisfies Session);

        const taskRows = [
            { id: "task-1", title: "Task 1" },
            { id: "task-2", title: "Task 2" },
        ];

        const serializedTasks = [
            { id: "task-1", title: "Task 1" },
            { id: "task-2", title: "Task 2" },
        ];

        mockedGetTasks.mockResolvedValue(taskRows as unknown as TaskRows);

        mockedSerializeTask
            .mockReturnValueOnce(serializedTasks[0] as unknown as SerializedTask)
            .mockReturnValueOnce(serializedTasks[1] as unknown as SerializedTask);

        mockedFindMany.mockResolvedValue([
            {
                study_session_id: "session-1",
                study_session: {
                    study_session_name: "Math Revision",
                    study_session_scheduled_at: new Date(
                        "2025-01-01T10:00:00Z"
                    ),
                    focus_minutes: 60,
                },
            },
            {
                study_session_id: "session-2",
                study_session: {
                    study_session_name: "Physics",
                    study_session_scheduled_at: new Date(
                        "2025-01-02T10:00:00Z"
                    ),
                    focus_minutes: 45,
                },
            },
        ] as unknown as StudySessionRows);

        const Page = await CalendarPage();

        render(Page);

        expect(
            screen.getByTestId("calendar-view")
        ).toBeInTheDocument();

        expect(
            screen.getByTestId("task-count")
        ).toHaveTextContent("2");

        expect(
            screen.getByTestId("session-count")
        ).toHaveTextContent("2");

        expect(mockedGetTasks).toHaveBeenCalledWith(
            "user-123"
        );

        expect(mockedFindMany).toHaveBeenCalledWith({
            where: {
                user_id: "user-123",
            },
            include: {
                study_session: true,
            },
        });
    });

    it("serializes all tasks", async () => {
        mockedGetSession.mockResolvedValue({
            id: "user-123",
            email: "user@example.com",
            name: null,
            image: null,
        } satisfies Session);

        const taskRows = [
            { id: "1" },
            { id: "2" },
            { id: "3" },
        ];

        mockedGetTasks.mockResolvedValue(taskRows as unknown as TaskRows);

        mockedSerializeTask.mockImplementation(
            (task) => task as unknown as SerializedTask
        );

        mockedFindMany.mockResolvedValue([]);

        await CalendarPage();

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

    it("renders empty state data", async () => {
        mockedGetSession.mockResolvedValue({
            id: "user-123",
            email: "user@example.com",
            name: null,
            image: null,
        } satisfies Session);

        mockedGetTasks.mockResolvedValue([]);
        mockedFindMany.mockResolvedValue([]);

        const Page = await CalendarPage();

        render(Page);

        expect(
            screen.getByTestId("task-count")
        ).toHaveTextContent("0");

        expect(
            screen.getByTestId("session-count")
        ).toHaveTextContent("0");
    });

    it("maps study session data correctly", async () => {
        mockedGetSession.mockResolvedValue({
            id: "user-123",
            email: "user@example.com",
            name: null,
            image: null,
        } satisfies Session);

        mockedGetTasks.mockResolvedValue([]);
        mockedSerializeTask.mockImplementation(
            (task) => task as unknown as SerializedTask
        );

        const sessionDate = new Date(
            "2025-01-01T12:00:00.000Z"
        );

        mockedFindMany.mockResolvedValue([
            {
                study_session_id: "session-1",
                study_session: {
                    study_session_name: "Algorithms",
                    study_session_scheduled_at: sessionDate,
                    focus_minutes: 90,
                },
            },
        ] as unknown as StudySessionRows);

        const Page = await CalendarPage();

        render(Page);

        expect(
            screen.getByTestId("session-count")
        ).toHaveTextContent("1");
    });
});
