import { NextResponse } from 'next/server';
import { z } from 'zod';
import { getSession } from '@/lib/firebase/auth';
import { updateProjectTaskSchema } from '../../../../../lib/validation/project';
import {
  deleteProjectTaskById,
  ProjectServiceError,
  updateProjectTaskById,
} from '@/lib/services/projectService';
import { ensureUserRecordForSession } from '@/lib/services/userService';
import { foreignKeyRepairMessage, isPrismaForeignKeyError } from '@/lib/services/prismaErrors';

/**
 * @swagger
 * /api/project/task/{id}:
 *   patch:
 *     summary: Update a project task by ID
 *     tags:
 *       - Projects
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Numeric project task ID.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               title:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: "Finalize project scope (updated)"
 *               description:
 *                 type: string
 *                 example: "Updated task description."
 *               deadline:
 *                 type: string
 *                 format: date-time
 *               priority:
 *                 type: number
 *                 minimum: 0.5
 *                 maximum: 5
 *                 example: 3
 *               status:
 *                 type: string
 *                 enum: [Pending, In_Progress, Completed]
 *                 example: In_Progress
 *               assignedTo:
 *                 type: string
 *                 example: "member-002"
 *               attachments:
 *                 type: array
 *                 items:
 *                   type: string
 *                 example: ["updated-spec.pdf"]
 *     responses:
 *       200:
 *         description: Project task updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project task updated successfully
 *                 task:
 *                   $ref: '#/components/schemas/ProjectTask'
 *       400:
 *         description: Invalid task id, invalid JSON, validation failed, no fields provided, or assigned user does not exist
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
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: User is not allowed to make the requested task change
 *       404:
 *         description: Project task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project task not found
 *       409:
 *         description: Account record needs repair (foreign key error)
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error updating project task
 *   delete:
 *     summary: Delete a project task by ID
 *     tags:
 *       - Projects
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Numeric project task ID.
 *     responses:
 *       200:
 *         description: Project task deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project task deleted successfully
 *       400:
 *         description: Invalid project task id
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Only the project owner can delete project tasks
 *       404:
 *         description: Project task not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project task not found
 *       409:
 *         description: Account record needs repair (foreign key error)
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Error deleting project task
 */

// Define a type for the route context, which includes the route parameters
type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function DELETE(_: Request, context: RouteContext) {
  try {
    // Get the session from the request (assuming request has the session, e.g., from cookies or headers)
    const session = await getSession();

    // If the user is not authenticated, return a 401 Unauthorized response
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Ensure the user record exists in the database for the authenticated session
    await ensureUserRecordForSession(session);

    // Parse and validate the project task ID from the route parameters
    const { id } = await context.params;
    const parsedTaskId = z.coerce.number().int().positive().safeParse(id);

    // If the project task ID is not valid, return a 400 Bad Request response
    if (!parsedTaskId.success) {
      return NextResponse.json({ message: 'Invalid project task id' }, { status: 400 });
    }

    // Call the service function to delete the project task by ID
    await deleteProjectTaskById(parsedTaskId.data, session.id);

    // If successful, return a 200 OK response indicating the project task was deleted
    return NextResponse.json(
      { message: 'Project task deleted successfully' }, 
      { status: 200 }
    );
  } catch (error) {
    // Handle specific Project errors and return appropriate responses
    if (error instanceof ProjectServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    // Handle foreign key errors that may indicate a need for account repair
    if (isPrismaForeignKeyError(error)) {
      console.error('[api/project/task/:id] Foreign key error while deleting project task:', error);
      return NextResponse.json({ message: foreignKeyRepairMessage() }, { status: 409 });
    }

    // Log unexpected errors and return a generic error response
    console.error('[api/project/task/:id] Error deleting project task:', error);
    return NextResponse.json({ message: 'Error deleting project task' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    // Get the session from the request (assuming request has the session, e.g., from cookies or headers)
    const session = await getSession();

    // If the user is not authenticated, return a 401 Unauthorized response
    if (!session) {
      return NextResponse.json({ message: 'Unauthorized' }, { status: 401 });
    }

    // Ensure the user record exists in the database for the authenticated session
    await ensureUserRecordForSession(session);

    // Parse and validate the project task ID from the route parameters
    const { id } = await context.params;
    const parsedTaskId = z.coerce.number().int().positive().safeParse(id);

    // If the project task ID is not valid, return a 400 Bad Request response
    if (!parsedTaskId.success) {
      return NextResponse.json({ message: 'Invalid project task id' }, { status: 400 });
    }

    // Parse and validate the request body against the updateProjectTaskSchema
    let body: unknown;

    // If the request body is not valid JSON, return a 400 Bad Request response
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
    };

    const parsed = updateProjectTaskSchema.safeParse(body);

    // If validation fails, return a 400 Bad Request response with validation errors
    if (!parsed.success) {
      return NextResponse.json(
        { message: 'Validation failed', errors: z.flattenError(parsed.error).fieldErrors },
        { status: 400 },
      );
    };

    // If no fields are provided for update, return a 400 Bad Request response
    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json({ message: 'No fields provided for update' }, { status: 400 });
    };

    // Call the service function to update the project task by ID
    const task = await updateProjectTaskById(parsedTaskId.data, session.id, parsed.data);

    // If successful, return a 200 OK response with the updated project task data
    return NextResponse.json(
      { message: 'Project task updated successfully', task },
      { status: 200 },
    );
  } catch (error) {
    // Handle specific Project errors and return appropriate responses
    if (error instanceof ProjectServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    // Handle foreign key errors that may indicate a need for account repair
    if (isPrismaForeignKeyError(error)) {
      console.error('[api/project/task/:id] Foreign key error while updating project task:', error);
      return NextResponse.json({ message: foreignKeyRepairMessage() }, { status: 409 });
    }

    // Log unexpected errors and return a generic error response
    console.error('[api/project/task/:id] Error updating project task:', error);
    return NextResponse.json({ message: 'Error updating project task' }, { status: 500 });
  }
}
