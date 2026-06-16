/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen, fireEvent } from "@testing-library/react";
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

    it("should broadcast standard temporary toast warning information items when trigger parameters click AI context sparkles components", () => {
        render(<StudyNewPage />);

        const aiBtn = screen.getByRole("button", { name: /AI Suggestions/i });
        fireEvent.click(aiBtn);

        expect(toast.warning).toHaveBeenCalledWith("AI suggestions coming soon!");
    });
});
