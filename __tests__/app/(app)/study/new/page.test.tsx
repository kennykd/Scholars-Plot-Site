/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import StudyNewPage from "@/app/(app)/study/new/page"; // Adjusted to standard Next.js routing conventions
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";

// 1. Mock Next.js Navigation Hooks
jest.mock("next/navigation", () => ({
    useRouter: jest.fn(),
    useSearchParams: jest.fn(),
}));

// 2. Mock Sonner Toast Notifications
jest.mock("sonner", () => ({
    toast: {
        success: jest.fn(),
        error: jest.fn(),
        info: jest.fn(),
        warning: jest.fn(),
    },
}));

// 3. Setup Global Layout and DOM Mocks to survive React 19 JSDOM limits
beforeAll(() => {
    // Mock ResizeObserver required by Radix UI/Shadcn viewboxes
    global.ResizeObserver = class ResizeObserver {
        observe() { }
        unobserve() { }
        disconnect() { }
    };

    // Mock Crypto UUID for structural checklist text arrays
    if (!global.crypto.randomUUID) {
        Object.defineProperty(global.crypto, "randomUUID", {
            value: () => "mocked-uuid-1234",
        });
    }

    window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

describe("StudyNewPage Component", () => {
    let mockPush = jest.fn();
    let mockGetParam = jest.fn();

    beforeEach(() => {
        jest.clearAllMocks();

        mockPush = jest.fn();
        (useRouter as jest.Mock).mockReturnValue({ push: mockPush });

        mockGetParam = jest.fn().mockReturnValue(null); // Default: no taskId query param
        (useSearchParams as jest.Mock).mockReturnValue({ get: mockGetParam });

        // Mock global fetch API cleanly
        global.fetch = jest.fn().mockImplementation(() =>
            Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ success: true }),
            } as Response)
        );
    });

    it("should render core study layout forms and initial pomodoro computations properly", () => {
        render(<StudyNewPage />);

        expect(screen.getByText("NEW STUDY SESSION")).toBeInTheDocument();

        // Default computation check: (25m Focus + 5m Break) * 2 Pomodoros = 60m
        expect(screen.getByText("Total minutes: 60m")).toBeInTheDocument();
    });

    it("should dynamically recalculate total minutes when session structural parameters alter", () => {
        render(<StudyNewPage />);

        // 1. Safe query fallbacks using queryBy instead of getBy
        const focusInput = screen.queryByPlaceholderText("25") || screen.getByDisplayValue("25");
        const breakInput = screen.queryByPlaceholderText("5") || screen.getByDisplayValue("5");

        // Try finding by explicit text label, placeholder, or default numerical value 
        const pomodoroInput = screen.queryByLabelText(/sessions/i) ||
            screen.queryByPlaceholderText("2") ||
            screen.getByDisplayValue("2");

        // 2. Simulate user typing new configuration criteria
        fireEvent.change(focusInput, { target: { value: "45" } });
        fireEvent.change(breakInput, { target: { value: "15" } });
        fireEvent.change(pomodoroInput, { target: { value: "3" } });

        // 3. Verify computation updates correctly: (45 + 15) * 3 = 180m
        expect(screen.getByText("Total minutes: 180m")).toBeInTheDocument();
    });

    it("should display validation toast exceptions if submission properties are absent", async () => {
        render(<StudyNewPage />);
        const submitBtn = screen.getByRole("button", { name: /Create Session/i });

        // Trigger immediate validation failure
        fireEvent.click(submitBtn);
        expect(toast.error).toHaveBeenCalledWith("Session title is required");

        // Add valid title input text strings
        const titleInput = screen.getByPlaceholderText(/e.g. Biology chapter 6 review/i);
        fireEvent.change(titleInput, { target: { value: "WADS Revision Marathon" } });

        // Test missing date configurations exception
        fireEvent.click(submitBtn);
        expect(toast.error).toHaveBeenCalledWith("Pick a date and time for the session");
    });

    it("should compile multiline note updates into explicit structured checklist placeholders", async () => {
        render(<StudyNewPage />);

        // Target default textarea input state elements
        const notesTextarea = screen.getByPlaceholderText(/Add notes for this study session.../i);
        fireEvent.change(notesTextarea, { target: { value: "Read Chapter 3\nReview mistakes" } });

        // Click UI checkbox to swap modes without interrupting React hook configurations
        const checklistCheckbox = screen.getByLabelText(/Make the description a checklist/i);
        fireEvent.click(checklistCheckbox);

        // Assert text transformation string switch inside components pass validation
        expect(
            screen.getByPlaceholderText(/Make a checklist by separating each checklist item with a newline/i)
        ).toBeInTheDocument();
    });

    it("should process document drop operations and clear individual files sequentially via attachment nodes", () => {
        render(<StudyNewPage />);

        const dropzoneLabel = screen.getByText(/Drop files here or click to browse/i);

        // Simulate drag drop configuration lifecycle event
        const mockFile = new File(["wads-notes"], "wads_handout.pdf", { type: "application/pdf" });
        fireEvent.drop(dropzoneLabel, {
            dataTransfer: { files: [mockFile] },
        });

        expect(screen.getByText("wads_handout.pdf")).toBeInTheDocument();

        // Target the remove (X icon) button and clear state cleanly
        const removeFileBtn = screen.getByRole("button", { name: "" });
        fireEvent.click(removeFileBtn);

        expect(screen.queryByText("wads_handout.pdf")).not.toBeInTheDocument();
    });

    it("should expand dynamic reminder modules subforms and allow user appending actions", async () => {
        render(<StudyNewPage />);

        const reminderToggle = screen.getByLabelText(/Enable reminder/i);
        expect(screen.queryByText("VALUE UNIT")).not.toBeInTheDocument();

        // Enable notifications list rendering blocks
        fireEvent.click(reminderToggle);
        expect(screen.getAllByText("VALUE UNIT")[0]).toBeInTheDocument();

        // Append a new card container to verification loops
        const appendBtn = screen.getByRole("button", { name: /Add reminder/i });
        fireEvent.click(appendBtn);

        const reminderBlocks = screen.getAllByText("VALUE");
        expect(reminderBlocks.length).toBe(4); // 3 original presets + 1 newly appended item
    });

    it("previews AI suggestions for a single linked study session before applying them", async () => {
        (global.fetch as jest.Mock).mockImplementation((url: string, options?: RequestInit) => {
            if (url === "/api/task") {
                return Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            tasks: [
                                {
                                    id: 7,
                                    title: "Database exam",
                                    description: "Review normalization and indexes",
                                    deadline: "2099-06-20T15:00:00.000Z",
                                    priority: 4,
                                    status: "Pending",
                                    projectId: null,
                                    createdAt: "2099-06-01T00:00:00.000Z",
                                    completedAt: null,
                                },
                            ],
                        }),
                } as Response);
            }

            if (url === "/api/ai/study-track-draft" && options?.method === "POST") {
                return Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            draft: {
                                tracks: [
                                    {
                                        title: "Review database normalization",
                                        start_date: "2099-06-18",
                                        repeat_enabled: false,
                                        repeat_every: 1,
                                        repeat_unit: "weeks",
                                        time: "14:30",
                                        focus_minutes: 50,
                                        break_minutes: 10,
                                        total_pomodoros: 2,
                                        notes: "Study 1NF, 2NF, and 3NF.",
                                        description_as_checklist: true,
                                    },
                                ],
                                warnings: [],
                                reasoning: "Fits before the deadline.",
                                skippedAttachments: [],
                            },
                        }),
                } as Response);
            }

            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ success: true }),
            } as Response);
        });

        render(<StudyNewPage />);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith("/api/task");
        });

        fireEvent.change(screen.getByPlaceholderText(/e.g. Biology chapter 6 review/i), {
            target: { value: "Database sprint" },
        });
        fireEvent.change(screen.getByPlaceholderText(/Add notes for this study session.../i), {
            target: { value: "Focus on ERD and normalization" },
        });
        fireEvent.click(screen.getByRole("button", { name: /No task/i }));
        fireEvent.click(await screen.findByText("Database exam"));
        fireEvent.click(screen.getByRole("button", { name: /AI Suggestions/i }));

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
                title: "Database sprint",
                notes: "Focus on ERD and normalization",
                focusMinutes: 25,
                breakMinutes: 5,
                totalPomodoro: 2,
            }),
        );

        expect(
            await screen.findByText("Review database normalization"),
        ).toBeInTheDocument();
        expect(screen.getByDisplayValue("Database sprint")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Focus on ERD and normalization")).toBeInTheDocument();
        expect(screen.queryByDisplayValue("14:30")).not.toBeInTheDocument();
        expect(toast.success).not.toHaveBeenCalledWith("AI study session applied");

        fireEvent.click(screen.getByRole("button", { name: /Apply study session/i }));

        expect(screen.getByDisplayValue("Review database normalization")).toBeInTheDocument();
        expect(screen.getByDisplayValue("14:30")).toBeInTheDocument();
        expect(screen.getByDisplayValue("50")).toBeInTheDocument();
        expect(screen.getByDisplayValue("10")).toBeInTheDocument();
        expect(screen.getByDisplayValue("2")).toBeInTheDocument();
        expect(
            screen.getByDisplayValue("Study 1NF, 2NF, and 3NF."),
        ).toBeInTheDocument();
        expect(toast.success).toHaveBeenCalledWith("AI study session applied");
    });

    it("previews AI suggestions for a standalone study session without a task before applying them", async () => {
        (global.fetch as jest.Mock).mockImplementation((url: string, options?: RequestInit) => {
            if (url === "/api/task") {
                return Promise.resolve({
                    ok: true,
                    json: () => Promise.resolve({ tasks: [] }),
                } as Response);
            }

            if (url === "/api/ai/study-track-draft" && options?.method === "POST") {
                return Promise.resolve({
                    ok: true,
                    json: () =>
                        Promise.resolve({
                            draft: {
                                tracks: [
                                    {
                                        title: "Standalone calculus practice",
                                        start_date: "2099-06-18",
                                        repeat_enabled: false,
                                        repeat_every: 1,
                                        repeat_unit: "weeks",
                                        time: "11:00",
                                        focus_minutes: 40,
                                        break_minutes: 10,
                                        total_pomodoros: 3,
                                        notes: "Practice derivatives and integrals.",
                                        description_as_checklist: true,
                                    },
                                ],
                                warnings: [],
                                reasoning: "Uses the form context.",
                                skippedAttachments: [],
                            },
                        }),
                } as Response);
            }

            return Promise.resolve({
                ok: true,
                json: () => Promise.resolve({ success: true }),
            } as Response);
        });

        render(<StudyNewPage />);

        fireEvent.change(screen.getByPlaceholderText(/e.g. Biology chapter 6 review/i), {
            target: { value: "Independent calculus review" },
        });
        fireEvent.change(screen.getByPlaceholderText(/Add notes for this study session.../i), {
            target: { value: "Practice derivatives and integrals" },
        });
        fireEvent.click(screen.getByRole("button", { name: /AI Suggestions/i }));

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
                title: "Independent calculus review",
                notes: "Practice derivatives and integrals",
                focusMinutes: 25,
                breakMinutes: 5,
                totalPomodoro: 2,
            }),
        );
        expect(payload).not.toHaveProperty("taskId");
        expect(await screen.findByText("Standalone calculus practice")).toBeInTheDocument();
        expect(screen.getByDisplayValue("Independent calculus review")).toBeInTheDocument();
        expect(screen.queryByDisplayValue("Standalone calculus practice")).not.toBeInTheDocument();
        expect(toast.error).not.toHaveBeenCalledWith(
            "Choose a linked task before asking AI for session suggestions",
        );
        expect(toast.success).not.toHaveBeenCalledWith("AI study session applied");

        fireEvent.click(screen.getByRole("button", { name: /Apply study session/i }));

        expect(screen.getByDisplayValue("Standalone calculus practice")).toBeInTheDocument();
        expect(toast.success).toHaveBeenCalledWith("AI study session applied");
    });
});
