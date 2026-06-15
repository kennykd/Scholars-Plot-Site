import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import ProjectsPage from "./page";
import { fetchProjects } from "@/app/api/project/client";
import { toast } from "sonner";

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }) => <div>{children}</div>,
  DialogClose: ({ children }) => <>{children}</>,
  DialogContent: ({ children }) => <div>{children}</div>,
  DialogDescription: ({ children }) => <p>{children}</p>,
  DialogFooter: ({ children }) => <div>{children}</div>,
  DialogHeader: ({ children }) => <div>{children}</div>,
  DialogTitle: ({ children }) => <h2>{children}</h2>,
  DialogTrigger: ({ children }) => <>{children}</>,
}));

jest.mock("@/components/ui/select", () => ({
  Select: ({ children }) => <div>{children}</div>,
  SelectContent: ({ children }) => <div>{children}</div>,
  SelectItem: ({ children }) => <div>{children}</div>,
  SelectTrigger: ({ children }) => <button type="button">{children}</button>,
  SelectValue: () => <span>None</span>,
}));

jest.mock("@/app/components/common/star-rating", () => ({
  StarRating: () => <div>Priority rating</div>,
}));

jest.mock("@/app/api/project/client", () => ({
  fetchProjects: jest.fn(),
  createProjectApi: jest.fn(),
  addProjectMemberApi: jest.fn(),
  createProjectTaskApi: jest.fn(),
  updateProjectTaskApi: jest.fn(),
  deleteProjectApi: jest.fn(),
}));

describe("ProjectsPage project-task attachments", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        id: "user-1",
        email: "student@example.com",
        name: "Student",
        image: null,
      }),
    });
    fetchProjects.mockResolvedValue([
      {
        id: "project-1",
        name: "Calculus Project",
        description: "Group final",
        deadline: "2099-03-31T23:59:00.000Z",
        project_status: "active",
        priority: 3,
        ownerId: "user-1",
        members: [
          {
            id: "user-1",
            name: "Student",
            handle: "student@example.com",
            role: "owner",
          },
        ],
        tasks: [],
        createdAt: "2099-03-01T00:00:00.000Z",
      },
    ]);
  });

  afterEach(() => {
    delete global.fetch;
  });

  it("shows the AI-readable helper text in the project task attachment field", async () => {
    render(<ProjectsPage />);

    expect(await screen.findAllByText("Calculus Project")).not.toHaveLength(0);
    expect(
      screen.getByText("AI can read: .pdf, .jpg, .jpeg, .png, .webp, .gif"),
    ).toBeInTheDocument();
  });

  it("shows project task AI safety errors as a toast without rendering a draft", async () => {
    global.fetch = jest.fn(async (url) => {
      if (url === "/api/users/me") {
        return {
          ok: true,
          json: async () => ({
            id: "user-1",
            email: "student@example.com",
            name: "Student",
            image: null,
          }),
        };
      }

      if (url === "/api/ai/task-draft") {
        return {
          ok: false,
          json: async () => ({
            code: "PROMPT_INJECTION_DETECTED",
            message:
              "AI suggestions were blocked because the task text or attachment appears to contain instructions that try to override the AI rules. Please remove those instructions and try again.",
          }),
        };
      }

      throw new Error(`Unexpected fetch: ${url}`);
    });

    render(<ProjectsPage />);

    expect(await screen.findAllByText("Calculus Project")).not.toHaveLength(0);
    fireEvent.change(screen.getByPlaceholderText(/finalize onboarding docs/i), {
      target: { value: "Project report" },
    });
    fireEvent.click(screen.getByRole("button", { name: /ai suggestions/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith(
        "AI suggestions were blocked because the task text or attachment appears to contain instructions that try to override the AI rules. Please remove those instructions and try again.",
      );
    });
    expect(screen.queryByText("AI DRAFT")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /apply suggestions/i })).not.toBeInTheDocument();
  });
});
