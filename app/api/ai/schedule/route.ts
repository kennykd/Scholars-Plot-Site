import { z } from "zod";
import { getSession } from "@/lib/firebase/auth";
import { runScheduleOptimizer } from "@/lib/services/aiService";
import { confirmStudySessions } from "@/lib/services/scheduleService";
import { NextResponse } from "next/server";

const GenerateScheduleSchema = z.object({
  target_date: z.string().datetime("Invalid date format"),
});

const ConfirmScheduleSchema = z.object({
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

/**
 * @swagger
 * /api/ai/schedule:
 *   post:
 *     summary: Generate a proposed study schedule for the authenticated user
 *     description: The user is taken from the session cookie, not the request body.
 *     tags:
 *       - AI
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [target_date]
 *             properties:
 *               target_date:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       200:
 *         description: Proposed schedule.
 *       400:
 *         description: Invalid body.
 *       401:
 *         description: Not authenticated.
 *       500:
 *         description: Failed to generate schedule.
 *   put:
 *     summary: Confirm selected sessions and persist them for the authenticated user
 *     description: Writes the supplied study sessions to the database under the signed-in user.
 *     tags:
 *       - AI
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [sessions]
 *             properties:
 *               sessions:
 *                 type: array
 *                 minItems: 1
 *                 items:
 *                   type: object
 *                   required: [task_id, study_session_name, scheduled_at, focus_minutes, break_minutes, total_pomodoros, total_minutes]
 *                   properties:
 *                     task_id: { type: integer }
 *                     study_session_name: { type: string }
 *                     scheduled_at: { type: string, format: date-time }
 *                     focus_minutes: { type: integer }
 *                     break_minutes: { type: integer }
 *                     total_pomodoros: { type: integer }
 *                     total_minutes: { type: integer }
 *     responses:
 *       200:
 *         description: Confirmed sessions.
 *       400:
 *         description: Invalid body.
 *       401:
 *         description: Not authenticated.
 *       500:
 *         description: Failed to confirm sessions.
 */

// Generate proposed schedule for the authenticated user
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

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
      session.id,
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

// Confirm selected sessions and write to database for the authenticated user
export async function PUT(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

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
        user_id: session.id,
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
