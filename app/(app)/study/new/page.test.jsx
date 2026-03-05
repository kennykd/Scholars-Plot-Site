import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import StudyNewPage from "./page";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

jest.mock("next/navigation", () => ({
  useRouter: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

jest.mock("@/components/ui/calendar", () => ({
  Calendar: ({ onSelect }) => (
    <button
      type="button"
      onClick={() => onSelect?.(new Date("2026-03-20T00:00:00.000Z"))}
    >
      Select date
    </button>
  ),
}));

describe("StudyNewPage", () => {
  const mockPush = jest.fn();

  beforeEach(() => {
    jest.clearAllMocks();
    localStorage.clear();
    useRouter.mockReturnValue({ push: mockPush });
  });

  it("renders the study session form", () => {
    render(<StudyNewPage />);

    expect(
      screen.getByRole("heading", { name: /new study session/i }),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/biology chapter 6 review/i),
    ).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /create session/i }),
    ).toBeInTheDocument();
  });

  it("shows an error if title is missing", () => {
    render(<StudyNewPage />);

    fireEvent.click(screen.getByRole("button", { name: /create session/i }));

    expect(toast.error).toHaveBeenCalledWith("Session title is required");
  });

  it("shows an error if date or time is missing", () => {
    render(<StudyNewPage />);

    fireEvent.change(screen.getByPlaceholderText(/biology chapter 6 review/i), {
      target: { value: "Final Exam Prep" },
    });
    fireEvent.click(screen.getByRole("button", { name: /create session/i }));

    expect(toast.error).toHaveBeenCalledWith(
      "Pick a date and time for the session",
    );
  });

  it("creates a session and redirects to /study", async () => {
    const { container } = render(<StudyNewPage />);

    fireEvent.change(screen.getByPlaceholderText(/biology chapter 6 review/i), {
      target: { value: "Final Exam Prep" },
    });

    fireEvent.click(screen.getByRole("button", { name: /pick a date/i }));
    fireEvent.click(screen.getByRole("button", { name: /select date/i }));

    const timeInput = container.querySelector('input[type="time"]');
    fireEvent.change(timeInput, { target: { value: "14:00" } });

    fireEvent.click(screen.getByRole("button", { name: /create session/i }));

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith("Study session created");
      expect(mockPush).toHaveBeenCalledWith("/study");
    });
  });

  it("adds a file attachment", async () => {
    const { container } = render(<StudyNewPage />);
    const file = new File(["data"], "syllabus.pdf", {
      type: "application/pdf",
    });

    const input = container.querySelector('input[type="file"]');
    fireEvent.change(input, { target: { files: [file] } });

    expect(await screen.findByText("syllabus.pdf")).toBeInTheDocument();
  });
});
