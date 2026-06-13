import { render, screen } from "@testing-library/react";
import { useParams, useRouter } from "next/navigation";
import StudySessionPage from "./page";

jest.mock("next/navigation", () => ({
  useParams: jest.fn(),
  useRouter: jest.fn(),
}));

jest.mock("sonner", () => ({
  toast: {
    success: jest.fn(),
    error: jest.fn(),
  },
}));

describe("StudySessionPage attachments", () => {
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
          study_session_created_at: "2099-03-20T08:00:00.000Z",
          focus_minutes: 25,
          break_minutes: 5,
          total_minutes: 60,
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
          study_session_user: [{ status: "idle", current_time: 0 }],
        },
        userSessionData: { status: "idle", current_time: 0 },
      }),
    });
  });

  afterEach(() => {
    delete global.fetch;
  });

  it("renders study-session attachments as links when the timer opens", async () => {
    render(<StudySessionPage />);

    const attachment = await screen.findByRole("link", {
      name: /mechanics.pdf/i,
    });

    expect(attachment).toHaveAttribute("href", "https://example.com/mechanics.pdf");
    expect(attachment).toHaveAttribute("target", "_blank");
  });
});
