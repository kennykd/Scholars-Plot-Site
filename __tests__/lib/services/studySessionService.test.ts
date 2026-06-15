import prisma from "@/lib/prisma";
import {
  createStudySessionsForTask,
  createStudySessionForUser,
  updateStudySessionForMember,
  linkAttachmentToStudySessions,
} from "@/lib/services/studySessionService";
import { requireTaskAccess } from "@/lib/services/taskService";

jest.mock("@/lib/prisma", () => ({
  __esModule: true,
  default: {
    $transaction: jest.fn(),
    studySession: {
      create: jest.fn(),
      update: jest.fn(),
    },
    attachment: {
      findUnique: jest.fn(),
    },
    studySessionUser: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    studySessionAttachment: {
      createMany: jest.fn(),
    },
  },
}));

jest.mock("@/lib/services/taskService", () => ({
  requireTaskAccess: jest.fn(),
}));

const basePlan = {
  client_plan_id: "plan-1",
  title: "Mechanical Physics",
  start_date: "2099-03-23",
  repeat_enabled: true,
  repeat_every: 1,
  repeat_unit: "weeks" as const,
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
      createdByPlan: {},
    });

    await createStudySessionsForTask("user-1", 42, [basePlan]);

    expect(requireTaskAccess).toHaveBeenCalledWith(42, "user-1");
  });

  it("creates a one-off session from the start date inside one transaction linked to the task", async () => {
    let id = 20;
    const createMock = jest.fn(async ({ data }) => ({
      study_session_id: ++id,
      study_session_name: data.study_session_name,
    }));
    (prisma.$transaction as jest.Mock).mockImplementation((callback) =>
      callback({ studySession: { create: createMock } }),
    );

    const result = await createStudySessionsForTask("user-1", 42, [
      { ...basePlan, start_date: "2099-03-22", repeat_enabled: false },
    ]);

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          study_session_name: "Mechanical Physics",
          study_session_scheduled_at: new Date(2099, 2, 22, 15, 0, 0, 0),
        }),
      }),
    );
    expect(result.createdByPlan["plan-1"]).toEqual([21]);
  });

  it("allows a close-deadline task-day start date", async () => {
    (requireTaskAccess as jest.Mock).mockResolvedValue({
      task_id: 42,
      task_deadline: new Date(2099, 2, 20, 23, 59, 0, 0),
    });
    const createMock = jest.fn(async () => ({
      study_session_id: 31,
      study_session_name: "Mechanical Physics",
    }));
    (prisma.$transaction as jest.Mock).mockImplementation((callback) =>
      callback({ studySession: { create: createMock } }),
    );

    const result = await createStudySessionsForTask("user-1", 42, [
      { ...basePlan, start_date: "2099-03-20", repeat_enabled: false, time: "15:00" },
    ]);

    expect(createMock).toHaveBeenCalledTimes(1);
    expect(result.createdByPlan["plan-1"]).toEqual([31]);
  });

  it("creates custom weekly sessions from the start date through the task deadline", async () => {
    let id = 10;
    const createMock = jest.fn(async ({ data }) => ({
      study_session_id: ++id,
      study_session_name: data.study_session_name,
    }));
    (prisma.$transaction as jest.Mock).mockImplementation((callback) =>
      callback({ studySession: { create: createMock } }),
    );

    const result = await createStudySessionsForTask("user-1", 42, [basePlan]);

    expect(createMock).toHaveBeenCalledTimes(2);
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
    expect(result.studySessions).toHaveLength(2);
    expect(result.createdByPlan["plan-1"]).toEqual([11, 12]);
  });

  it("creates sessions every 3 days through the task deadline", async () => {
    let id = 40;
    (requireTaskAccess as jest.Mock).mockResolvedValue({
      task_id: 42,
      task_deadline: new Date("2099-04-02T23:59:00.000Z"),
    });
    const createMock = jest.fn(async ({ data }) => ({
      study_session_id: ++id,
      study_session_name: data.study_session_name,
    }));
    (prisma.$transaction as jest.Mock).mockImplementation((callback) =>
      callback({ studySession: { create: createMock } }),
    );

    const result = await createStudySessionsForTask("user-1", 42, [
      { ...basePlan, repeat_enabled: true, repeat_every: 3, repeat_unit: "days" },
    ]);

    expect(createMock).toHaveBeenCalledTimes(4);
    expect(createMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          study_session_scheduled_at: new Date(2099, 2, 26, 15, 0, 0, 0),
        }),
      }),
    );
    expect(result.createdByPlan["plan-1"]).toEqual([41, 42, 43, 44]);
  });

  it("creates sessions every 2 weeks through the task deadline", async () => {
    let id = 60;
    (requireTaskAccess as jest.Mock).mockResolvedValue({
      task_id: 42,
      task_deadline: new Date("2099-04-30T23:59:00.000Z"),
    });
    const createMock = jest.fn(async ({ data }) => ({
      study_session_id: ++id,
      study_session_name: data.study_session_name,
    }));
    (prisma.$transaction as jest.Mock).mockImplementation((callback) =>
      callback({ studySession: { create: createMock } }),
    );

    const result = await createStudySessionsForTask("user-1", 42, [
      { ...basePlan, repeat_enabled: true, repeat_every: 2, repeat_unit: "weeks" },
    ]);

    expect(createMock).toHaveBeenCalledTimes(3);
    expect(createMock).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({
        data: expect.objectContaining({
          study_session_scheduled_at: new Date(2099, 3, 6, 15, 0, 0, 0),
        }),
      }),
    );
    expect(result.createdByPlan["plan-1"]).toEqual([61, 62, 63]);
  });

  it("keeps legacy biweekly repeat payloads working", async () => {
    let id = 70;
    (requireTaskAccess as jest.Mock).mockResolvedValue({
      task_id: 42,
      task_deadline: new Date("2099-04-30T23:59:00.000Z"),
    });
    const createMock = jest.fn(async ({ data }) => ({
      study_session_id: ++id,
      study_session_name: data.study_session_name,
    }));
    (prisma.$transaction as jest.Mock).mockImplementation((callback) =>
      callback({ studySession: { create: createMock } }),
    );

    const legacyPlan = {
      client_plan_id: "plan-1",
      title: "Mechanical Physics",
      start_date: "2099-03-23",
      repeat: "biweekly" as const,
      time: "15:00",
      focus_minutes: 25,
      break_minutes: 5,
      total_pomodoros: 2,
      notes: "Practice force diagrams",
      description_as_checklist: false,
    } as unknown as Parameters<typeof createStudySessionsForTask>[2][number];

    const result = await createStudySessionsForTask("user-1", 42, [legacyPlan]);

    expect(createMock).toHaveBeenCalledTimes(3);
    expect(result.createdByPlan["plan-1"]).toEqual([71, 72, 73]);
  });

  it("rejects plans that cannot generate a future session before the deadline", async () => {
    (requireTaskAccess as jest.Mock).mockResolvedValue({
      task_id: 42,
      task_deadline: new Date(2099, 2, 20, 10, 0, 0, 0),
    });

    await expect(
      createStudySessionsForTask("user-1", 42, [
        { ...basePlan, start_date: "2099-03-20", repeat_enabled: false, time: "15:00" },
      ]),
    ).rejects.toThrow("No sessions fit before this task deadline");
  });

  it("persists reminder settings on every generated session", async () => {
    let id = 50;
    const createMock = jest.fn(async ({ data }) => ({
      study_session_id: ++id,
      study_session_name: data.study_session_name,
    }));
    (prisma.$transaction as jest.Mock).mockImplementation((callback) =>
      callback({ studySession: { create: createMock } }),
    );

    await createStudySessionsForTask("user-1", 42, [basePlan], {
      reminderEnabled: true,
      reminders: [15, 5, 0],
    });

    expect(createMock).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          study_session_reminder_enabled: true,
          study_session_remind_at_minutes: [15, 5, 0],
        }),
      }),
    );
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
      { ...basePlan, repeat_enabled: true, repeat_every: 1, repeat_unit: "weeks" },
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

