import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateStudySchema } from '../../../../lib/validation/study';
import { getStudySessionForUserById, deleteStudySessionIfMember, updateStudySessionForMember } from '@/lib/services/studySessionService';
import { getSession } from '@/lib/firebase/auth';

/**
 * @swagger
 * /api/study/{id}:
 *   patch:
 *     summary: Update a study session by ID
 *     tags:
 *       - Study Sessions
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The unique ID of the study session to update
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               taskId:
 *                 type: string
 *                 example: "task-002"
 *               taskTitle:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: "Data Structures Assignment 3"
 *               duration:
 *                 type: number
 *                 minimum: 1
 *                 description: Updated study duration in minutes
 *                 example: 50
 *               breakDuration:
 *                 type: number
 *                 minimum: 0
 *                 description: Updated break duration in minutes
 *                 example: 10
 *               checklist:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/ChecklistItem'
 *               status:
 *                 type: string
 *                 enum: [pending, active, completed]
 *                 example: active
 *               scheduledAt:
 *                 type: string
 *                 format: date-time
 *                 description: Updated scheduled time (must be in the future)
 *                 example: "2026-04-02T10:00:00.000Z"
 *     responses:
 *       200:
 *         description: Study session updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Study session updated successfully
 *                 studySession:
 *                   $ref: '#/components/schemas/StudySession'
 *       400:
 *         description: Validation failed, invalid JSON, or no fields provided
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Validation failed
 *                 errors:
 *                   type: object
 *                   additionalProperties:
 *                     type: array
 *                     items:
 *                       type: string
 *       404:
 *         description: Study session not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Study session not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error updating study session
 *   delete:
 *     summary: Delete a study session by ID
 *     tags:
 *       - Study Sessions
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *           format: uuid
 *         description: The unique ID of the study session to delete
 *         example: "123e4567-e89b-12d3-a456-426614174000"
 *     responses:
 *       200:
 *         description: Study session deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Study session deleted successfully
 *       404:
 *         description: Study session not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Study session not found
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error deleting study session
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