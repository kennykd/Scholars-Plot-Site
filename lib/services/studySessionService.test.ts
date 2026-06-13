import prisma from "@/lib/prisma";
import {
  createStudySessionsForTask,
  linkAttachmentToStudySessions,
} from "@/lib/services/studySessionService";
import { requireTaskAccess } from "@/lib/services/taskService";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    attachment: {
      findUnique: jest.fn(),
    },
    studySessionUser: {
      findMany: jest.fn(),
    },
    studySessionAttachment: {
      createMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/services/taskService", () => ({
  requireTaskAccess: jest.fn(),
}));

const baseTrack = {
  client_track_id: "track-1",
  title: "Mechanical Physics",
  weekdays: [1, 4],
  time: "15:00",
  focus_minutes: 25,
  break_minutes: 5,
  total_pomodoros: 2,
  notes: "Practice force diagrams",
  description_as_checklist: false,
};

describe("createStudySessionsForTask", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2099-03-20T08:00:00.000Z"));
    (requireTaskAccess as jest.Mock).mockResolvedValue({
      task_id: 42,
      task_deadline: new Date("2099-03-31T23:59:00.000Z"),
    });
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("requires access to the personal task before creating sessions", async () => {
    (prisma.$transaction as jest.Mock).mockResolvedValue({
      studySessions: [],
      createdByTrack: {},
    });

    await createStudySessionsForTask("user-1", 42, [baseTrack]);

    expect(requireTaskAccess).toHaveBeenCalledWith(42, "user-1");
  });

  it("creates generated weekday sessions inside one transaction linked to the task", async () => {
    let id = 10;
    const createMock = jest.fn(async ({ data }) => ({
      study_session_id: ++id,
      study_session_name: data.study_session_name,
    }));
    (prisma.$transaction as jest.Mock).mockImplementation((callback) =>
      callback({ studySession: { create: createMock } }),
    );

    const result = await createStudySessionsForTask("user-1", 42, [baseTrack]);

    expect(createMock).toHaveBeenCalledTimes(3);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          study_session_name: "Mechanical Physics",
          study_session_scheduled_at: new Date(2099, 2, 23, 15, 0, 0, 0),
          total_minutes: 60,
          study_session_user: {
            create: {
              user_id: "user-1",
              task_id: 42,
            },
          },
        }),
      }),
    );
    expect(result.studySessions).toHaveLength(3);
    expect(result.createdByTrack["track-1"]).toEqual([11, 12, 13]);
  });

  it("caps generated sessions at 50", async () => {
    (requireTaskAccess as jest.Mock).mockResolvedValue({
      task_id: 42,
      task_deadline: new Date("2101-03-31T23:59:00.000Z"),
    });
    const createMock = jest.fn(async () => ({
      study_session_id: Math.floor(Math.random() * 1000),
    }));
    (prisma.$transaction as jest.Mock).mockImplementation((callback) =>
      callback({ studySession: { create: createMock } }),
    );

    const result = await createStudySessionsForTask("user-1", 42, [
      { ...baseTrack, weekdays: [0, 1, 2, 3, 4, 5, 6] },
    ]);

    expect(createMock).toHaveBeenCalledTimes(50);
    expect(result.studySessions).toHaveLength(50);
  });
});

describe("linkAttachmentToStudySessions", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("links an owned attachment to study sessions owned by the same user", async () => {
    (prisma.attachment.findUnique as jest.Mock).mockResolvedValue({
      attachment_id: 9,
      user_id: "user-1",
      task_id: null,
    });
    (prisma.studySessionUser.findMany as jest.Mock).mockResolvedValue([
      { study_session_id: 11 },
      { study_session_id: 12 },
    ]);
    (prisma.studySessionAttachment.createMany as jest.Mock).mockResolvedValue({
      count: 2,
    });

    await linkAttachmentToStudySessions("user-1", 9, [11, 12]);

    expect(prisma.studySessionAttachment.createMany).toHaveBeenCalledWith({
      data: [
        { study_session_id: 11, attachment_id: 9, user_id: "user-1" },
        { study_session_id: 12, attachment_id: 9, user_id: "user-1" },
      ],
      skipDuplicates: true,
    });
  });
});
