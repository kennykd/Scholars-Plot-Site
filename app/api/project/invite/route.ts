import { NextResponse } from "next/server";
import { getSession } from '@/lib/firebase/auth';
import { ensureUserRecordForSession } from '@/lib/services/userService';
import { getPendingInvitesForUser, createProjectInvite } from "@/lib/services/projectService";

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

        const { projectId: rawProjectId, targetUserEmail } = await req.json();

        // Standardize projectId conversion
        const projectId = Number(rawProjectId);

        if (!rawProjectId || isNaN(projectId) || !targetUserEmail) {
            return NextResponse.json({ message: "Missing or invalid required fields" }, { status: 400 });
        }

        // Find target user by email 
        // Verify sender is authorized (owner)
        // Check if target user is already part of the project
        // Upsert invite payload
        // We call service function to do all database checks and fill table now
        const invite = await createProjectInvite(projectId, user.id, targetUserEmail);

        return NextResponse.json({ message: "Invite sent successfully", invite }, { status: 201 });
    } catch (error: any) {
        // If service helper throw custom error with status we handle here
        if (error.status) {
            return NextResponse.json({ message: error.message }, { status: error.status });
        }
        console.error("Error creating project invite:", error);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}