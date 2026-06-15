import prisma from "@/lib/prisma";
import type { UpdateUserInput } from "@/lib/validation/user";

const SESSION_USER_SELECT = {
  user_id: true,
  user_email: true,
  user_name: true,
  avatar_url: true,
} as const;

export type SessionUserIdentity = {
  id: string;
  email: string;
  name?: string | null;
  image?: string | null;
};

type SessionUserRecord = {
  user_id: string;
  user_email: string;
  user_name: string;
  avatar_url: string | null;
};

function optionalText(value: string | null | undefined) {
  const trimmed = value?.trim();
  return trimmed || undefined;
}

function serializeSessionUser(user: SessionUserRecord) {
  return {
    id: user.user_id,
    email: user.user_email,
    name: user.user_name,
    image: user.avatar_url,
  };
}

export async function ensureUserRecordForSession(identity: SessionUserIdentity) {
  const id = identity.id.trim();
  const email = identity.email.trim();
  const name = optionalText(identity.name);
  const image = optionalText(identity.image);

  if (!id || !email) {
    throw new Error("Authenticated user is missing a Firebase uid or email.");
  }

  const updateData = {
    user_email: email,
    ...(name ? { user_name: name } : {}),
    ...(image ? { avatar_url: image } : {}),
    user_last_login: new Date(),
  };

  const existingByUid = await prisma.user.findUnique({
    where: { user_id: id },
    select: SESSION_USER_SELECT,
  });

  if (existingByUid) {
    const user = await prisma.user.update({
      where: { user_id: id },
      data: updateData,
      select: SESSION_USER_SELECT,
    });

    return serializeSessionUser(user);
  }

  const existingByEmail = await prisma.user.findUnique({
    where: { user_email: email },
    select: SESSION_USER_SELECT,
  });

  if (existingByEmail) {
    const user = await prisma.user.update({
      where: { user_email: email },
      data: {
        user_id: id,
        ...(name ? { user_name: name } : {}),
        ...(image ? { avatar_url: image } : {}),
        user_last_login: new Date(),
      },
      select: SESSION_USER_SELECT,
    });

    return serializeSessionUser(user);
  }

  const user = await prisma.user.create({
    data: {
      user_id: id,
      user_email: email,
      user_name: name || "User",
      avatar_url: image || null,
      user_last_login: new Date(),
    },
    select: SESSION_USER_SELECT,
  });

  return serializeSessionUser(user);
}

export async function getPublicUsers() {
  const users = await prisma.user.findMany({
    select: {
      user_id: true,
      user_name: true,
      user_email: true,
      avatar_url: true,
    },
  });

  return users.map((user) => ({
    id: user.user_id,
    name: user.user_name,
    email: user.user_email,
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
