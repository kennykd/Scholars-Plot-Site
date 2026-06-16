import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { z } from "zod";
import { adminAuth } from "@/lib/firebase/firebase-admin";
import { getSession } from "@/lib/firebase/auth";
import {
  deleteUserById,
  getUserProfileForSession,
  updateUserProfile,
} from "@/lib/services/userService";
import { updateUserSchema } from "@/lib/validation/user";

/**
 * @swagger
 * /api/users/me:
 *   get:
 *     summary: Get the currently authenticated user
 *     tags:
 *       - Users
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Authenticated user returned successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/SessionUser'
 *       401:
 *         description: Unauthorized — no valid session
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Unauthorized
 *       500:
 *         description: Failed to retrieve user profile
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Failed to retrieve user
 *   put:
 *     summary: Update the authenticated user's profile
 *     tags:
 *       - Users
 *     security:
 *       - cookieAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               name:
 *                 type: string
 *                 minLength: 1
 *                 maxLength: 100
 *                 example: "Barry Allen"
 *               image:
 *                 type: string
 *                 format: uri
 *                 example: "https://example.com/avatar.png"
 *     responses:
 *       200:
 *         description: User updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: User updated successfully
 *                 user:
 *                   $ref: '#/components/schemas/SessionUser'
 *       400:
 *         description: Validation failed or invalid JSON
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
 *         description: Unauthorized — no valid session
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Unauthorized
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Failed to update user
 *   delete:
 *     summary: Delete the authenticated user's account
 *     description: >
 *       Permanently deletes the user from the database (cascading all related data)
 *       and from Firebase Authentication, then clears the session cookie.
 *       This action is irreversible.
 *     tags:
 *       - Users
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Account deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Account deleted successfully
 *       401:
 *         description: Unauthorized — no valid session
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Unauthorized
 *       500:
 *         description: Internal server error
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Account data deleted but Firebase cleanup failed. Please contact support.
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     SessionUser:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "clxyz123abc"
 *         email:
 *           type: string
 *           format: email
 *           example: "barry@example.com"
 *         name:
 *           type: string
 *           nullable: true
 *           example: "Barry Allen"
 *         image:
 *           type: string
 *           nullable: true
 *           example: "https://example.com/avatar.png"
 */

// Get authenticated user from session and return a JSON response
export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const user = await getUserProfileForSession(session);
    return NextResponse.json(user);
  } catch (error) {
    console.error("[api/users/me] Failed to read user profile:", error);
    return NextResponse.json({ error: "Failed to retrieve user" }, { status: 500 });
  }
}

// Update the authenticated user's profile (name and/or image)
export async function PUT(request: NextRequest) {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ message: "Invalid JSON body" }, { status: 400 });
  }

  const parsed = updateUserSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { message: "Validation failed", errors: z.flattenError(parsed.error).fieldErrors },
      { status: 400 },
    );
  }

  try {
    const user = await updateUserProfile(session.id, parsed.data);

    return NextResponse.json(
      {
        message: "User updated successfully",
        user,
      },
      { status: 200 },
    );
  } catch (error) {
    console.error("[api/users/me] Failed to update user:", error);
    return NextResponse.json({ error: "Failed to update user" }, { status: 500 });
  }
}

// Delete the authenticated user's account from the database and Firebase Auth
export async function DELETE() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Re-verify the session cookie to get the Firebase uid needed by adminAuth.deleteUser()
  const cookieStore = await cookies();
  const sessionCookie = cookieStore.get("session")?.value;

  if (!sessionCookie) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let firebaseUid: string;
  try {
    const decodedToken = await adminAuth.verifyIdToken(sessionCookie);
    firebaseUid = decodedToken.uid;
  } catch {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Step 1: Delete from database first — cascades Sessions, Accounts, Todos
  try {
    await deleteUserById(session.id);
  } catch (error) {
    console.error("[api/users/me] Failed to delete user from database:", error);
    return NextResponse.json({ error: "Failed to delete account" }, { status: 500 });
  }

  // Step 2: Remove from Firebase Auth — if this fails, the DB record is already gone.
  // A dangling Firebase user will be rejected by getSession() (no DB entry), so the
  // account is effectively unusable. Log a critical error for manual remediation.
  try {
    await adminAuth.deleteUser(firebaseUid);
  } catch (error) {
    console.error(
      `[api/users/me] CRITICAL: user ${session.id} deleted from DB but Firebase deletion failed for uid ${firebaseUid}. Manual cleanup required.`,
      error,
    );
    return NextResponse.json(
      { error: "Account data deleted but Firebase cleanup failed. Please contact support." },
      { status: 500 },
    );
  }

  // Step 3: Clear the session cookie
  const response = NextResponse.json({ message: "Account deleted successfully" }, { status: 200 });
  response.cookies.set("session", "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    expires: new Date(0),
    path: "/",
  });

  return response;
}
