import prisma from "@/lib/prisma";
import {
  addProjectMember,
  createProject,
  ProjectServiceError,
} from "@/lib/services/projectService";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    project: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    projectUser: {
      create: jest.fn(),
      findUnique: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
  },
}));

const projectInput = {
  name: "Capstone",
  description: "Research project",
  deadline: new Date("2099-06-20T16:59:00.000Z"),
  priority: 3,
  project_status: "active" as const,
};

describe("projectService user validation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);
  });

  it("creates an owner-only project without validating extra members", async () => {
    (prisma.project.create as jest.Mock).mockResolvedValue({
      project_id: 12,
      project_name: "Capstone",
      project_user: [{ user_id: "owner-1", project_user_role: "owner" }],
      tasks: [],
    });

    await createProject("owner-1", projectInput);

    expect(prisma.user.findMany).not.toHaveBeenCalled();
    expect(prisma.project.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          project_user: {
            create: [{ user_id: "owner-1", project_user_role: "owner" }],
          },
        }),
      }),
    );
  });

  it("rejects additional project members that do not exist", async () => {
    (prisma.user.findMany as jest.Mock).mockResolvedValue([
      { user_id: "member-1" },
    ]);

    await expect(
      createProject("owner-1", {
        ...projectInput,
        members: [
          {
            id: "member-1",
            name: "Ada",
            role: "member",
          },
          {
            id: "missing-member",
            name: "Missing",
            role: "member",
          },
        ],
      }),
    ).rejects.toMatchObject({
      status: 400,
      message: "Project member does not exist: missing-member",
    });
    expect(prisma.project.create).not.toHaveBeenCalled();
  });

  it("rejects adding a nonexistent member to an existing project", async () => {
    (prisma.project.findUnique as jest.Mock).mockResolvedValue({
      project_id: 12,
    });
    (prisma.projectUser.findUnique as jest.Mock)
      .mockResolvedValueOnce({ project_user_role: "owner" })
      .mockResolvedValueOnce(null);
    (prisma.user.findMany as jest.Mock).mockResolvedValue([]);

    const promise = addProjectMember(12, "owner-1", {
      id: "missing-member",
      name: "Missing",
      role: "member",
    });

    await expect(promise).rejects.toBeInstanceOf(ProjectServiceError);
    await expect(promise).rejects.toMatchObject({
      status: 400,
      message: "Project member does not exist: missing-member",
    });
    expect(prisma.projectUser.create).not.toHaveBeenCalled();
  });
});
