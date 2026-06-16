import { z } from "zod";
import { getSession } from "@/lib/firebase/auth";
import {
  runWeightAdapter,
  runWeightAdapterForAllUsers,
} from "@/lib/services/aiService";
import { NextResponse } from "next/server";

const RequestSchema = z.object({
  run_all_users: z.boolean().optional(),
});

function validateCronSecret(request: Request): boolean {
  const secret = request.headers.get("x-cron-secret");
  return secret === process.env.CRON_SECRET;
}

/**
 * @swagger
 * /api/ai/weight-adapter:
 *   post:
 *     summary: Adapt priority-formula weights
 *     description: >
 *       With `run_all_users: true` this performs the batch adaptation for every active
 *       user and requires the `x-cron-secret` header (used by the scheduled job). Otherwise
 *       it adapts weights for the authenticated user only (user taken from the session cookie).
 *     tags:
 *       - AI
 *     parameters:
 *       - in: header
 *         name: x-cron-secret
 *         required: false
 *         schema:
 *           type: string
 *         description: Required only when run_all_users is true.
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               run_all_users:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Adaptation result (single user) or batch summary (all users).
 *       400:
 *         description: Invalid body.
 *       401:
 *         description: Not authenticated (single user) or invalid cron secret (all users).
 *       500:
 *         description: Weight adapter failed.
 */

export async function POST(request: Request) {
  const body = await request.json().catch(() => ({}));
  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // All-users run requires cron secret — prevents abuse
  if (parsed.data.run_all_users) {
    if (!validateCronSecret(request)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    try {
      const summary = await runWeightAdapterForAllUsers();
      return NextResponse.json(summary);
    } catch (error) {
      console.error("Weight adapter all-users run failed:", error);
      return NextResponse.json(
        { error: "Weight adapter failed" },
        { status: 500 }
      );
    }
  }

  // Single user run — authenticated, scoped to the session user
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    const result = await runWeightAdapter(session.id);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Weight adapter failed:", error);
    return NextResponse.json(
      { error: "Weight adapter failed" },
      { status: 500 }
    );
  }
}