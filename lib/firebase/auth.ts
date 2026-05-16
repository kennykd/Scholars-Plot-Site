'use server';

import { cache } from "react";
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
// Implemented caching to the getSession function
export const getSession = cache(async (): Promise<SessionUser | null> => { 
  const cookieStore = await cookies();
  const session = cookieStore.get("session")?.value;

  if (!session) return null;

  try {
    // Try verifying as Firebase token
    const decodedToken: DecodedIdToken = await adminAuth.verifyIdToken(session);

    // Search for user in database
    const user = await prisma.user.findUnique({
      where: { user_email: decodedToken.email! },
    });

    if (!user) return null;

    // RETURNS the authenticated user data from the database
    return {
      id: user.user_id,
      email: user.user_email,
      name: user.user_name,
      image: user.avatar_url,
    };
  } catch {
    console.log(
      "WARNING: User not authenticated through firebase yet, check the firebase console!",
    );
    return null;
  }
});