import { z } from "zod";
import { runOverloadDetector } from "@/lib/services/aiService";
import {
  getOverloadWarningsForUser,
  markWarningAsRead,
} from "@/lib/services/overloadService";
import { NextResponse } from "next/server";

const DetectOverloadSchema = z.object({
  user_id: z.string().min(1),
  target_date: z.string().datetime("Invalid date format"),
});

const MarkReadSchema = z.object({
  user_id: z.string().min(1),
  warning_id: z.number().int().positive(),
});

// Manually trigger overload detection
export async function POST(request: Request) {
  const body = await request.json();
  const parsed = DetectOverloadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const weekStart = new Date(parsed.data.target_date);
    weekStart.setHours(0, 0, 0, 0);
    const weekEnd = new Date(weekStart);
    weekEnd.setDate(weekStart.getDate() + 7);

    const result = await runOverloadDetector(
      parsed.data.user_id,
      weekStart,
      weekEnd
    );

    return NextResponse.json(result);
  } catch (error) {
    console.error("Overload detection failed:", error);
    return NextResponse.json(
      { error: "Failed to run overload detection" },
      { status: 500 }
    );
  }
}

// Fetch stored warnings for a user
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const user_id = searchParams.get("user_id");
  const limit = searchParams.get("limit");

  if (!user_id) {
    return NextResponse.json(
      { error: "user_id is required" },
      { status: 400 }
    );
  }

  try {
    const warnings = await getOverloadWarningsForUser(
      user_id,
      limit ? parseInt(limit) : 10
    );
    return NextResponse.json(warnings);
  } catch (error) {
    console.error("Failed to fetch warnings:", error);
    return NextResponse.json(
      { error: "Failed to fetch warnings" },
      { status: 500 }
    );
  }
}

// Mark a warning as read
export async function PATCH(request: Request) {
  const body = await request.json();
  const parsed = MarkReadSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  try {
    const updated = await markWarningAsRead(parsed.data.warning_id);
    return NextResponse.json(updated);
  } catch (error) {
    console.error("Failed to mark warning as read:", error);
    return NextResponse.json(
      { error: "Failed to update warning" },
      { status: 500 }
    );
  }
}