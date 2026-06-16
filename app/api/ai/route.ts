import { NextResponse } from 'next/server';
import { z } from 'zod';
import { runTaskAnalysis } from '@/lib/services/aiService';
import { requireTaskAccess, TaskServiceError } from '@/lib/services/taskService';
import { getSession } from '@/lib/firebase/auth';

/**
 * @swagger
 * /api/ai:
 *   post:
 *     summary: Re-run AI analysis for one of the authenticated user's tasks
 *     description: >
 *       Recomputes the AI-derived fields (estimated minutes, confidence score, grade
 *       weight, priority score) for a task the caller owns or is assigned to. The user is
 *       taken from the session cookie, and access is enforced via requireTaskAccess.
 *     tags:
 *       - AI
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - task_id
 *             properties:
 *               task_id:
 *                 type: integer
 *                 minimum: 1
 *                 description: ID of the task to re-analyze.
 *                 example: 42
 *     responses:
 *       200:
 *         description: Analysis completed successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *       400:
 *         description: Invalid body (task_id missing or not a positive integer).
 *       401:
 *         description: Not authenticated.
 *       403:
 *         description: No access to this task.
 *       404:
 *         description: Task not found.
 *       500:
 *         description: Analysis failed.
 */

const ReAnalyzeSchema = z.object({
  task_id: z.number().int().positive(),
});

export async function POST(request: Request) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  }

  const body = await request.json();
  const parsed = ReAnalyzeSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    await requireTaskAccess(parsed.data.task_id, session.id);
    await runTaskAnalysis(parsed.data.task_id, session.id);
    return NextResponse.json({ success: true });
  } catch (error) {
    if (error instanceof TaskServiceError) {
      return NextResponse.json({ error: error.message }, { status: error.status });
    }
    console.error("Re-analysis failed:", error);
    return NextResponse.json(
      { error: "Analysis failed" },
      { status: 500 }
    );
  }
}
