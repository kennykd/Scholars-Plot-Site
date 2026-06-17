import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/auth";
import { dismissNotificationForUser } from "@/lib/services/notificationService";

type RouteContext = {
  params: Promise<{ id: string }>;
};

/**
 * @swagger
 * /api/notifications/{id}:
 *   patch:
 *     summary: Dismiss one general notification
 *     description: Soft-dismisses an owned general notification row by setting read and dismissed timestamps.
 *     tags:
 *       - Notifications
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: integer
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - action
 *             properties:
 *               action:
 *                 type: string
 *                 enum: [dismiss]
 *     responses:
 *       200:
 *         description: Notification dismissed.
 *       400:
 *         description: Invalid ID, JSON body, or action.
 *       401:
 *         description: Not authenticated.
 *       404:
 *         description: Notification not found for this user.
 *       500:
 *         description: Failed to dismiss notification.
 */
export async function PATCH(request: Request, { params }: RouteContext) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const notificationId = Number(id);
  if (!Number.isInteger(notificationId) || notificationId <= 0) {
    return NextResponse.json(
      { error: "Invalid notification id" },
      { status: 400 },
    );
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (
    typeof body !== "object" ||
    body === null ||
    !("action" in body) ||
    (body as { action?: unknown }).action !== "dismiss"
  ) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  try {
    const dismissed = await dismissNotificationForUser(
      session.id,
      notificationId,
    );

    if (!dismissed) {
      return NextResponse.json(
        { error: "Notification not found" },
        { status: 404 },
      );
    }

    return NextResponse.json({ message: "Notification dismissed" });
  } catch (error) {
    console.error("Failed to dismiss notification:", error);
    return NextResponse.json(
      { error: "Failed to dismiss notification" },
      { status: 500 },
    );
  }
}
