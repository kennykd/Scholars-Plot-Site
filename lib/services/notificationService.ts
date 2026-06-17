import prisma from "@/lib/prisma";

const ACTIVE_NOTIFICATION_LIMIT = 30;

type NotificationPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

type UserNotificationRow = {
  notification_id: number;
  title: string;
  body: string;
  url: string;
  tag: string | null;
  read_at: Date | null;
  created_at: Date;
};

export type AppNotification = {
  id: string;
  title: string;
  body: string;
  url: string;
  tag: string;
  read: boolean;
  createdAt: string;
};

function toAppNotification(row: UserNotificationRow): AppNotification {
  return {
    id: String(row.notification_id),
    title: row.title,
    body: row.body,
    url: row.url,
    tag: row.tag ?? row.url,
    read: Boolean(row.read_at),
    createdAt: row.created_at.toISOString(),
  };
}

export async function createUserNotification(
  userId: string,
  payload: NotificationPayload,
) {
  const url = payload.url?.trim() || "/";
  const tag = payload.tag?.trim() || url;
  const sourceKey = payload.tag?.trim() || null;

  if (sourceKey) {
    const notification = await prisma.userNotification.upsert({
      where: {
        user_id_source_key: {
          user_id: userId,
          source_key: sourceKey,
        },
      },
      update: {},
      create: {
        user_id: userId,
        title: payload.title,
        body: payload.body,
        url,
        tag,
        source_key: sourceKey,
      },
    });

    return toAppNotification(notification);
  }

  const notification = await prisma.userNotification.create({
    data: {
      user_id: userId,
      title: payload.title,
      body: payload.body,
      url,
      tag,
      source_key: null,
    },
  });

  return toAppNotification(notification);
}

export async function getActiveNotificationsForUser(userId: string) {
  const notifications = await prisma.userNotification.findMany({
    where: {
      user_id: userId,
      dismissed_at: null,
    },
    orderBy: {
      created_at: "desc",
    },
    take: ACTIVE_NOTIFICATION_LIMIT,
  });

  return notifications.map(toAppNotification);
}

export async function dismissNotificationForUser(
  userId: string,
  notificationId: number,
) {
  const notification = await prisma.userNotification.findFirst({
    where: {
      notification_id: notificationId,
      user_id: userId,
    },
  });

  if (!notification) {
    return false;
  }

  const dismissedAt = new Date();
  await prisma.userNotification.update({
    where: {
      notification_id: notificationId,
    },
    data: {
      read_at: dismissedAt,
      dismissed_at: dismissedAt,
    },
  });

  return true;
}
