import { render, screen } from "@testing-library/react";
import { useParams, useRouter } from "next/navigation";
import StudyEditPage from "./page";

jest.mock("next/navigation", () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock("@/components/ui/calendar", () => ({
  Calendar: () => <div>Calendar</div>,
}));

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
    info: jest.fn(),
  },
}));

describe("StudyEditPage attachments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    useParams.mockReturnValue({ id: "11" });
    useRouter.mockReturnValue({ push: jest.fn() });
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        studySession: {
          study_session_id: 11,
          study_session_name: "Mechanical Physics",
          study_session_description: "Practice force diagrams",
          study_session_scheduled_at: "2099-03-23T15:00:00.000Z",
          focus_minutes: 25,
          break_minutes: 5,
          total_pomodoros: 2,
          checklist_json: [],
          study_session_attachments: [
            {
              attachment: {
                attachment_id: 9,
                file_name: "mechanics.pdf",
                file_path: "uploads/user-1-mechanics.pdf",
                file_type: "application/pdf",
                attachment_uploaded_at: "2099-03-20T08:00:00.000Z",
                url: "https://example.com/mechanics.pdf",
              },
            },
          ],
        },
      }),
    });
  });

  afterEach(() => {
    delete global.fetch;
  });

  it("shows the AI-readable helper text above editable attachments", async () => {
    render(<StudyEditPage />);

    expect(await screen.findByDisplayValue("Mechanical Physics")).toBeInTheDocument();
    expect(
      screen.getByText("AI can read: .pdf, .jpg, .jpeg, .png, .webp, .gif"),
    ).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /mechanics.pdf/i })).toHaveAttribute(
      "href",
      "https://example.com/mechanics.pdf",
    );
  });
});