type CreateInput = Parameters<typeof createStudySessionForUser>[1];
type UpdateInput = Parameters<typeof updateStudySessionForMember>[2];

describe("createStudySessionForUser", () => {
  const baseInput = {
    study_session_name: "Solo focus",
    focus_minutes: 25,
    break_minutes: 5,
    total_pomodoros: 2,
    total_minutes: 60,
    checklist_json: null,
    study_session_scheduled_at: new Date("2099-03-25T15:00:00.000Z"),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    jest.useFakeTimers().setSystemTime(new Date("2099-03-20T08:00:00.000Z"));
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it("creates a single standalone session (no task) and returns its id", async () => {
    (prisma.studySession.create as jest.Mock).mockResolvedValue({
      study_session_id: 101,
      study_session_name: "Solo focus",
    });

    const result = await createStudySessionForUser("user-1", {
      ...baseInput,
      task_id: null,
    } as unknown as CreateInput);

    expect(requireTaskAccess).not.toHaveBeenCalled();
    expect(prisma.studySession.create).toHaveBeenCalledTimes(1);
    expect(prisma.studySession.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          study_session_user: {
            create: expect.objectContaining({ user_id: "user-1", task_id: null }),
          },
        }),
      }),
    );
    expect(result.sessionIds).toEqual([101]);
  });

  it("rejects a repeating session when no task is linked", async () => {
    await expect(createStudySessionForUser("user-1", {
      ...baseInput,
      task_id: null,
      repeat_enabled: true,
      repeat_every: 1,
      repeat_unit: "weeks",
    } as unknown as CreateInput)).rejects.toThrow(
      "Choose a task before repeating a study session",
    );

    expect(requireTaskAccess).not.toHaveBeenCalled();
    expect(prisma.studySession.create).not.toHaveBeenCalled();
    expect(prisma.$transaction).not.toHaveBeenCalled();
  });

  it("bounds a task-linked repeat by the task deadline", async () => {
    (requireTaskAccess as jest.Mock).mockResolvedValue({
      task_id: 42,
      task_deadline: new Date("2099-04-15T23:59:00.000Z"),
    });
    const createMock = jest.fn(async () => ({ study_session_id: 7 }));
    (prisma.$transaction as jest.Mock).mockImplementation((callback) =>
      callback({ studySession: { create: createMock } }),
    );

    const result = await createStudySessionForUser("user-1", {
      ...baseInput,
      task_id: 42,
      repeat_enabled: true,
      repeat_every: 1,
      repeat_unit: "weeks",
    } as unknown as CreateInput);

    expect(requireTaskAccess).toHaveBeenCalledWith(42, "user-1");
    // Weekly from Mar 25 through the Apr 15 deadline: Mar 25, Apr 1, 8, 15.
    expect(createMock).toHaveBeenCalledTimes(4);
    expect(result.sessionIds).toHaveLength(4);
  });
});

describe("updateStudySessionForMember", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (prisma.studySessionUser.findUnique as jest.Mock).mockResolvedValue({
      study_session_id: 5,
      user_id: "user-1",
      status: "idle",
    });
  });

  it("relinks the session to a task after verifying ownership", async () => {
    (requireTaskAccess as jest.Mock).mockResolvedValue({ task_id: 9 });

    const result = await updateStudySessionForMember(5, "user-1", {
      task_id: 9,
    } as unknown as UpdateInput);

    expect(requireTaskAccess).toHaveBeenCalledWith(9, "user-1");
    expect(prisma.studySessionUser.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: {
          study_session_id_user_id: { study_session_id: 5, user_id: "user-1" },
        },
        data: { task_id: 9 },
      }),
    );
    expect(result.notFound).toBe(false);
  });

  it("unlinks the task when task_id is null without an ownership check", async () => {
    await updateStudySessionForMember(5, "user-1", {
      task_id: null,
    } as unknown as UpdateInput);

    expect(requireTaskAccess).not.toHaveBeenCalled();
    expect(prisma.studySessionUser.update).toHaveBeenCalledWith(
      expect.objectContaining({ data: { task_id: null } }),
    );
  });
});
