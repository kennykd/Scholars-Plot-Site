import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/firebase-admin";
import { prisma } from "@/lib/prisma";
import type { DecodedIdToken } from "firebase-admin/auth";

interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

// TODO: DELETE User from database if Session is not found or the user is no longer in the firebase console
export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;

  if (!session) return null;

  try {
    // Try verifying as Firebase token
    const decodedToken: DecodedIdToken = await adminAuth.verifyIdToken(session, true);

    // Search for user in database
    const user = await prisma.user.findUnique({
      where: { email: decodedToken.email! },
    });

    if (!user) return null;

    // RETURNS the authenticated user data from the database
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    };
  } catch {
    console.log(
      "WARNING: User not authenticated through firebase yet, check the firebase console!",
    );
    return null;
  }
}