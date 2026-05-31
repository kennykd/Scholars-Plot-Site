import prisma from "@/lib/prisma";
import type { UpdateUserInput } from "@/lib/validation/user";

export async function getPublicUsers() {
  const users = await prisma.user.findMany({
    select: {
      user_id: true,
      user_name: true,
      avatar_url: true,
    },
  });

  return users.map((user) => ({
    id: user.user_id,
    name: user.user_name,
    image: user.avatar_url,
  }));
}

export async function updateUserProfile(userId: string, data: UpdateUserInput) {
  const user = await prisma.user.update({
    where: { user_id: userId },
    data: {
      user_name: data.name,
      avatar_url: data.image,
    },
    select: {
      user_id: true,
      user_email: true,
      user_name: true,
      avatar_url: true,
    },
  });

  return {
    id: user.user_id,
    email: user.user_email,
    name: user.user_name,
    image: user.avatar_url,
  };
}

export async function deleteUserById(userId: string) {
  await prisma.user.delete({ where: { user_id: userId } });
}