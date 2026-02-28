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

    return {
      id: user.id,
      email: user.email,
      name: user.name,
      image: user.image,
    };
  } catch {
    return null;
  }
}