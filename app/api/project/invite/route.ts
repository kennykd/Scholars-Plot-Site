import { NextResponse } from "next/server";
import { getSession } from '@/lib/firebase/auth';
import { ensureUserRecordForSession } from '@/lib/services/userService';
import { getPendingInvitesForUser, createProjectInvite } from "@/lib/services/projectService";
import { createProjectInviteSchema } from "@/lib/validation/project";

function isServiceError(error: unknown): error is { status: number; message: string } {
    return (
        typeof error === "object" &&
        error !== null &&
        "status" in error &&
        typeof (error as { status: unknown }).status === "number" &&
        "message" in error &&
        typeof (error as { message: unknown }).message === "string"
    );
}

/**
 * @swagger
 * /api/project/invite:
 *   get:
 *     summary: List pending project invites for the authenticated user
 *     tags:
 *       - Projects
 *     description: Requires the session cookie and returns pending invites where the user is the invitee.
 *     responses:
 *       200:
 *         description: Pending invites returned.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 invites:
 *                   type: array
 *                   items:
 *                     type: object
 *       401:
 *         description: Not Authenticated.
 *       500:
 *         description: Internal Server Error.
 *   post:
 *     summary: Invite a user to a project
 *     tags:
 *       - Projects
 *     description: >
 *       Requires the session cookie. The sender must be the project owner. The target
 *       can be supplied by user ID or email. Creates or resets a pending invite.
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [projectId]
 *             properties:
 *               projectId:
 *                 oneOf:
 *                   - type: integer
 *                   - type: string
 *                 description: Numeric project ID; strings may include a project- prefix.
 *               targetUserId:
 *                 type: string
 *               targetUserEmail:
 *                 type: string
 *                 format: email
 *             anyOf:
 *               - required: [targetUserId]
 *               - required: [targetUserEmail]
 *     responses:
 *       201:
 *         description: Invite sent successfully.
 *       400:
 *         description: Invalid JSON body or missing/invalid required fields.
 *       401:
 *         description: Not Authenticated.
 *       403:
 *         description: Sender is not the project owner.
 *       404:
 *         description: Target user not found.
 *       409:
 *         description: Target user is already a project member.
 *       500:
 *         description: Internal Server Error.
 */
export async function GET() {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ message: "Not Authenticated" }, { status: 401 });
        }

        // Ensure that the user record exists for the session
        const user = await ensureUserRecordForSession(session);

        // Find all pending invitations for the current user
        // We use the service function now, it pass user_id because schema need it
        const pendingInvites = await getPendingInvitesForUser(user.id);

        // Return the list of pending invitations
        return NextResponse.json({ invites: pendingInvites });
    } catch (error) {
        console.error("Error fetching invites:", error);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}

export async function POST(req: Request) {
    try {
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ message: "Not Authenticated" }, { status: 401 });
        }

        const user = await ensureUserRecordForSession(session);

        let body: unknown;
        try {
            body = await req.json();
        } catch {
            return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
        }

        const parsed = createProjectInviteSchema.safeParse(body);

        if (!parsed.success) {
            return NextResponse.json({ message: "Missing or invalid required fields" }, { status: 400 });
        }

        // Find target user by email 
        // Verify sender is authorized (owner)
        // Check if target user is already part of the project
        // Upsert invite payload
        // We call service function to do all database checks and fill table now
        const invite = await createProjectInvite(parsed.data.projectId, user.id, {
            targetUserId: parsed.data.targetUserId,
            targetUserEmail: parsed.data.targetUserEmail,
        });

        return NextResponse.json({ message: "Invite sent successfully", invite }, { status: 201 });
    } catch (error: unknown) {
        // If service helper throw custom error with status we handle here
        if (isServiceError(error)) {
            return NextResponse.json({ message: error.message }, { status: error.status });
        }
        console.error("Error creating project invite:", error);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}
