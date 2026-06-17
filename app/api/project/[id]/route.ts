import { NextResponse } from 'next/server';
import { z } from 'zod';
import { updateProjectSchema } from '../../../../lib/validation/project';
import {
  deleteProjectById,
  ProjectServiceError,
  updateProjectById,
} from '@/lib/services/projectService';
import { getSession } from '@/lib/firebase/auth';
import { ensureUserRecordForSession } from '@/lib/services/userService';
import { foreignKeyRepairMessage, isPrismaForeignKeyError } from '@/lib/services/prismaErrors';

/**
 * @swagger
 * /api/project/{id}:
 *   patch:
 *     summary: Update a project by ID
 *     tags:
 *       - Projects
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Numeric project ID.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             minProperties: 1
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: "Capstone Collaboration (Updated)"
 *               description:
 *                 type: string
 *                 example: "Updated project description."
 *               deadline:
 *                 type: string
 *                 format: date-time
 *                 description: Must be in the future.
 *               priority:
 *                 type: number
 *                 minimum: 0.5
 *                 maximum: 5
 *               project_status:
 *                 type: string
 *                 enum: [active, completed, archived]
 *                 example: completed
 *               members:
 *                 type: array
 *                 items:
 *                   $ref: '#/components/schemas/ProjectMember'
 *     responses:
 *       200:
 *         description: Project updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project updated successfully
 *                 project:
 *                   $ref: '#/components/schemas/Project'
 *       400:
 *         description: Invalid project id, invalid JSON, validation failed, no fields provided, or referenced member does not exist
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
 *         description: Not authenticated
 *       403:
 *         description: Only the project owner can update the project
 *       404:
 *         description: Project not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project not found
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
 *                   example: Error updating project
 *   delete:
 *     summary: Delete a project by ID
 *     tags:
 *       - Projects
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *           minimum: 1
 *         description: Numeric project ID.
 *     responses:
 *       200:
 *         description: Project deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project deleted successfully
 *       400:
 *         description: Invalid project id
 *       401:
 *         description: Not authenticated
 *       403:
 *         description: Only the project owner can delete the project
 *       404:
 *         description: Project not found
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Project not found
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
 *                   example: Error deleting project
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
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    // Ensure the user record exists in the database for the authenticated session
    await ensureUserRecordForSession(session);

    // Extract and validate the project ID from the route parameters
    const { id } = await context.params;
    const parsedProjectId = z.coerce.number().int().positive().safeParse(id);

    // If the project ID is invalid, return a 400 Bad Request response
    if (!parsedProjectId.success) {
      return NextResponse.json({ message: 'Invalid project id' }, { status: 400 });
    }

    // Attempt to delete the project by ID for the authenticated user
    await deleteProjectById(parsedProjectId.data, session.id);

    // If successful, return a 200 OK response indicating the project was deleted
    return NextResponse.json(
      { message: 'Project deleted successfully' }, 
      { status: 200 }
    );
  } catch (error) {
    // Handle specific Project errors and return appropriate responses
    if (error instanceof ProjectServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    // Handle foreign key errors that may indicate a need for account repair
    if (isPrismaForeignKeyError(error)) {
      console.error('[api/project/:id] Foreign key error while deleting project:', error);
      return NextResponse.json({ message: foreignKeyRepairMessage() }, { status: 409 });
    }

    // Log unexpected errors and return a generic error response
    console.error('[api/project/:id] Error deleting project:', error);
    return NextResponse.json({ message: 'Error deleting project' }, { status: 500 });
  }
}

export async function PATCH(request: Request, context: RouteContext) {
  try {
    // Get the session from the request (assuming request has the session, e.g., from cookies or headers)
    const session = await getSession();

    // If the user is not authenticated, return a 401 Unauthorized response
    if (!session) {
      return NextResponse.json({ message: 'Not authenticated' }, { status: 401 });
    }

    // Ensure the user record exists in the database for the authenticated session
    await ensureUserRecordForSession(session);

    // Extract and validate the project ID from the route parameters
    const { id } = await context.params;
    const parsedProjectId = z.coerce.number().int().positive().safeParse(id);

    // If the project ID is invalid, return a 400 Bad Request response
    if (!parsedProjectId.success) {
      return NextResponse.json({ message: 'Invalid project id' }, { status: 400 });
    }

    // Parse and validate the request body against the updateProjectSchema
    let body: unknown;

    // If the request body is not valid JSON, return a 400 Bad Request response
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ message: 'Invalid JSON body' }, { status: 400 });
    };

    const parsed = updateProjectSchema.safeParse(body);

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

    // Attempt to update the project by ID for the authenticated user
    const project = await updateProjectById(parsedProjectId.data, session.id, parsed.data);
    
    // If successful, return a 200 OK response with the updated project data
    return NextResponse.json(
      { message: 'Project updated successfully', project },
      { status: 200 },
    );
  } catch (error) {
    // Handle specific Project errors and return appropriate responses
    if (error instanceof ProjectServiceError) {
      return NextResponse.json({ message: error.message }, { status: error.status });
    }

    // Handle foreign key errors that may indicate a need for account repair
    if (isPrismaForeignKeyError(error)) {
      console.error('[api/project/:id] Foreign key error while updating project:', error);
      return NextResponse.json({ message: foreignKeyRepairMessage() }, { status: 409 });
    }

    // Log unexpected errors and return a generic error response
    console.error('[api/project/:id] Error updating project:', error);
    return NextResponse.json({ message: 'Error updating project' }, { status: 500 });
  }
}
