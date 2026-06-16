/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen, fireEvent, act } from "@testing-library/react";
import QuickTimerPage from "@/app/(app)/study/quicktimer/page";
import { useSearchParams, useRouter } from "next/navigation";
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
    },
}));

describe("QuickTimerPage Component", () => {
    const mockPush = jest.fn();
    let mockSearchParams: URLSearchParams;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.useFakeTimers(); // Enable fake timers to test setInterval smoothly

        // Define mock query parameters passed into the component
        mockSearchParams = new URLSearchParams({
            title: "WADS Security Sprint",
            focus: "25",
            break: "5",
            total: "60",
        });

        (useRouter as jest.Mock).mockReturnValue({ push: mockPush });
        (useSearchParams as jest.Mock).mockReturnValue(mockSearchParams);

        // Mock Window Confirm dialog for the Reset flow
        window.confirm = jest.fn(() => true);

        // Mock AudioContext to prevent JSDOM Web Audio API crashes
        Object.defineProperty(window, "AudioContext", {
            writable: true,
            value: jest.fn().mockImplementation(() => ({
                createOscillator: jest.fn().mockReturnValue({
                    type: "",
                    frequency: { value: 0 },
                    connect: jest.fn(),
                    start: jest.fn(),
                    stop: jest.fn(),
                }),
                createGain: jest.fn().mockReturnValue({
                    gain: { value: 0 },
                    connect: jest.fn(),
                }),
                destination: {},
                currentTime: 0,
                close: jest.fn().mockResolvedValue(undefined),
            })),
        });
    });

    afterEach(() => {
        jest.useRealTimers();
    });

    it("should initialize text configurations correctly from URL Search parameters", () => {
        render(<QuickTimerPage />);

        // Check title configurations
        expect(screen.getByText("WADS Security Sprint")).toBeInTheDocument();

        // Check parameters configurations inside settings & tags
        expect(screen.getByText(/25m \/ 5m/i)).toBeInTheDocument();
        expect(screen.getByText(/Total 1h/i)).toBeInTheDocument();

        // Check case-insensitive session state badge text (Idle -> Sentence case "Idle")
        expect(screen.getByText(/idle/i)).toBeInTheDocument();
    });

    it("should handle the start, pause, and resume countdown sequences", () => {
        render(<QuickTimerPage />);

        // FIX: Look for Start OR Resume since phase initializes to "focus"
        const controlButton = screen.getByRole("button", { name: /start|resume/i });

        // 1. Click the button to start running
        fireEvent.click(controlButton);
        expect(screen.getByText(/running/i)).toBeInTheDocument();
        expect(controlButton.textContent).toBe("Pause");

        // 2. Fast forward 5 seconds down from 25:00 minutes
        act(() => {
            jest.advanceTimersByTime(5000);
        });
        expect(screen.getByText("24:55")).toBeInTheDocument();

        // 3. Pause Session
        fireEvent.click(controlButton);
        expect(screen.getByText(/paused/i)).toBeInTheDocument();
        expect(controlButton.textContent).toBe("Resume");

        // 4. Confirm timer freezes while paused
        act(() => {
            jest.advanceTimersByTime(5000);
        });
        expect(screen.getByText("24:55")).toBeInTheDocument();
    });

    it("should shift state from focus block into a break block automatically", () => {
        render(<QuickTimerPage />);

        // FIX: Match alternative initialized button text state
        fireEvent.click(screen.getByRole("button", { name: /start|resume/i }));

        // Advance right down to the last second of the focus block (25 mins * 60 secs)
        act(() => {
            jest.advanceTimersByTime(25 * 60 * 1000);
        });

        // Label should transition smoothly into a break state configuration
        expect(screen.getByText("BREAK")).toBeInTheDocument();
        expect(screen.getByText("05:00")).toBeInTheDocument();
    });

    it("should reset parameters back to default state when the user confirms a reset operation", () => {
        render(<QuickTimerPage />);

        // FIX: Match alternative initialized button text state
        fireEvent.click(screen.getByRole("button", { name: /start|resume/i }));
        act(() => {
            jest.advanceTimersByTime(10000);
        });

        // Click reset
        const resetButton = screen.getByRole("button", { name: /reset/i });
        fireEvent.click(resetButton);

        // Verify window confirmation prompt was triggered and clock rolled back safely
        expect(window.confirm).toHaveBeenCalledWith("Are you sure you want to reset the timer?");
        expect(screen.getByText("25:00")).toBeInTheDocument();
        expect(screen.getByText(/idle/i)).toBeInTheDocument();
    });

    it("should trigger toast and mark status as completed when total session time ends", () => {
        mockSearchParams.set("total", "1");
        mockSearchParams.set("focus", "1");

        render(<QuickTimerPage />);

        // FIX: Match alternative initialized button text state
        fireEvent.click(screen.getByRole("button", { name: /start|resume/i }));

        // Advance past 1 full minute (60 seconds)
        act(() => {
            jest.advanceTimersByTime(60000);
        });

        expect(screen.getByText(/completed/i)).toBeInTheDocument();
        expect(toast.success).toHaveBeenCalledWith("Session complete: WADS Security Sprint");
    });
});