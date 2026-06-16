/**
 * @jest-environment jsdom
 */

import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import StudyEditPage from "@/app/(app)/study/[id]/edit/page";
import { toast } from "sonner";

const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
    useRouter: () => ({
        push: pushMock,
    }),
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
    Button: ({ children, asChild, ...props }: any) => (
        <button {...props}>{children}</button>
    ),
}));

jest.mock("@/components/ui/input", () => ({
    Input: (props: any) => <input {...props} />,
}));

jest.mock("@/components/ui/textarea", () => ({
    Textarea: (props: any) => <textarea {...props} />,
}));

jest.mock("@/components/ui/popover", () => ({
    Popover: ({ children }: any) => <>{children}</>,
    PopoverTrigger: ({ children }: any) => <>{children}</>,
    PopoverContent: ({ children }: any) => <>{children}</>,
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

// Icons aren't important for these tests
jest.mock("lucide-react", () => ({
    ArrowLeft: () => <span />,
    CalendarIcon: () => <span />,
    Paperclip: () => <span />,
    X: () => <span />,
    Sparkles: () => <span />,
}));

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