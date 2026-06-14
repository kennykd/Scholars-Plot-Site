import { render, screen } from "@testing-library/react";
import ProjectsPage from "./page";
import { fetchProjects } from "@/app/api/project/client";

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
});
