import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/firebase/auth';
import {
  getAnalyticsByUserId,
  updateAnalyticsByUserId,
} from '@/lib/services/analyticService';
import { updateAnalyticsSchema } from '@/lib/validation/analytics';

/**
 * @swagger
 * /api/analytics:
 *   get:
 *     summary: Get the current user's analytics
 *     tags:
 *       - Analytics
 *     description: >
 *       Retrieves the authenticated user's analytics record. If no record
 *       exists yet, it is automatically created with all values set to 0.
 *       All values are stored encrypted in the database and are decrypted
 *       before being returned.
 *     responses:
 *       200:
 *         description: Analytics retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Analytics retrieved successfully
 *                 analytics:
 *                   type: object
 *                   properties:
 *                     completionStats:
 *                       type: object
 *                       properties:
 *                         early:
 *                           type: integer
 *                         onTime:
 *                           type: integer
 *                         late:
 *                           type: integer
 *                         pending:
 *                           type: integer
 *                     streak:
 *                       type: integer
 *                     totalFocusMinutes:
 *                       type: integer
 *                     totalTasksCompleted:
 *                       type: integer
 *       401:
 *         description: User is not authenticated
 *       500:
 *         description: Internal server error
 *
 *   patch:
 *     summary: Update the current user's analytics
 *     tags:
 *       - Analytics
 *     description: >
 *       Performs a partial update on the authenticated user's analytics record.
 *       Only the fields provided in the request body will be updated. All values
 *       are re-encrypted before being saved to the database.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               tasks_completed_early:
 *                 type: integer
 *                 minimum: 0
 *               tasks_completed_on_time:
 *                 type: integer
 *                 minimum: 0
 *               tasks_completed_late:
 *                 type: integer
 *                 minimum: 0
 *               tasks_pending:
 *                 type: integer
 *                 minimum: 0
 *               total_focus_minutes:
 *                 type: integer
 *                 minimum: 0
 *               total_tasks_completed:
 *                 type: integer
 *                 minimum: 0
 *               streak:
 *                 type: integer
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Analytics updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Analytics updated successfully
 *                 analytics:
 *                   type: object
 *       400:
 *         description: Validation failed or invalid JSON body
 *       401:
 *         description: User is not authenticated
 *       500:
 *         description: Internal server error
 */

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: 'User is not authenticated!' }, { status: 401 });
    }

    const analytics = await getAnalyticsByUserId(session.id);

    return NextResponse.json(
      { message: 'Analytics retrieved successfully', analytics },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error retrieving analytics:', error);
    return NextResponse.json({ message: 'Error retrieving analytics' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: 'User is not authenticated!' }, { status: 401 });
    }

    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
    }

    const parsed = updateAnalyticsSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: z.flattenError(parsed.error).fieldErrors },
        { status: 400 }
      );
    }

    // updateAnalyticsByUserId already calls transformToAnalyticsData internally
    const analytics = await updateAnalyticsByUserId(session.id, parsed.data);

    return NextResponse.json(
      { message: 'Analytics updated successfully', analytics },
      { status: 200 }
    );
  } catch (error) {
    console.error('Error updating analytics:', error);
    return NextResponse.json({ message: 'Error updating analytics' }, { status: 500 });
  }
}
