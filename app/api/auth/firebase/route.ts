import { NextRequest, NextResponse } from "next/server";
import { getAdminAuth } from "@/lib/firebase/firebase-admin";
import { ensureUserRecordForSession } from "@/lib/services/userService";
/**
 * @swagger
 * /api/auth/firebase:
 *   post:
 *     summary: Exchange a Firebase ID token for a session cookie
 *     tags:
 *       - Auth
 *     description: >
 *       Verifies the provided Firebase ID token, upserts the user into the
 *       PostgreSQL database, and sets an httpOnly session cookie. Called
 *       automatically after a successful Firebase login (email/password or Google).
 *     parameters:
 *       - in: header
 *         name: Authorization
 *         required: true
 *         schema:
 *           type: string
 *         description: Firebase ID token in the format "Bearer <idToken>"
 *         example: "Bearer eyJhbGciOiJSUzI1NiJ9..."
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               displayName:
 *                 type: string
 *                 description: >
 *                   Optional display name for the user. Takes priority over the
 *                   name stored in the Firebase token. Used when registering
 *                   with email/password where Firebase has no display name set.
 *                 example: "Alex Scholar"
 *     responses:
 *       200:
 *         description: Authentication successful — session cookie is set
 *         headers:
 *           Set-Cookie:
 *             description: httpOnly session cookie containing the Firebase ID token
 *             schema:
 *               type: string
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status:
 *                   type: string
 *                   example: success
 *                 userId:
 *                   type: string
 *                   description: The user's database ID
 *                   example: "clxyz123abc"
 *       401:
 *         description: Missing, malformed, or invalid Firebase ID token
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: Unauthorized
 */

const SESSION_DURATION_MS = 60 * 60 * 24 * 7 * 1000;
const SESSION_DURATION_S = 60 * 60 * 24 * 7;

export async function POST(req: NextRequest) {
  const authorization = req.headers.get("Authorization");
  let name: string | undefined;

  // Parse the name from the request body (sent by manual registration, not Google sign-in)
  try {
    const body = await req.json() as { name?: unknown };
    if (typeof body.name === "string") {
      name = body.name.trim() || undefined;
    }
  } catch {
    name = undefined;
  }

  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idToken = authorization.split("Bearer ")[1];

  try {
    // The bearer value here is a Firebase ID token. Verify it first, then
    // exchange it for the long-lived httpOnly session cookie below.
    const decodedToken = await getAdminAuth().verifyIdToken(idToken, true);

    // Anonymous auth and phone-auth tokens carry no email, which would crash
    // the Prisma upsert below. Guard here so the error is explicit and clean
    // rather than a 500 leaking from inside the DB call.
    if (!decodedToken.email) {
      return NextResponse.json({ error: "An email address is required to register." }, { status: 400 });
    }

    // firebaseName/firebaseImage: sourced from the Firebase token (Google sign-in profile data),
    // may differ from what is stored in the database if the user updated their profile here.
    const firebaseName = decodedToken.name?.trim();
    const firebaseImage = decodedToken.picture?.trim();
    // Prefer the name sent in the request body (manual registration), fall back to Firebase token name
    name = name || firebaseName;

    // Keep the database user keyed by the Firebase UID used in session cookies.
    // If an email-matched row has a different id, repair it before FK writes.
    await ensureUserRecordForSession({
      id: decodedToken.uid,
      email: decodedToken.email,
      name: name || null,
      image: firebaseImage || null,
    });

    /*
      createSessionCookie() exchanges the short-lived ID token (1 hr) for a
      dedicated server-issued session token (long-lived). Storing the
      raw ID token in the cookie instead would let an attacker replay it
      directly against Firebase APIs, the session cookie is only valid here.
    */
    const sessionCookie = await getAdminAuth().createSessionCookie(idToken, {
      expiresIn: SESSION_DURATION_MS,
    });

    // Set session cookie
    const response = NextResponse.json({ status: "successfully authenticated" });
    response.cookies.set("session", sessionCookie, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      // ADDED sameSite
      // a request triggered from a third-party site would automatically attach this cookie, allowing forged authenticated requests.
      sameSite: "strict",
      path: "/",
      // ADDED maxAge
      // when the browser is closed, a token still persist as long as it is not exceeding the age
      maxAge: SESSION_DURATION_S,
    });

    return response;
  } catch (error) {
    console.error("Firebase auth error:", error);
    return NextResponse.json({ error: "Authentication failed" }, { status: 401 });
  }
}
