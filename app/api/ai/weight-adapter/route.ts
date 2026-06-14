import { z } from "zod";
import {
  runWeightAdapter,
  runWeightAdapterForAllUsers,
} from "@/lib/services/aiService";
import { NextResponse } from "next/server";

const SingleUserSchema = z.object({
  user_id: z.string().min(1),
  run_all_users: z.literal(false).optional(),
});

const AllUsersSchema = z.object({
  run_all_users: z.literal(true),
});

const RequestSchema = z.union([SingleUserSchema, AllUsersSchema]);

function validateCronSecret(request: Request): boolean {
  const secret = request.headers.get("x-cron-secret");
  return secret === process.env.CRON_SECRET;
}

export async function POST(request: Request) {
  const body = await request.json();
  const parsed = RequestSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    );
  }

  // All-users run requires cron secret — prevents abuse
  if ("run_all_users" in parsed.data && parsed.data.run_all_users) {
    if (!validateCronSecret(request)) {
      return NextResponse.json(
        { error: "Unauthorized" },
        { status: 401 }
      );
    }

    try {
      const summary = await runWeightAdapterForAllUsers();
      return NextResponse.json(summary);
    } catch (error) {
      console.error("Weight adapter all-users run failed:", error);
      return NextResponse.json(
        { error: "Weight adapter failed" },
        { status: 500 }
      );
    }
  }

  // Single user run
  try {
    const result = await runWeightAdapter(
      (parsed.data as { user_id: string }).user_id
    );
    return NextResponse.json(result);
  } catch (error) {
    console.error("Weight adapter failed:", error);
    return NextResponse.json(
      { error: "Weight adapter failed" },
      { status: 500 }
    );
  }
}