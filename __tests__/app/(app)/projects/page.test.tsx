/**
 * @jest-environment jsdom
 */

import "@testing-library/jest-dom";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import ProjectsPage from "@/app/(app)/projects/page";
import {
  fetchProjects,
  updateProjectTaskApi,
  type StoredProject,
} from "@/app/api/project/client";

const searchParams = new URLSearchParams();

jest.mock("next/navigation", () => ({
  useSearchParams: () => searchParams,
}));

jest.mock("sonner", () => ({
  toast: {
    error: jest.fn(),
    success: jest.fn(),
    warning: jest.fn(),
  },
}));

jest.mock("@/app/api/project/client", () => ({
  fetchProjects: jest.fn(),
  createProjectApi: jest.fn(),
  addProjectMemberApi: jest.fn(),
  createProjectTaskApi: jest.fn(),
  updateProjectApi: jest.fn(),
  updateProjectTaskApi: jest.fn(),
  deleteProjectApi: jest.fn(),
}));

const currentUser = {
  id: "owner-1",
  email: "owner@example.com",
  name: "Owner",
  image: null,
};

function makeProject(overrides: Partial<StoredProject> = {}): StoredProject {
  return {
    id: overrides.id ?? "project-1",
    name: overrides.name ?? "First Project",
    description: overrides.description,
    deadline: overrides.deadline ?? "2099-06-30T16:59:00.000Z",
    project_status: overrides.project_status ?? "active",
    priority: overrides.priority ?? 3,
    ownerId: overrides.ownerId ?? "owner-1",
    members:
      overrides.members ?? [
        {
          id: "owner-1",
          name: "Owner",
          email: "owner@example.com",
          role: "owner",
        },
        {
          id: "member-1",
          name: "Member",
          email: "member@example.com",
          role: "collaborator",
        },
      ],
    tasks: overrides.tasks ?? [],
    createdAt: overrides.createdAt ?? "2026-06-01T12:00:00.000Z",
  };
}

describe("ProjectsPage", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    searchParams.delete("projectId");
    global.fetch = jest.fn(async (url) => {
      if (url === "/api/users/me") {
        return {
          ok: true,
          json: async () => currentUser,
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ users: [] }),
      } as Response;
    });
    (updateProjectTaskApi as jest.Mock).mockResolvedValue({});
  });

  it("shows a loading state while projects are being fetched", () => {
    (fetchProjects as jest.Mock).mockReturnValue(new Promise(() => {}));

    render(<ProjectsPage />);

    expect(screen.getByText(/Loading projects/i)).toBeInTheDocument();
  });

  it("selects the project requested by the projectId search param after loading", async () => {
    searchParams.set("projectId", "project-2");
    (fetchProjects as jest.Mock).mockResolvedValue([
      makeProject({
        id: "project-1",
        name: "First Project",
        tasks: [
          {
            id: "proj-task-1",
            title: "First task",
            priority: "medium",
            status: "not-done",
            deadline: "2099-06-20T16:59:00.000Z",
            createdAt: "2026-06-01T12:00:00.000Z",
          },
        ],
      }),
      makeProject({
        id: "project-2",
        name: "Second Project",
        tasks: [
          {
            id: "proj-task-2",
            title: "Second task",
            priority: "medium",
            status: "not-done",
            deadline: "2099-06-21T16:59:00.000Z",
            createdAt: "2026-06-01T12:00:00.000Z",
          },
        ],
      }),
    ]);

    render(<ProjectsPage />);

    expect(await screen.findByText("Second task")).toBeInTheDocument();
    expect(screen.queryByText("First task")).not.toBeInTheDocument();
  });

  it("opens project settings when the project priority arrives as a serialized decimal", async () => {
    const user = userEvent.setup();
    (fetchProjects as jest.Mock).mockResolvedValue([
      makeProject({
        priority: "4.5" as unknown as number,
      }),
    ]);

    render(<ProjectsPage />);

    await user.click(await screen.findByRole("button", { name: /Project Settings/i }));

    expect(await screen.findByText("4.5")).toBeInTheDocument();
  });

  it("uses the task deadline date picker in the create task dialog", async () => {
    const user = userEvent.setup();
    (fetchProjects as jest.Mock).mockResolvedValue([makeProject()]);

    render(<ProjectsPage />);

    await user.click(await screen.findByRole("button", { name: /New Task/i }));

    expect(
      await screen.findByRole("button", { name: /Pick a date/i }),
    ).toBeInTheDocument();
  });

  it("uses the task deadline date picker in the edit task dialog", async () => {
    const user = userEvent.setup();
    (fetchProjects as jest.Mock).mockResolvedValue([
      makeProject({
        tasks: [
          {
            id: "proj-task-42",
            title: "Assigned task",
            priority: "medium",
            status: "not-done",
            assignedTo: "member-1",
            deadline: "2099-06-20T16:59:00.000Z",
            createdAt: "2026-06-01T12:00:00.000Z",
          },
        ],
      }),
    ]);

    render(<ProjectsPage />);

    await user.click(await screen.findByRole("button", { name: /Edit Task/i }));

    expect(
      await screen.findByRole("button", { name: /June 20th, 2099/i }),
    ).toBeInTheDocument();
  });

  it("lets owners move member-assigned tasks and open task editing", async () => {
    const user = userEvent.setup();
    (fetchProjects as jest.Mock).mockResolvedValue([
      makeProject({
        tasks: [
          {
            id: "proj-task-42",
            title: "Assigned task",
            priority: "medium",
            status: "not-done",
            assignedTo: "member-1",
            deadline: "2099-06-20T16:59:00.000Z",
            createdAt: "2026-06-01T12:00:00.000Z",
          },
        ],
      }),
    ]);

    render(<ProjectsPage />);

    const moveForward = await screen.findByRole("button", { name: /Move Forward/i });
    expect(moveForward).toBeEnabled();

    await user.click(moveForward);

    await waitFor(() => {
      expect(updateProjectTaskApi).toHaveBeenCalledWith(
        "proj-task-42",
        expect.objectContaining({ status: "pending" }),
      );
    });
    expect(screen.getByRole("button", { name: /Edit Task/i })).toBeInTheDocument();
  });

  it("lets members claim unassigned tasks for themselves", async () => {
    const user = userEvent.setup();
    (global.fetch as jest.Mock).mockImplementation(async (url) => {
      if (url === "/api/users/me") {
        return {
          ok: true,
          json: async () => ({
            ...currentUser,
            id: "member-1",
            email: "member@example.com",
            name: "Member",
          }),
        } as Response;
      }

      return {
        ok: true,
        json: async () => ({ users: [] }),
      } as Response;
    });
    (fetchProjects as jest.Mock).mockResolvedValue([
      makeProject({
        tasks: [
          {
            id: "proj-task-42",
            title: "Unassigned task",
            priority: "medium",
            status: "not-done",
            deadline: "2099-06-20T16:59:00.000Z",
            createdAt: "2026-06-01T12:00:00.000Z",
          },
        ],
      }),
    ]);

    render(<ProjectsPage />);

    await user.click(await screen.findByRole("button", { name: /Claim Task/i }));

    await waitFor(() => {
      expect(updateProjectTaskApi).toHaveBeenCalledWith(
        "proj-task-42",
        expect.objectContaining({ assignedTo: "member-1" }),
      );
    });
    expect(screen.queryByRole("button", { name: /Edit Task/i })).not.toBeInTheDocument();
  });
});
