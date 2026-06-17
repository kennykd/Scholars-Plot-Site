import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/auth";
import { getActiveNotificationsForUser } from "@/lib/services/notificationService";

/**
 * @swagger
 * /api/notifications:
 *   get:
 *     summary: List general notifications for the authenticated user
 *     description: Returns non-dismissed general notification rows newest first. Project invites are handled by the project invite endpoints.
 *     tags:
 *       - Notifications
 *     responses:
 *       200:
 *         description: Active notifications returned.
 *       401:
 *         description: Not authenticated.
 *       500:
 *         description: Failed to load notifications.
 */
export async function GET() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const notifications = await getActiveNotificationsForUser(session.id);
    return NextResponse.json({ notifications });
  } catch (error) {
    console.error("Failed to load notifications:", error);
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 500 },
    );
  }
}
