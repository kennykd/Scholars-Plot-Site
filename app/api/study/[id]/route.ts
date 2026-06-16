import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateStudySchema } from '../../../../lib/validation/study';
import { getStudySessionForUserById, deleteStudySessionIfMember, updateStudySessionForMember } from '@/lib/services/studySessionService';
import { getSession } from '@/lib/firebase/auth';

/**
 * @swagger
 * /api/study/{id}:
 *   get:
 *     summary: Get one study session for the authenticated user
 *     tags:
 *       - Study Sessions
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Study session retrieved successfully.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                 studySession:
 *                   type: object
 *                 userSessionData:
 *                   type: object
 *       400:
 *         description: Invalid Study Session ID.
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Study session not found for this user.
 *       500:
 *         description: Error retrieving study session.
 *   patch:
 *     summary: Update a study session by ID
 *     description: >
 *       Updates authenticated-user membership fields and/or shared study session fields.
 *       Completing a session can update focus-minute analytics and streak activity.
 *     tags:
 *       - Study Sessions
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               study_session_name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *               study_session_description:
 *                 type: string
 *               focus_minutes:
 *                 type: integer
 *                 minimum: 1
 *               break_minutes:
 *                 type: integer
 *                 minimum: 0
 *               total_pomodoros:
 *                 type: integer
 *                 minimum: 1
 *               total_minutes:
 *                 type: integer
 *                 minimum: 1
 *               checklist_json:
 *                 type: array
 *                 nullable: true
 *                 items:
 *                   $ref: '#/components/schemas/ChecklistItem'
 *               reminder_enabled:
 *                 type: boolean
 *               reminders:
 *                 type: array
 *                 items:
 *                   type: integer
 *                   minimum: 0
 *               study_session_scheduled_at:
 *                 type: string
 *                 format: date-time
 *               task_id:
 *                 type: integer
 *                 nullable: true
 *                 minimum: 1
 *               status:
 *                 type: string
 *                 enum: [idle, running, paused, completed]
 *               started_at:
 *                 type: string
 *                 format: date-time
 *               current_time:
 *                 type: integer
 *                 minimum: 0
 *               completed_at:
 *                 type: string
 *                 format: date-time
 *               actual_duration:
 *                 type: integer
 *                 minimum: 0
 *     responses:
 *       200:
 *         description: Study session updated successfully.
 *       400:
 *         description: Invalid ID, invalid JSON, validation failed, or no fields provided.
 *       401:
 *         description: Unauthorized.
 *       403:
 *         description: No access to linked task.
 *       404:
 *         description: Study session or linked task not found.
 *       500:
 *         description: Error updating study session.
 *   delete:
 *     summary: Delete a study session by ID
 *     tags:
 *       - Study Sessions
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *     responses:
 *       200:
 *         description: Study session deleted successfully.
 *       400:
 *         description: Invalid Study Session ID.
 *       401:
 *         description: Unauthorized.
 *       404:
 *         description: Study session not found for this user.
 *       500:
 *         description: Error deleting study session.
 */

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function GET(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Assigns a variable to the ID
    const studySessionId = Number(id);
    // Checks if the ID is numerically valid
    if (!Number.isInteger(studySessionId) || studySessionId <= 0) {
      return NextResponse.json({ message: "Invalid Study Session ID" }, { status: 400 });
    }

    // Get the current authenticated user
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    // Fetch the study session with user data
    const studySession = await getStudySessionForUserById(studySessionId, session.id);

    if (!studySession) {
      return NextResponse.json({ message: "Study session not found" }, { status: 404 });
    }

    const userSessionData = studySession.study_session_user?.[0];
    if (!userSessionData) {
      return NextResponse.json({ message: "Study session not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Study session retrieved successfully", studySession, userSessionData }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: "Error retrieving study session", error }, { status: 500 });
  }
}

export async function DELETE(request: Request, context: RouteContext) {
  try {
    // Takes the Study Session ID
    const { id } = await context.params;

    // Assigns a variable to the ID
    const studySessionId = Number(id);
    // Checks if the ID is numerically valid
    if (!Number.isInteger(studySessionId) || studySessionId <= 0) {
      return NextResponse.json({ message: "Invalid Study Session ID" }, { status: 400 });
    }

    // Get the current authenticated user
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const deleted = await deleteStudySessionIfMember(studySessionId, session.id);
    if (!deleted) {
      return NextResponse.json({ message: "Study session not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Study session deleted successfully" }, { status: 200 });
  } catch (error) {
    console.error("Delete error:", error);
    return NextResponse.json({ message: "Error in deleting study session", error }, { status: 500 })
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    // Assigns a variable to the ID
    const studySessionId = Number(id);
    // Checks if the ID is numerically valid
    if (!Number.isInteger(studySessionId) || studySessionId <= 0) {
      return NextResponse.json({ message: "Invalid Study Session ID" }, { status: 400 });
    }
    
    // Parse the requested JSON body
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
    }

    // Do input validation on the parsed json body, using zod schema, if failed return the error
    const parsed = updateStudySchema.safeParse(body)
    if (!parsed.success) {
      return NextResponse.json(
        { message: "Type Validation failed", erros: z.flattenError(parsed.error).fieldErrors },
        { status: 400 }
      );
    }

    // Check to see that at least one field is provided by the user
    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ message: 'No fields provided for update' }, { status: 400 });
    }

    // Get the current authenticated user
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ message: "Unauthorized" }, { status: 401 });
    }

    const userId = session.id;

    const result = await updateStudySessionForMember(studySessionId, userId, parsed.data);
    if (result.notFound) {
      return NextResponse.json({ message: "Study session not found" }, { status: 404 });
    }

    return NextResponse.json({ message: "Successfully updated study session", updatedStudySession: result.updatedStudySession }, { status: 200 });
  } catch (error) {
    return NextResponse.json({ message: 'Error updating study session', error }, { status: 500 });
  }
}
