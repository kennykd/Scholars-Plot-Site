import prisma from "@/lib/prisma";
import webpush, { type PushSubscription } from "web-push";

export class WebPushConfigurationError extends Error {
  constructor(message = "Push notification server is not configured") {
    super(message);
    this.name = "WebPushConfigurationError";
  }
}

let configuredVapidSignature: string | null = null;

function configureWebPush() {
  const subject = process.env.VAPID_SUBJECT || "mailto:example@domain.com";
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;

  if (!publicKey || !privateKey) {
    throw new WebPushConfigurationError();
  }

  const signature = `${subject}|${publicKey}|${privateKey}`;
  if (configuredVapidSignature === signature) return;

  webpush.setVapidDetails(subject, publicKey, privateKey);
  configuredVapidSignature = signature;
}

export type WebPushPayload = {
  title: string;
  body: string;
  tag: string;
  data: {
    url: string;
  };
};

export async function getUserPushSubscription(userId: string) {
  return prisma.user.findUnique({
    where: { user_id: userId },
    select: {
      push_subscription: true,
    },
  });
}

export async function setUserPushSubscription(userId: string, subscription: string) {
  await prisma.user.update({
    where: { user_id: userId },
    data: { push_subscription: subscription },
  });
}

export async function clearUserPushSubscription(userId: string) {
  await prisma.user.update({
    where: { user_id: userId },
    data: { push_subscription: null },
  });
}

export async function sendWebPushNotification(
  subscription: PushSubscription,
  payload: WebPushPayload,
) {
  configureWebPush();

  return webpush.sendNotification(subscription, JSON.stringify(payload), {
    TTL: 60,
    timeout: 10000,
  });
}
