import { NextResponse } from "next/server";
import { z } from "zod";
import { getSession } from "@/lib/firebase/auth";
import {
  clearUserPushSubscription,
  getUserPushSubscription,
  sendWebPushNotification,
  WebPushConfigurationError,
} from "@/lib/services/webPushService";

const sendNotificationSchema = z.object({
  title: z.string().trim().min(1).max(120),
  body: z.string().trim().min(1).max(500),
  url: z.string().trim().startsWith("/").max(300).default("/"),
  tag: z.string().trim().min(1).max(200).optional(),
});

function getPushStatusCode(error: unknown) {
  if (
    typeof error === "object" &&
    error !== null &&
    "statusCode" in error &&
    typeof (error as { statusCode?: unknown }).statusCode === "number"
  ) {
    return (error as { statusCode: number }).statusCode;
  }

  return null;
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    let body: unknown;
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const parsed = sendNotificationSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: "Validation failed",
          details: z.flattenError(parsed.error).fieldErrors,
        },
        { status: 400 },
      );
    }

    const user = await getUserPushSubscription(session.id);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    if (!user.push_subscription) {
      return NextResponse.json(
        { error: "User is not subscribed to push notifications" },
        { status: 404 },
      );
    }

    let subscription;
    try {
      subscription = JSON.parse(user.push_subscription);
    } catch {
      await clearUserPushSubscription(session.id);
      return NextResponse.json(
        { error: "Stored push subscription is invalid" },
        { status: 410 },
      );
    }

    const payload = {
      title: parsed.data.title,
      body: parsed.data.body,
      tag: parsed.data.tag ?? parsed.data.url,
      data: {
        url: parsed.data.url,
      },
    };

    await sendWebPushNotification(subscription, payload);

    return NextResponse.json(
      { message: "Successfully sent notification to the user!" },
      { status: 200 },
    );
  } catch (error) {
    if (error instanceof WebPushConfigurationError) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    const statusCode = getPushStatusCode(error);
    if (statusCode === 404 || statusCode === 410) {
      await clearUserPushSubscription(session.id);
      return NextResponse.json(
        { error: "Stored push subscription is no longer valid" },
        { status: 410 },
      );
    }

    console.error("Failed to send notification:", error);
    return NextResponse.json(
      {
        error: `Failed to send notification: ${
          error instanceof Error ? error.message : String(error)
        }`,
      },
      { status: 500 },
    );
  }
}
