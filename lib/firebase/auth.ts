'use server';

import { cache } from "react";
import { cookies } from "next/headers";
import { adminAuth } from "@/lib/firebase/firebase-admin";
import type { DecodedIdToken } from "firebase-admin/auth";

interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
}

// Implemented caching to the getSession function
export const getSession = cache(async (): Promise<SessionUser | null> => { 
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;

  if (!session) return null;

  try {
    // Verify the server-issued Firebase session cookie.
    const decodedToken: DecodedIdToken = await adminAuth.verifySessionCookie(session, true);

    if (!decodedToken.email) return null;

    // Return the Firebase claims directly so auth checks do not hit Prisma
    // on every authenticated request.
    return {
      id: decodedToken.uid,
      email: decodedToken.email,
      name: decodedToken.name ?? null,
      image: decodedToken.picture ?? null,
    };
  } catch {
    console.log(
      "WARNING: User not authenticated through firebase yet, check the firebase console!",
    );
    return null;
  }
});