-- CreateEnum
CREATE TYPE "InviteStatus" AS ENUM ('pending', 'accepted', 'declined');

-- CreateTable
CREATE TABLE "project_invite" (
    "invite_id" SERIAL NOT NULL,
    "project_id" INTEGER NOT NULL,
    "invited_by" TEXT NOT NULL,
    "invited_user" TEXT NOT NULL,
    "status" "InviteStatus" NOT NULL DEFAULT 'pending',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "responded_at" TIMESTAMP(3),

    CONSTRAINT "project_invite_pkey" PRIMARY KEY ("invite_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "project_invite_project_id_invited_user_key" ON "project_invite"("project_id", "invited_user");

-- AddForeignKey
ALTER TABLE "project_invite" ADD CONSTRAINT "project_invite_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "project"("project_id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_invite" ADD CONSTRAINT "project_invite_invited_by_fkey" FOREIGN KEY ("invited_by") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "project_invite" ADD CONSTRAINT "project_invite_invited_user_fkey" FOREIGN KEY ("invited_user") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;
