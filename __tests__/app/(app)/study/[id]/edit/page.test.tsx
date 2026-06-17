/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StudyEditPage from "@/app/(app)/study/[id]/edit/page";
import { toast } from "sonner";
import type {
    ButtonHTMLAttributes,
    InputHTMLAttributes,
    PropsWithChildren,
    TextareaHTMLAttributes,
} from "react";

const pushMock = jest.fn();
const mockRouter = {
    push: pushMock,
};

jest.mock("next/navigation", () => ({
    useRouter: () => mockRouter,
    useParams: () => ({
        id: "study-1",
    }),
}));

jest.mock("next/link", () => ({
    __esModule: true,
    default: ({ children }: { children: React.ReactNode }) => children,
}));

jest.mock("sonner", () => ({
    toast: {
        error: jest.fn(),
        success: jest.fn(),
        info: jest.fn(),
    },
}));

jest.mock("@/components/ui/button", () => ({
    Button: ({
        children,
        asChild,
        ...props
    }: PropsWithChildren<
        ButtonHTMLAttributes<HTMLButtonElement> & { asChild?: boolean }
    >) => {
        void asChild;
        return <button {...props}>{children}</button>;
    },
}));

jest.mock("@/components/ui/input", () => ({
    Input: (props: InputHTMLAttributes<HTMLInputElement>) => <input {...props} />,
}));

jest.mock("@/components/ui/textarea", () => ({
    Textarea: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => (
        <textarea {...props} />
    ),
}));

jest.mock("@/components/ui/popover", () => ({
    Popover: ({ children }: PropsWithChildren) => <>{children}</>,
    PopoverTrigger: ({ children }: PropsWithChildren) => <>{children}</>,
    PopoverContent: ({ children }: PropsWithChildren) => <>{children}</>,
}));

jest.mock("@/components/ui/calendar", () => ({
    Calendar: () => <div data-testid="calendar" />,
}));

jest.mock("@/components/ui/checkbox", () => ({
    Checkbox: ({
        checked,
        onCheckedChange,
    }: {
        checked?: boolean;
        onCheckedChange?: (value: boolean) => void;
    }) => (
        <input
            type="checkbox"
            checked={checked}
            onChange={(e) => onCheckedChange?.(e.target.checked)}
        />
    ),
}));

// Icons aren't important for these tests. Use a Proxy so any icon the page imports
// resolves to a harmless stub (avoids "Element type is invalid" when icons change).
jest.mock("lucide-react", () =>
    new Proxy(
        { __esModule: true },
        {
            get: (_target, prop) =>
                prop === "__esModule" ? true : () => <span />,
        },
    ),
);

const mockStudySession = {
    studySession: {
        study_session_name: "Algorithms",
        study_session_description: "Graphs and Trees",
        study_session_scheduled_at: "2026-01-01T09:00:00.000Z",
        focus_minutes: 25,
        break_minutes: 5,
        total_pomodoros: 2,
        checklist_json: [],
        study_session_user: [],
    },
};

