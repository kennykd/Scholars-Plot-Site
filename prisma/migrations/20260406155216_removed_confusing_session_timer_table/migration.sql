/*
  Warnings:

  - You are about to drop the column `session_timer_id` on the `study_session_reminder` table. All the data in the column will be lost.
  - You are about to drop the `session_timer` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `session_timer_user` table. If the table is not empty, all the data it contains will be lost.
  - Added the required column `study_session_id` to the `study_session_reminder` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "session_timer" DROP CONSTRAINT "session_timer_attachment_id_fkey";

-- DropForeignKey
ALTER TABLE "session_timer" DROP CONSTRAINT "session_timer_study_session_id_fkey";

-- DropForeignKey
ALTER TABLE "session_timer" DROP CONSTRAINT "session_timer_task_id_fkey";

-- DropForeignKey
ALTER TABLE "session_timer_user" DROP CONSTRAINT "session_timer_user_session_timer_id_fkey";

-- DropForeignKey
ALTER TABLE "session_timer_user" DROP CONSTRAINT "session_timer_user_study_session_id_fkey";

-- DropForeignKey
ALTER TABLE "session_timer_user" DROP CONSTRAINT "session_timer_user_user_id_fkey";

-- DropForeignKey
ALTER TABLE "study_session_reminder" DROP CONSTRAINT "study_session_reminder_session_timer_id_fkey";

-- AlterTable
ALTER TABLE "study_session_reminder" DROP COLUMN "session_timer_id",
ADD COLUMN     "study_session_id" INTEGER NOT NULL;

-- DropTable
DROP TABLE "session_timer";

-- DropTable
DROP TABLE "session_timer_user";

-- CreateTable
CREATE TABLE "study_session_user" (
    "study_session_id" INTEGER NOT NULL,
    "user_id" TEXT NOT NULL,
    "task_id" INTEGER,
    "attachment_id" INTEGER,
    "started_at" TIMESTAMP(3),
    "joined_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "current_time" INTEGER NOT NULL DEFAULT 0,
    "status" "SessionTimerStatus" NOT NULL DEFAULT 'idle',
    "completed_at" TIMESTAMP(3),
    "actual_duration" INTEGER,

    CONSTRAINT "study_session_user_pkey" PRIMARY KEY ("study_session_id","user_id")
);

-- AddForeignKey
ALTER TABLE "study_session_user" ADD CONSTRAINT "study_session_user_study_session_id_fkey" FOREIGN KEY ("study_session_id") REFERENCES "study_session"("study_session_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_session_user" ADD CONSTRAINT "study_session_user_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "user"("user_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_session_user" ADD CONSTRAINT "study_session_user_task_id_fkey" FOREIGN KEY ("task_id") REFERENCES "task"("task_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_session_user" ADD CONSTRAINT "study_session_user_attachment_id_fkey" FOREIGN KEY ("attachment_id") REFERENCES "attachment"("attachment_id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "study_session_reminder" ADD CONSTRAINT "study_session_reminder_study_session_id_fkey" FOREIGN KEY ("study_session_id") REFERENCES "study_session"("study_session_id") ON DELETE RESTRICT ON UPDATE CASCADE;
