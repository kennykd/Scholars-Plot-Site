jest.mock("next/server", () => ({
  NextResponse: {
    json: (body, init = {}) => ({
      status: init.status ?? 200,
      json: async () => body,
    }),
  },
}));

jest.mock("@/lib/firebase/auth", () => ({
  getSession: jest.fn(),
}));

jest.mock("@/lib/services/aiService", () => ({
  runScheduleOptimizer: jest.fn(),
}));

jest.mock("@/lib/services/scheduleService", () => ({
  confirmStudySessions: jest.fn(),
}));

import { POST, PUT } from "@/app/api/ai/schedule/route";
import { getSession } from "@/lib/firebase/auth";
import { runScheduleOptimizer } from "@/lib/services/aiService";
import { confirmStudySessions } from "@/lib/services/scheduleService";

function request(body) {
  return { json: async () => body };
}

const validSession = {
  task_id: 1,
  study_session_name: "Focus block",
  scheduled_at: "2099-06-20T15:00:00.000Z",
  focus_minutes: 25,
  break_minutes: 5,
  total_pomodoros: 2,
  total_minutes: 60,
};

describe("/api/ai/schedule auth", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it("POST rejects unauthenticated callers with 401", async () => {
    getSession.mockResolvedValue(null);

    const response = await POST(
      request({ target_date: "2099-06-20T00:00:00.000Z" }),
    );

    expect(response.status).toBe(401);
    expect(runScheduleOptimizer).not.toHaveBeenCalled();
  });

  it("POST optimizes for the session user, ignoring body user_id", async () => {
    getSession.mockResolvedValue({ id: "session-user" });
    runScheduleOptimizer.mockResolvedValue({ sessions: [] });

    const response = await POST(
      request({
        target_date: "2099-06-20T00:00:00.000Z",
        user_id: "attacker",
      }),
    );

    expect(response.status).toBe(200);
    expect(runScheduleOptimizer).toHaveBeenCalledWith(
      "session-user",
      expect.any(Date),
    );
  });

  it("PUT rejects unauthenticated callers with 401 (does not write sessions)", async () => {
    getSession.mockResolvedValue(null);

    const response = await PUT(request({ sessions: [validSession] }));

    expect(response.status).toBe(401);
    expect(confirmStudySessions).not.toHaveBeenCalled();
  });

  it("PUT persists sessions under the session user, ignoring body user_id", async () => {
    getSession.mockResolvedValue({ id: "session-user" });
    confirmStudySessions.mockResolvedValue([{ study_session_id: 1 }]);

    const response = await PUT(
      request({ user_id: "attacker", sessions: [validSession] }),
    );

    expect(response.status).toBe(200);
    expect(confirmStudySessions).toHaveBeenCalledWith([
      expect.objectContaining({ user_id: "session-user", task_id: 1 }),
    ]);
  });
});