describe("StudyEditPage", () => {
    beforeEach(() => {
        jest.resetAllMocks();

        global.fetch = jest.fn();

        Object.defineProperty(global, "crypto", {
            value: {
                randomUUID: jest.fn(() => "uuid-1"),
            },
            configurable: true,
        });
    });

    it("loads existing study session data", async () => {
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockStudySession,
            })
            .mockResolvedValueOnce({
                ok: true,
                json: async () => ({
                    message: "updated",
                }),
            });

        render(<StudyEditPage />);

        expect(
            await screen.findByDisplayValue("Algorithms"),
        ).toBeInTheDocument();

        expect(
            screen.getByDisplayValue("Graphs and Trees"),
        ).toBeInTheDocument();

        expect(screen.getByDisplayValue("25")).toBeInTheDocument();
        expect(screen.getByDisplayValue("5")).toBeInTheDocument();
        expect(screen.getByDisplayValue("2")).toBeInTheDocument();
    });

    it("submits an updated session", async () => {
        (global.fetch as jest.Mock).mockImplementation(
            async (_url: string, options?: RequestInit) => {
                if (options?.method === "PATCH") {
                    return {
                        ok: true,
                        json: async () => ({
                            success: true,
                        }),
                    };
                }

                return {
                    ok: true,
                    json: async () => mockStudySession,
                };
            },
        );

        render(<StudyEditPage />);

        const titleInput =
            await screen.findByDisplayValue("Algorithms");

        await userEvent.clear(titleInput);
        await userEvent.type(titleInput, "Updated Algorithms");

        await userEvent.click(
            screen.getByRole("button", {
                name: /update session/i,
            }),
        );

        await waitFor(() => {
            expect(
                (global.fetch as jest.Mock).mock.calls.some(
                    ([url, options]) =>
                        url === "/api/study/study-1" &&
                        options?.method === "PATCH",
                ),
            ).toBe(true);
        });

        await waitFor(() => {
            expect(toast.success).toHaveBeenCalledWith(
                "Study session updated",
            );
        });

        expect(pushMock).toHaveBeenCalledWith("/study");
    });

    it("previews AI suggestions from the linked task before applying them", async () => {
        const linkedStudySession = {
            studySession: {
                ...mockStudySession.studySession,
                study_session_user: [{ task_id: 7 }],
            },
        };

        (global.fetch as jest.Mock).mockImplementation(
            async (url: string, options?: RequestInit) => {
                if (url === "/api/ai/study-track-draft" && options?.method === "POST") {
                    return {
                        ok: true,
                        json: async () => ({
                            draft: {
                                tracks: [
                                    {
                                        title: "Refresh graph algorithms",
                                        start_date: "2099-06-18",
                                        time: "16:45",
                                        focus_minutes: 45,
                                        break_minutes: 15,
                                        total_pomodoros: 3,
                                        notes: "Revisit BFS, DFS, and Dijkstra.",
                                        description_as_checklist: true,
                                    },
                                ],
                            },
                        }),
                    };
                }

                if (url === "/api/task") {
                    return {
                        ok: true,
                        json: async () => ({
                            tasks: [
                                {
                                    id: 7,
                                    title: "Algorithms exam",
                                    description: "Graph review",
                                    deadline: "2099-06-20T15:00:00.000Z",
                                    priority: 4,
                                    status: "Pending",
                                    projectId: null,
                                    createdAt: "2099-06-01T00:00:00.000Z",
                                    completedAt: null,
                                },
                            ],
                        }),
                    };
                }

                return {
                    ok: true,
                    json: async () => linkedStudySession,
                };
            },
        );

        render(<StudyEditPage />);

        expect(await screen.findByDisplayValue("Algorithms")).toBeInTheDocument();

        await userEvent.click(
            screen.getByRole("button", { name: /AI Suggestions/i }),
        );

        await waitFor(() => {
            expect(
                (global.fetch as jest.Mock).mock.calls.some(
                    ([url]) => url === "/api/ai/study-track-draft",
                ),
            ).toBe(true);
        });
        const aiCall = (global.fetch as jest.Mock).mock.calls.find(
            ([url]) => url === "/api/ai/study-track-draft",
        );
        expect(aiCall?.[1]).toEqual(expect.objectContaining({ method: "POST" }));
        expect(JSON.parse(aiCall?.[1]?.body as string)).toEqual(
            expect.objectContaining({
                taskId: 7,
                title: "Algorithms",
                notes: "Graphs and Trees",
                scheduledDate: "2026-01-01",
                scheduledTime: "16:00",
                focusMinutes: 25,
                breakMinutes: 5,
                totalPomodoro: 2,
            }),
        );

        expect(await screen.findByText("Refresh graph algorithms")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Algorithms")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Graphs and Trees")).toBeInTheDocument();
        expect(screen.queryByDisplayValue("16:45")).not.toBeInTheDocument();
        expect(toast.success).not.toHaveBeenCalledWith("AI study session applied");

        await userEvent.click(screen.getByRole("button", { name: /Apply study session/i }));

        expect(screen.getByDisplayValue("Refresh graph algorithms")).toBeInTheDocument();

        expect(screen.getByDisplayValue("16:45")).toBeInTheDocument();
        expect(screen.getByDisplayValue("45")).toBeInTheDocument();
        expect(screen.getByDisplayValue("15")).toBeInTheDocument();
        expect(screen.getByDisplayValue("3")).toBeInTheDocument();
        expect(
            screen.getByDisplayValue("Revisit BFS, DFS, and Dijkstra."),
        ).toBeInTheDocument();
        expect(toast.success).toHaveBeenCalledWith("AI study session applied");
    });

    it("previews AI suggestions without a linked task before applying them", async () => {
        (global.fetch as jest.Mock).mockImplementation(
            async (url: string, options?: RequestInit) => {
                if (url === "/api/ai/study-track-draft" && options?.method === "POST") {
                    return {
                        ok: true,
                        json: async () => ({
                            draft: {
                                tracks: [
                                    {
                                        title: "Standalone algorithm refresh",
                                        start_date: "2099-06-18",
                                        time: "13:15",
                                        focus_minutes: 35,
                                        break_minutes: 10,
                                        total_pomodoros: 2,
                                        notes: "Review sorting and graph basics.",
                                        description_as_checklist: false,
                                    },
                                ],
                            },
                        }),
                    };
                }

                if (url === "/api/task") {
                    return {
                        ok: true,
                        json: async () => ({ tasks: [] }),
                    };
                }

                return {
                    ok: true,
                    json: async () => mockStudySession,
                };
            },
        );

        render(<StudyEditPage />);

        expect(await screen.findByDisplayValue("Algorithms")).toBeInTheDocument();

        await userEvent.click(
            screen.getByRole("button", { name: /AI Suggestions/i }),
        );

        await waitFor(() => {
            expect(
                (global.fetch as jest.Mock).mock.calls.some(
                    ([url]) => url === "/api/ai/study-track-draft",
                ),
            ).toBe(true);
        });
        const aiCall = (global.fetch as jest.Mock).mock.calls.find(
            ([url]) => url === "/api/ai/study-track-draft",
        );
        const payload = JSON.parse(aiCall?.[1]?.body as string);
        expect(payload).toEqual(
            expect.objectContaining({
                title: "Algorithms",
                notes: "Graphs and Trees",
                scheduledDate: "2026-01-01",
                scheduledTime: "16:00",
                focusMinutes: 25,
                breakMinutes: 5,
                totalPomodoro: 2,
            }),
        );
        expect(payload).not.toHaveProperty("taskId");
        expect(await screen.findByText("Standalone algorithm refresh")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Algorithms")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Graphs and Trees")).toBeInTheDocument();
        expect(toast.error).not.toHaveBeenCalledWith(
            "Choose a linked task before asking AI for session suggestions",
        );
        expect(toast.success).not.toHaveBeenCalledWith("AI study session applied");

        await userEvent.click(screen.getByRole("button", { name: /Apply study session/i }));

        expect(screen.getByDisplayValue("Standalone algorithm refresh")).toBeInTheDocument();
        expect(toast.success).toHaveBeenCalledWith("AI study session applied");
    });

    it("redirects when loading fails", async () => {
        global.fetch = jest.fn().mockRejectedValue(
            new Error("network error"),
        );

        render(<StudyEditPage />);

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(
                "Network error while loading study session",
            );
        });

        expect(pushMock).toHaveBeenCalledWith("/study");
    });

    it("redirects when api returns not found", async () => {
        global.fetch = jest.fn().mockResolvedValue({
            ok: false,
            json: async () => ({
                message: "Study session not found",
            }),
        });

        render(<StudyEditPage />);

        await waitFor(() => {
            expect(toast.error).toHaveBeenCalledWith(
                "Study session not found",
            );
        });

        expect(pushMock).toHaveBeenCalledWith("/study");
    });
});
