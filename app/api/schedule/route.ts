import { z } from "zod";
import { runScheduleOptimizer } from "@/lib/services/aiService";
import { confirmStudySessions } from "@/lib/services/scheduleService";
import { NextResponse } from "next/server";

const GenerateScheduleSchema = z.object({
  user_id: z.string().min(1),
  target_date: z.string().datetime("Invalid date format"),
});

const ConfirmScheduleSchema = z.object({
  user_id: z.string().min(1),
  sessions: z.array(
    z.object({
      task_id: z.number().int().positive(),
      study_session_name: z.string().min(1),
      scheduled_at: z.string().datetime(),
      focus_minutes: z.number().int().positive(),
      break_minutes: z.number().int().positive(),
      total_pomodoros: z.number().int().positive(),
      total_minutes: z.number().int().positive(),
    })
  ).min(1),
});

// Generate proposed schedule
export async function POST(request: Request) {
  const body = await request.json();
  const parsed = GenerateScheduleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const result = await runScheduleOptimizer(
      parsed.data.user_id,
      new Date(parsed.data.target_date)
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Schedule optimizer failed:", error);
    return NextResponse.json(
      { error: "Failed to generate schedule" },
      { status: 500 }
    );
  }
}

// Confirm selected sessions and write to database
export async function PUT(request: Request) {
  const body = await request.json();
  const parsed = ConfirmScheduleSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const confirmed = await confirmStudySessions(
      parsed.data.sessions.map((s) => ({
        ...s,
        user_id: parsed.data.user_id,
        study_session_scheduled_at: new Date(s.scheduled_at),
      }))
    );
    return NextResponse.json(confirmed);
  } catch (error) {
    console.error("Session confirmation failed:", error);
    return NextResponse.json(
      { error: "Failed to confirm sessions" },
      { status: 500 }
    );
  }
}