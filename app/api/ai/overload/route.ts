import { z } from "zod";
import { getSession } from "@/lib/firebase/auth";
import { runOverloadDetector } from "@/lib/services/aiService";
import {
  getOverloadWarningsForUser,
  markWarningAsRead,
} from "@/lib/services/overloadService";
import { NextResponse } from "next/server";

const DetectOverloadSchema = z.object({
  target_date: z.string().datetime("Invalid date format"),
});

const MarkReadSchema = z.object({
  warning_id: z.number().int().positive(),
});

/**
 * @swagger
 * /api/ai/overload:
 *   post:
 *     summary: Run overload detection for the authenticated user's week
 *     description: Analyses the week containing target_date for the signed-in user. The user is taken from the session cookie, not the request body.
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
 *                 description: Any date within the week to analyse.
 *     responses:
 *       200:
 *         description: Overload detection result.
 *       400:
 *         description: Invalid body.
 *       401:
 *         description: Not authenticated.
 *       500:
 *         description: Detection failed.
 *   get:
 *     summary: List stored overload warnings for the authenticated user
 *     tags:
 *       - AI
 *     parameters:
 *       - in: query
 *         name: limit
 *         required: false
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Array of overload warnings.
 *       401:
 *         description: Not authenticated.
 *       500:
 *         description: Failed to fetch warnings.
 *   patch:
 *     summary: Mark an overload warning as read
 *     tags:
 *       - AI
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [warning_id]
 *             properties:
 *               warning_id:
 *                 type: integer
 *     responses:
 *       200:
 *         description: Updated warning.
 *       400:
 *         description: Invalid body.
 *       401:
 *         description: Not authenticated.
 *       500:
 *         description: Update failed.
 */

// Manually trigger overload detection for the authenticated user
export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = DetectOverloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const weekStart = new Date(parsed.data.target_date);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const result = await runOverloadDetector(session.id, weekStart, weekEnd);

    return NextResponse.json(result);
  } catch (error) {
    console.error("Overload detection failed:", error);
    return NextResponse.json(
      { error: "Failed to run overload detection" },
      { status: 500 }
    );
  }
}

// Fetch stored warnings for the authenticated user
export async function GET(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const { searchParams } = new URL(request.url);
  const limit = searchParams.get("limit");

  try {
    const warnings = await getOverloadWarningsForUser(
      session.id,
      limit ? parseInt(limit) : 10
    );
    return NextResponse.json(warnings);
  } catch (error) {
    console.error("Failed to fetch warnings:", error);
    return NextResponse.json(
      { error: "Failed to fetch warnings" },
      { status: 500 }
    );
  }
}

// Mark a warning as read
export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = MarkReadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const updated = await markWarningAsRead(parsed.data.warning_id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to mark warning as read:", error);
    return NextResponse.json(
      { error: "Failed to update warning" },
      { status: 500 }
    );
  }
}
