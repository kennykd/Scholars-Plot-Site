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
  // Parse and validate the request body against the RequestSchema
  const body = await request.json().catch(() => ({}));
  const parsed = RequestSchema.safeParse(body);

  // If the request body is invalid, return a 400 Bad Request response with validation errors
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // All-users run requires cron secret, which prevents abuse
  // This process is run by a scheduled job and is not tied to any user session, so we check the secret instead of authentication
  if (parsed.data.run_all_users) {
    if (!validateCronSecret(request)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    try {
      // The result of the all-users run is a summary of the batch process, not individual results
      const summary = await runWeightAdapterForAllUsers();
      // Return the batch summary as the response (status is code 200 by default from NextResponse.json)
      return NextResponse.json(summary);
    } catch (error) {
      console.error("Weight adapter all-users run failed:", error);

      // Return a 500 Internal Server Error response if any unexpected error occurs during processing
      return NextResponse.json(
        { error: "Weight adapter failed" },
        { status: 500 }
      );
    }
  }

  // Single user run — authenticated, scoped to the session user

  // Get the session from the request (assuming request has the session, e.g., from cookies or headers)
  const session = await getSession();

  // If the user is not authenticated, return a 401 Unauthorized response
  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  try {
    // The result is the adapted weights for the user
    const result = await runWeightAdapter(session.id);
    // Return the adapted weights as the response (status is code 200 by default from NextResponse.json)
    return NextResponse.json(result);
  } catch (error) {
    console.error("Weight adapter failed:", error);

    // Return a 500 Internal Server Error response if any unexpected error occurs during processing
    return NextResponse.json(
      { error: "Weight adapter failed" },
      { status: 500 }
    );
  }
}