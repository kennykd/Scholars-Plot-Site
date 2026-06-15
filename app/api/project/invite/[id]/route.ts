import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/auth";
import { ensureUserRecordForSession } from "@/lib/services/userService";
import { respondToInvite } from "@/lib/services/projectService";

// Handle accepting or declining an invitation to the project
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
    try {
        // Authenticate user session
        const session = await getSession();
        if (!session) {
            return NextResponse.json({ message: "Not Authenticated" }, { status: 401 });
        }

        const user = await ensureUserRecordForSession(session);

        // Resolve dynamic route params and body variables
        const { id } = await params;
        const inviteId = Number(id);
        const { action } = await req.json(); // Expected: "accepted" or "declined"

        if (!id || isNaN(inviteId)) {
            return NextResponse.json({ message: "Invalid Invite ID" }, { status: 400 });
        }

        if (!action || !["accepted", "declined"].includes(action)) {
            return NextResponse.json(
                { message: "Invalid action. Must be 'accepted' or 'declined'" },
                { status: 400 }
            );
        }

        // Find the invitation to verify existence and authorization
        // Ensure that the logged-in user is the one who was actually invited
        // Ensure they aren't trying to re-respond to an already answered invite
        // Handle Action using a Database Transaction
        // We do all these find, check user_id, and transaction inside service file function now
        // It use user.user_id because db model name is that one
        const result = await respondToInvite(inviteId, user.id, action);

        if (action === "accepted") {
            return NextResponse.json({
                message: "Invitation accepted and joined project successfully",
                invite: result,
            });
        } {
            return NextResponse.json({
                message: "Invitation declined successfully",
                invite: result,
            });
        }
    } catch (error: any) {
        // If service helper find error or wrong user it throw status, we catch here
        if (error.status) {
            return NextResponse.json({ message: error.message }, { status: error.status });
        }
        console.error("Error processing invitation response:", error);
        return NextResponse.json({ message: "Internal Server Error" }, { status: 500 });
    }
}