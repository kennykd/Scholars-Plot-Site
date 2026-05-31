import prisma from "@/lib/prisma";

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
