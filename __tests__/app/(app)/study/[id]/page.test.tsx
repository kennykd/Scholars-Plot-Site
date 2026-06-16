/**
 * @jest-environment jsdom
 */
import "@testing-library/jest-dom";
import { render, screen, waitFor, fireEvent } from "@testing-library/react";
import StudySessionPage from "@/app/(app)/study/[id]/page";
import { toast } from "sonner";

const pushMock = jest.fn();

jest.mock("next/navigation", () => ({
    useParams: () => ({
        id: "123",
    }),
    useRouter: () => ({
        push: pushMock,
    }),
}));

jest.mock("sonner", () => ({
    toast: {
        success: jest.fn(),
    },
}));

jest.mock("lucide-react", () => ({
    Timer: () => <div>TimerIcon</div>,
    Paperclip: () => <div>PaperclipIcon</div>,
}));

beforeEach(() => {
    jest.clearAllMocks();

    global.fetch = jest.fn();
});

const mockSessionResponse = {
    studySession: {
        study_session_id: 123,
        study_session_name: "Math Revision",
        study_session_description: "Chapter 1",
        study_session_scheduled_at: "2025-01-01T10:00:00.000Z",
        study_session_created_at: "2025-01-01T09:00:00.000Z",
        focus_minutes: 25,
        break_minutes: 5,
        total_minutes: 60,
        study_session_user: [],
        // The page reads attachments from study_session_attachments[].attachment.
        study_session_attachments: [
            {
                attachment: {
                    attachment_id: 1,
                    file_name: "notes.pdf",
                    file_path: "uploads/notes.pdf",
                    file_type: "application/pdf",
                    url: "https://example.com/notes.pdf",
                    attachment_uploaded_at: "2025-01-01T09:00:00.000Z",
                },
            },
        ],
    },
    userSessionData: {
        status: "idle",
    },
};

describe("StudySessionPage", () => {
    it("renders loading state initially", () => {
        (global.fetch as jest.Mock).mockReturnValue(
            new Promise(() => { })
        );

        render(<StudySessionPage />);

        expect(
            screen.getByText(/loading session/i)
        ).toBeInTheDocument();
    });

    it("renders fetched study session", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => mockSessionResponse,
        });

        render(<StudySessionPage />);

        expect(
            await screen.findByText("Math Revision")
        ).toBeInTheDocument();

        expect(screen.getByText("Chapter 1")).toBeInTheDocument();

        expect(screen.getByText("notes.pdf")).toBeInTheDocument();
    });

    it("renders session not found when API returns no session", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: true,
            json: async () => ({
                studySession: null,
            }),
        });

        render(<StudySessionPage />);

        expect(
            await screen.findByText(/session not found/i)
        ).toBeInTheDocument();
    });

    it("renders session not found when API fails", async () => {
        (global.fetch as jest.Mock).mockResolvedValue({
            ok: false,
        });

        render(<StudySessionPage />);

        expect(
            await screen.findByText(/session not found/i)
        ).toBeInTheDocument();
    });

    it("starts timer when start button clicked", async () => {
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockSessionResponse,
            })
            .mockResolvedValueOnce({
                ok: true,
            });

        render(<StudySessionPage />);

        const startButton = await screen.findByRole("button", {
            name: /start/i,
        });

        fireEvent.click(startButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/api/study/123",
                expect.objectContaining({
                    method: "PATCH",
                })
            );
        });

        expect(
            await screen.findByRole("button", {
                name: /pause/i,
            })
        ).toBeInTheDocument();
    });

    it("pauses timer", async () => {
        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockSessionResponse,
            })
            .mockResolvedValue({
                ok: true,
            });

        render(<StudySessionPage />);

        const startButton = await screen.findByRole("button", {
            name: /start/i,
        });

        fireEvent.click(startButton);

        const pauseButton = await screen.findByRole("button", {
            name: /pause/i,
        });

        fireEvent.click(pauseButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenLastCalledWith(
                "/api/study/123",
                expect.objectContaining({
                    method: "PATCH",
                })
            );
        });
    });

    it("resets session after confirmation", async () => {
        window.confirm = jest.fn(() => true);

        (global.fetch as jest.Mock)
            // Initial GET request
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockSessionResponse,
            })
            // Pause-before-reset PATCH request
            .mockResolvedValue({
                ok: true,
            });

        render(<StudySessionPage />);

        const resetButton = await screen.findByRole("button", {
            name: /reset/i,
        });

        fireEvent.click(resetButton);

        await waitFor(() => {
            expect(window.confirm).toHaveBeenCalled();
        });

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/api/study/123",
                expect.objectContaining({
                    method: "PATCH",
                }),
            );
        });
    });

    it("marks session as done", async () => {
        window.confirm = jest.fn(() => true);

        (global.fetch as jest.Mock)
            .mockResolvedValueOnce({
                ok: true,
                json: async () => mockSessionResponse,
            })
            .mockResolvedValue({
                ok: true,
            });

        render(<StudySessionPage />);

        const doneButton = await screen.findByRole("button", {
            name: /mark done/i,
        });

        fireEvent.click(doneButton);

        await waitFor(() => {
            expect(global.fetch).toHaveBeenCalledWith(
                "/api/study/123",
                expect.objectContaining({
                    method: "PATCH",
                })
            );
        });

        expect(toast.success).toHaveBeenCalled();

        expect(pushMock).toHaveBeenCalledWith("/study");
    });

    it("does not mark done when confirmation is cancelled", async () => {
        window.confirm = jest.fn(() => false);

        (global.fetch as jest.Mock).mockResolvedValueOnce({
            ok: true,
            json: async () => mockSessionResponse,
        });

        render(<StudySessionPage />);

        const doneButton = await screen.findByRole("button", {
            name: /mark done/i,
        });

        fireEvent.click(doneButton);

        expect(pushMock).not.toHaveBeenCalled();
    });
});