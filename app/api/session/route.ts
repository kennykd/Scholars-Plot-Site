import { adminAuth } from "@/lib/firebase-admin";
import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
  const authorization = req.headers.get("Authorization");

  if (!authorization?.startsWith("Bearer ")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const idToken = authorization.split("Bearer ")[1];

  await adminAuth.verifyIdToken(idToken, true);

  const response = NextResponse.json({ status: "success" });

  response.cookies.set("session", idToken, {
    httpOnly: true,
    secure: true,
    path: "/",
  });

  return response;
}