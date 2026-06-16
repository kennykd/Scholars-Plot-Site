import { NextResponse } from "next/server";
import { getSession } from "@/lib/firebase/auth";
import { getPublicUsers } from "@/lib/services/userService";

/**
 * @swagger
 * /api/users:
 *   get:
 *     summary: Get all users (safe public fields only)
 *     description: Returns a list of all registered users. Intended for project member search and discovery. Requires authentication.
 *     tags:
 *       - Users
 *     security:
 *       - cookieAuth: []
 *     responses:
 *       200:
 *         description: Users retrieved successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Users retrieved successfully
 *                 users:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/UserPublic'
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
 *                   example: Failed to retrieve users
 */

/**
 * @swagger
 * components:
 *   schemas:
 *     UserPublic:
 *       type: object
 *       properties:
 *         id:
 *           type: string
 *           example: "clxyz123abc"
 *         name:
 *           type: string
 *           nullable: true
 *           example: "Barry Allen"
 *         email:
 *           type: string
 *           format: email
 *           example: "barry@example.com"
 *         image:
 *           type: string
 *           nullable: true
 *           example: "https://example.com/avatar.png"
 */
export async function GET() {
  const session = await getSession();

  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const users = await getPublicUsers();

    return NextResponse.json({ message: "Users retrieved successfully", users }, { status: 200 });
  } catch (error) {
    console.error("[api/users] Failed to retrieve users:", error);
    return NextResponse.json({ error: "Failed to retrieve users" }, { status: 500 });
  }
}
